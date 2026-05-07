// ===== ORDER PAGE =====
const session = JSON.parse(sessionStorage.getItem('pos_session') || 'null');
if (!session) window.location.href = 'index.html';

const tableId = parseInt(sessionStorage.getItem('pos_current_table'));
const orderId = parseInt(sessionStorage.getItem('pos_current_order'));
if (!tableId || !orderId) window.location.href = 'dashboard.html';

let table = null;
let order = null;
let cart  = [];
let MENU_DATA   = [];
let CATEGORIES  = [];
let activeCategory = 'Semua';

function formatRp(n) { return 'Rp ' + n.toLocaleString('id-ID'); }

// ── Init async ────────────────────────────────────────────────
async function init() {
  table = await API.getTable(tableId);
  order = await API.getOrder(orderId).catch(() => null);
  cart  = order ? JSON.parse(JSON.stringify(order.items || [])) : [];

  document.getElementById('kasirName').textContent       = '👤 ' + session.name;
  document.getElementById('tableLabel').textContent      = table?.name || '';
  document.getElementById('orderTableLabel').textContent = table?.name || '';

  CATEGORIES = await API.getMenuCategories();
  MENU_DATA  = await API.getMenu();

  renderCategories();
  renderMenu();
  renderCart();
}

// ── Back ──────────────────────────────────────────────────────
document.getElementById('backBtn').addEventListener('click', () => {
  if (cart.length === 0 && order && order.status === 'open') {
    Modal.confirm('⚠️', 'Cart Kosong', 'Cart masih kosong. Batalkan dan kosongkan meja?', async () => {
      await API.updateOrder(orderId, { status: 'cancelled' });
      await API.updateTable(tableId, { status: 'available', openedAt: null, kasirId: null });
      window.location.href = 'dashboard.html';
    }, 'Ya, Batalkan', 'Tetap di sini', 'btn-danger');
    return;
  }
  window.location.href = 'dashboard.html';
});

// ── Kategori ──────────────────────────────────────────────────
function renderCategories() {
  const tabs = document.getElementById('categoryTabs');
  tabs.innerHTML = '';
  CATEGORIES.forEach(cat => {
    const btn = document.createElement('button');
    btn.className   = 'cat-tab' + (cat === activeCategory ? ' active' : '');
    btn.textContent = cat;
    btn.addEventListener('click', async () => {
      activeCategory = cat;
      MENU_DATA = await API.getMenu(cat);
      renderCategories();
      renderMenu();
    });
    tabs.appendChild(btn);
  });
}

// ── Menu ──────────────────────────────────────────────────────
function renderMenu(filter = '') {
  const grid = document.getElementById('menuGrid');
  grid.innerHTML = '';

  let items = MENU_DATA;
  if (filter) {
    const q = filter.toLowerCase();
    items = items.filter(m => m.name.toLowerCase().includes(q));
  }

  if (items.length === 0) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--text-muted);padding:2rem">Tidak ada menu ditemukan</div>';
    return;
  }

  items.forEach(item => {
    const div = document.createElement('div');
    div.className = 'menu-item' + (item.stock === 0 ? ' unavailable' : '');
    div.innerHTML = `
      <img src="${item.image}" alt="${item.name}" class="item-image"
           onerror="this.style.background='#e2e8f0';this.src=''" />
      <div class="item-name">${item.name}</div>
      <div class="item-price">${formatRp(item.price)}</div>
      <div class="item-stock ${item.stock <= 5 ? 'stock-low' : item.stock <= 10 ? 'stock-mid' : 'stock-ok'}">
        ${item.stock === 0 ? 'Habis' : 'Stok: ' + item.stock}
      </div>
    `;
    if (item.stock > 0) {
      div.addEventListener('click', (e) => { e.stopPropagation(); addToCart(item); });
    }
    grid.appendChild(div);
  });
}

document.getElementById('searchMenu').addEventListener('input', function () {
  renderMenu(this.value);
});

