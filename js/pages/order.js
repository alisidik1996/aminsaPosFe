// ===== PAGE: Order =====
const session = requireAuth();
if (!session) throw new Error('Not authenticated');

const tableId = parseInt(sessionStorage.getItem('pos_current_table'));
const orderId = parseInt(sessionStorage.getItem('pos_current_order'));
if (!tableId || !orderId) window.location.href = 'dashboard.html';

let table      = null;
let order      = null;
let MENU_DATA  = [];
let CATEGORIES = [];
let activeCategory = 'Semua';

// ── Init ──────────────────────────────────────────────────────
async function init() {
  table = await API.getTable(tableId);
  order = await API.getOrder(orderId).catch(() => null);

  document.getElementById('kasirName').textContent       = '👤 ' + session.name;
  document.getElementById('tableLabel').textContent      = table?.name || '';
  document.getElementById('orderTableLabel').textContent = table?.name || '';

  // Init Cart component
  Cart.init(order?.items || [], async (items) => {
    Cart.render(
      document.getElementById('orderItems'),
      document.getElementById('emptyOrder'),
      document.getElementById('totalAmount')
    );
    await API.updateOrder(orderId, { items });
  });

  CATEGORIES = await API.getMenuCategories();
  MENU_DATA  = await API.getMenu();

  renderCategories();
  renderMenu();
  Cart.render(
    document.getElementById('orderItems'),
    document.getElementById('emptyOrder'),
    document.getElementById('totalAmount')
  );
}

// ── Back ──────────────────────────────────────────────────────
document.getElementById('backBtn').addEventListener('click', () => {
  if (Cart.isEmpty() && order && order.status === 'open') {
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
  let items = MENU_DATA;
  if (filter) {
    const q = filter.toLowerCase();
    items = items.filter(m => m.name.toLowerCase().includes(q));
  }
  MenuGrid.render(document.getElementById('menuGrid'), items, (item) => Cart.add(item));
}

document.getElementById('searchMenu').addEventListener('input', function () {
  renderMenu(this.value);
});

// ── Clear ─────────────────────────────────────────────────────
document.getElementById('clearOrderBtn').addEventListener('click', () => {
  if (Cart.isEmpty()) return;
  Modal.confirm('🗑️', 'Hapus Semua', 'Hapus semua item dari pesanan?', () => {
    Cart.clear();
  }, 'Ya, Hapus', 'Batal', 'btn-danger');
});

// ── Kirim ─────────────────────────────────────────────────────
document.getElementById('sendOrderBtn').addEventListener('click', () => {
  if (Cart.isEmpty()) {
    Modal.alert('🛒', 'Pesanan Kosong', 'Tambahkan menu terlebih dahulu.');
    return;
  }
  showSendModal();
});

function showSendModal() {
  const items   = Cart.getItems();
  const kitchen = items.filter(i => i.station === 'kitchen');
  const bar     = items.filter(i => i.station === 'bar');
  let html = '';

  if (kitchen.length) {
    html += `<div style="margin-bottom:.75rem"><strong>🍳 Kitchen</strong>`;
    kitchen.forEach(i => { html += `<div class="send-summary-item"><span>${i.name}</span><span>x${i.qty}</span></div>`; });
    html += '</div>';
  }
  if (bar.length) {
    html += `<div style="margin-bottom:.75rem"><strong>🍹 Bar</strong>`;
    bar.forEach(i => { html += `<div class="send-summary-item"><span>${i.name}</span><span>x${i.qty}</span></div>`; });
    html += '</div>';
  }
  html += `<div style="border-top:1px solid var(--border);padding-top:.5rem;font-weight:700;display:flex;justify-content:space-between">
    <span>Total</span><span>${formatRp(Cart.getTotal())}</span></div>`;

  document.getElementById('sendSummary').innerHTML = html;
  document.getElementById('sendModal').classList.remove('hidden');
}

document.getElementById('sendCancel').addEventListener('click', () => {
  document.getElementById('sendModal').classList.add('hidden');
});

document.getElementById('sendConfirm').addEventListener('click', () => {
  document.getElementById('sendModal').classList.add('hidden');
  sendOrder();
});

async function sendOrder() {
  const note  = document.getElementById('orderNote').value.trim();
  const items = Cart.getItems();

  await API.updateOrder(orderId, { items, note, status: 'sent' });

  // Kurangi stok
  for (const item of items) {
    const menuItem = MENU_DATA.find(m => m.id === item.id);
    if (menuItem) {
      await API.updateMenuStock(item.id, Math.max(0, menuItem.stock - item.qty));
      menuItem.stock = Math.max(0, menuItem.stock - item.qty);
    }
  }

  const appendToBillId = parseInt(sessionStorage.getItem('pos_append_to_bill'));
  let bill;
  if (appendToBillId) {
    bill = await API.addOrderToBill(appendToBillId, orderId);
    sessionStorage.removeItem('pos_append_to_bill');
  } else {
    bill = await API.createBill({
      orderId, tableId, tableName: table.name,
      items, note, kasirId: session.id, kasirName: session.name,
    });
  }
  sessionStorage.setItem('pos_current_bill', bill.id);

  StationNotif.show(items, table.name, session.name, note, () => {
    window.location.href = 'bill.html';
  });
}

init();
