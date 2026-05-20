// ===== PAGE: Kitchen Dashboard =====
// Tidak perlu auth khusus — station view bisa diakses siapa saja di jaringan lokal

let allItems = [];
let refreshInterval = null;

// ── Update waktu ──────────────────────────────────────────────
function updateTime() {
  const now = new Date();
  document.getElementById('currentTime').textContent = 
    now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// ── Format elapsed time ───────────────────────────────────────
function formatElapsed(iso) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 1) return 'Baru saja';
  if (diff < 60) return `${diff} mnt lalu`;
  return `${Math.floor(diff / 60)} jam ${diff % 60} mnt lalu`;
}

// ── Group items by order ──────────────────────────────────────
function groupItemsByOrder(items) {
  const orders = {};
  items.forEach(item => {
    if (!orders[item.order_id]) {
      orders[item.order_id] = {
        order_id: item.order_id,
        table_id: item.table_id,
        table_name: item.table_name,
        kasir_name: item.kasir_name,
        order_note: item.order_note,
        order_created: item.order_created,
        items: [],
        allCompleted: true,
      };
    }
    orders[item.order_id].items.push(item);
    if (!item.completed_at) orders[item.order_id].allCompleted = false;
  });
  return Object.values(orders);
}

// ── Render orders ─────────────────────────────────────────────
function renderOrders() {
  const orders = groupItemsByOrder(allItems);
  const grid = document.getElementById('ordersGrid');
  
  if (!orders.length) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🍳</div>
        <div>Tidak ada pesanan di kitchen saat ini.</div>
        <div style="font-size:.9rem;color:#b45309;margin-top:.5rem">Tunggu pesanan dari kasir...</div>
      </div>
    `;
    return;
  }

  grid.innerHTML = orders.map(order => {
    const isCompleted = order.allCompleted;
    const pendingItems = order.items.filter(i => !i.completed_at);
    const completedItems = order.items.filter(i => i.completed_at);
    
    return `
      <div class="order-card ${isCompleted ? 'completed' : ''}">
        <div class="order-header ${isCompleted ? 'completed' : ''}">
          <div>
            <div class="order-table ${isCompleted ? 'completed' : ''}">${order.table_name}</div>
            <div class="order-time ${isCompleted ? 'completed' : ''}">
              <span>⏱</span>
              <span>${formatElapsed(order.order_created)}</span>
            </div>
            <div class="order-kasir ${isCompleted ? 'completed' : ''}">Kasir: ${order.kasir_name}</div>
          </div>
          <div class="status-badge ${isCompleted ? 'status-completed' : 'status-pending'}">
            ${isCompleted ? 'SELESAI' : 'PENDING'}
          </div>
        </div>
        <div class="order-items">
          ${pendingItems.map(item => `
            <div class="order-item">
              <div>
                <div class="item-name">${item.name}</div>
                <div class="item-actions">
                  <button class="btn btn-success btn-sm" onclick="completeItem(${item.id})">Selesai</button>
                </div>
              </div>
              <span class="item-qty">×${item.qty}</span>
            </div>
          `).join('')}
          ${completedItems.length > 0 ? `
            <div style="margin-top:.75rem;padding-top:.75rem;border-top:1px dashed #e5e7eb">
              <div style="font-size:.8rem;color:#9ca3af;margin-bottom:.5rem">Sudah selesai:</div>
              ${completedItems.map(item => `
                <div class="order-item" style="opacity:.7">
                  <div>
                    <div class="item-name" style="text-decoration:line-through">${item.name}</div>
                    <div class="item-actions">
                      <button class="btn btn-outline btn-sm" onclick="undoCompleteItem(${item.id})">Batal</button>
                    </div>
                  </div>
                  <span class="item-qty completed">×${item.qty}</span>
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>
        ${order.order_note ? `
          <div class="order-note ${isCompleted ? 'completed' : ''}">
            <strong>Catatan:</strong> ${order.order_note}
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
}

// ── Load data ─────────────────────────────────────────────────
async function loadData() {
  try {
    allItems = await API.getStationItems('kitchen');
    renderOrders();
  } catch (err) {
    console.error('Gagal load data:', err);
    // Fallback ke modal alert jika gagal
    if (allItems.length === 0) {
      document.getElementById('ordersGrid').innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">⚠️</div>
          <div>Tidak dapat terhubung ke server.</div>
          <div style="font-size:.9rem;color:#b45309;margin-top:.5rem">Pastikan backend berjalan di localhost:3000</div>
        </div>
      `;
    }
  }
}

// ── Complete item ─────────────────────────────────────────────
async function completeItem(itemId) {
  try {
    const result = await API.completeItem(itemId);
    // Update UI lokal
    const item = allItems.find(i => i.id === itemId);
    if (item) item.completed_at = result.item.completed_at;
    renderOrders();
    
    // Jika order sudah lengkap selesai, tampilkan notifikasi
    if (result.orderComplete) {
      const order = groupItemsByOrder(allItems).find(o => o.order_id === result.item.order_id);
      if (order) {
        Modal.alert('✅', 'Order Selesai', `Semua item untuk ${order.table_name} sudah selesai!`);
      }
    }
  } catch (err) {
    Modal.alert('', 'Gagal', 'Gagal menandai item selesai.');
  }
}

// ── Undo complete item ────────────────────────────────────────
async function undoCompleteItem(itemId) {
  try {
    const result = await API.undoCompleteItem(itemId);
    // Update UI lokal
    const item = allItems.find(i => i.id === itemId);
    if (item) item.completed_at = null;
    renderOrders();
  } catch (err) {
    Modal.alert('', 'Gagal', 'Gagal mengembalikan item.');
  }
}

// ── Event listeners ───────────────────────────────────────────
document.getElementById('refreshBtn').addEventListener('click', () => {
  loadData();
  // Animasi tombol refresh
  const btn = document.getElementById('refreshBtn');
  btn.style.transform = 'rotate(180deg)';
  setTimeout(() => { btn.style.transform = 'rotate(0)'; }, 300);
});

// ── Auto refresh setiap 10 detik ────────────────────────────���─
function startAutoRefresh() {
  if (refreshInterval) clearInterval(refreshInterval);
  refreshInterval = setInterval(loadData, 10000); // 10 detik
}

// ── Init ──────────────────────────────────────────────────────
async function init() {
  updateTime();
  setInterval(updateTime, 1000);
  await loadData();
  startAutoRefresh();
}

// Expose functions ke global scope untuk onclick di HTML
window.completeItem = completeItem;
window.undoCompleteItem = undoCompleteItem;

init();