// ── Cart ──────────────────────────────────────────────────────
function addToCart(item) {
  const existing = cart.find(c => c.id === item.id);
  if (existing) {
    existing.qty++;
  } else {
    cart.push({ id: item.id, name: item.name, price: item.price, station: item.station, image: item.image, qty: 1 });
  }
  renderCart();
  API.updateOrder(orderId, { items: cart });
}

function changeQty(itemId, delta) {
  const idx = cart.findIndex(c => c.id === itemId);
  if (idx === -1) return;
  cart[idx].qty += delta;
  if (cart[idx].qty <= 0) cart.splice(idx, 1);
  renderCart();
  API.updateOrder(orderId, { items: cart });
}

function renderCart() {
  const container = document.getElementById('orderItems');
  const totalEl   = document.getElementById('totalAmount');

  Array.from(container.children).forEach(child => {
    if (child.id !== 'emptyOrder') child.remove();
  });

  const emptyEl = document.getElementById('emptyOrder');

  if (cart.length === 0) {
    emptyEl.classList.remove('hidden');
    totalEl.textContent = 'Rp 0';
    return;
  }

  emptyEl.classList.add('hidden');
  let total = 0;

  cart.forEach(item => {
    const subtotal = item.price * item.qty;
    total += subtotal;

    const div = document.createElement('div');
    div.className = 'order-item';

    const infoDiv = document.createElement('div');
    infoDiv.style.flex = '1';
    infoDiv.innerHTML = `
      <div class="oi-name">${item.name}</div>
      <div class="oi-sub">${formatRp(item.price)} · ${item.station === 'kitchen' ? '🍳' : '🍹'}</div>
    `;

    const qtyDiv   = document.createElement('div');
    qtyDiv.className = 'oi-qty';

    const btnMinus = document.createElement('button');
    btnMinus.className   = 'qty-btn';
    btnMinus.textContent = '−';
    btnMinus.addEventListener('click', (e) => { e.stopPropagation(); changeQty(item.id, -1); });

    const qtySpan = document.createElement('span');
    qtySpan.className   = 'qty-num';
    qtySpan.textContent = item.qty;

    const btnPlus = document.createElement('button');
    btnPlus.className   = 'qty-btn';
    btnPlus.textContent = '+';
    btnPlus.addEventListener('click', (e) => { e.stopPropagation(); changeQty(item.id, 1); });

    qtyDiv.appendChild(btnMinus);
    qtyDiv.appendChild(qtySpan);
    qtyDiv.appendChild(btnPlus);

    const priceDiv = document.createElement('div');
    priceDiv.className   = 'oi-price';
    priceDiv.textContent = formatRp(subtotal);

    div.appendChild(infoDiv);
    div.appendChild(qtyDiv);
    div.appendChild(priceDiv);
    container.appendChild(div);
  });

  totalEl.textContent = formatRp(total);
}

// ── Clear ─────────────────────────────────────────────────────
document.getElementById('clearOrderBtn').addEventListener('click', () => {
  if (cart.length === 0) return;
  Modal.confirm('🗑️', 'Hapus Semua', 'Hapus semua item dari pesanan?', () => {
    cart = [];
    renderCart();
    API.updateOrder(orderId, { items: [] });
  }, 'Ya, Hapus', 'Batal', 'btn-danger');
});

// ── Kirim pesanan ─────────────────────────────────────────────
document.getElementById('sendOrderBtn').addEventListener('click', () => {
  if (cart.length === 0) {
    Modal.alert('🛒', 'Pesanan Kosong', 'Tambahkan menu terlebih dahulu.');
    return;
  }
  showSendModal();
});

function showSendModal() {
  const modal   = document.getElementById('sendModal');
  const summary = document.getElementById('sendSummary');
  const kitchen = cart.filter(i => i.station === 'kitchen');
  const bar     = cart.filter(i => i.station === 'bar');
  let html = '';

  if (kitchen.length) {
    html += `<div style="margin-bottom:.75rem"><strong>🍳 Kitchen</strong>`;
    kitchen.forEach(i => {
      html += `<div class="send-summary-item"><span>${i.name}</span><span>x${i.qty}</span></div>`;
    });
    html += '</div>';
  }
  if (bar.length) {
    html += `<div style="margin-bottom:.75rem"><strong>🍹 Bar</strong>`;
    bar.forEach(i => {
      html += `<div class="send-summary-item"><span>${i.name}</span><span>x${i.qty}</span></div>`;
    });
    html += '</div>';
  }

  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  html += `<div style="border-top:1px solid var(--border);padding-top:.5rem;font-weight:700;display:flex;justify-content:space-between">
    <span>Total</span><span>${formatRp(total)}</span></div>`;

  summary.innerHTML = html;
  modal.classList.remove('hidden');
}

document.getElementById('sendCancel').addEventListener('click', () => {
  document.getElementById('sendModal').classList.add('hidden');
});

document.getElementById('sendConfirm').addEventListener('click', () => {
  document.getElementById('sendModal').classList.add('hidden');
  sendOrder();
});

async function sendOrder() {
  const note    = document.getElementById('orderNote').value.trim();
  const kitchen = cart.filter(i => i.station === 'kitchen');
  const bar     = cart.filter(i => i.station === 'bar');

  await API.updateOrder(orderId, { items: cart, note, status: 'sent' });

  // Kurangi stok tiap item
  for (const item of cart) {
    const menuItem = MENU_DATA.find(m => m.id === item.id);
    if (menuItem) {
      const newStock = Math.max(0, menuItem.stock - item.qty);
      await API.updateMenuStock(item.id, newStock);
      menuItem.stock = newStock; // update local
    }
  }

  // Cek apakah ini tambahan ke bill yang sudah ada
  const appendToBillId = parseInt(sessionStorage.getItem('pos_append_to_bill'));

  let bill;
  if (appendToBillId) {
    // Tambahkan order ini ke bill yang sudah ada
    bill = await API.addOrderToBill(appendToBillId, orderId);
    sessionStorage.removeItem('pos_append_to_bill');
    sessionStorage.setItem('pos_current_bill', bill.id);
  } else {
    // Buat bill baru
    bill = await API.createBill({
      orderId, tableId, tableName: table.name,
      items: cart, note,
      kasirId: session.id, kasirName: session.name,
    });
    sessionStorage.setItem('pos_current_bill', bill.id);
  }

  // Notifikasi stasiun sequential
  function showBar() {
    if (bar.length) {
      const body = `Meja  : ${table.name}\nKasir : ${session.name}\n${'─'.repeat(26)}\n` +
                   bar.map(i => `• ${i.name}  ×${i.qty}`).join('\n') +
                   (note ? `\n\nCatatan: ${note}` : '');
      Modal.alert('🍹', 'Pesanan Terkirim ke Bar', body, 'OK — Lihat Bill');
      document.getElementById('_modalOverlay').querySelector('button').onclick = () => {
        document.getElementById('_modalOverlay').classList.add('hidden');
        window.location.href = 'bill.html';
      };
    } else {
      window.location.href = 'bill.html';
    }
  }

  if (kitchen.length) {
    const body = `Meja  : ${table.name}\nKasir : ${session.name}\n${'─'.repeat(26)}\n` +
                 kitchen.map(i => `• ${i.name}  ×${i.qty}`).join('\n') +
                 (note ? `\n\nCatatan: ${note}` : '');
    Modal.alert('🍳', 'Pesanan Terkirim ke Kitchen', body, bar.length ? 'Lanjut → Bar' : 'OK — Lihat Bill');
    document.getElementById('_modalOverlay').querySelector('button').onclick = () => {
      document.getElementById('_modalOverlay').classList.add('hidden');
      showBar();
    };
  } else {
    showBar();
  }
}

init();
