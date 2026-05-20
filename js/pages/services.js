// ===== PAGE: Service Dashboard =====
// Untuk waiter/service staff melihat status semua order

let allOrders = [];
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

// ── Load data dari kedua station ──────────────────────────────
async function loadData() {
  try {
    const [kitchenItems, barItems] = await Promise.all([
      API.getStationItems('kitchen').catch(() => []),
      API.getStationItems('bar').catch(() => []),
    ]);
    
    // Gabungkan semua items
    const allItems = [...kitchenItems, ...barItems];
    
    // Group by order
    const orders = {};
    allItems.forEach(item => {
      if (!orders[item.order_id]) {
        orders[item.order_id] = {
          order_id: item.order_id,
          table_id: item.table_id,
          table_name: item.table_name,
          kasir_name: item.kasir_name,
          order_note: item.order_note,
          order_created: item.order_created,
          items: [],
          kitchenPending: 0,
          barPending: 0,
          kitchenCompleted: 0,
          barCompleted: 0,
        };
      }
      orders[item.order_id].items.push(item);
      if (item.station === 'kitchen') {
        if (item.completed_at) orders[item.order_id].kitchenCompleted++;
        else orders[item.order_id].kitchenPending++;
      } else if (item.station === 'bar') {
        if (item.completed_at) orders[item.order_id].barCompleted++;
        else orders[item.order_id].barPending++;
      }
    });
    
    allOrders = Object.values(orders);
    renderOrders();
  } catch (err) {
    console.error('Gagal load data:', err);
    if (allOrders.length === 0) {
      document.getElementById('ordersGrid').innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">⚠️</div>
          <div>Tidak dapat terhubung ke server.</div>
          <div style="font-size:.9rem;color:#0369a1;margin-top:.5rem">Pastikan backend berjalan di localhost:3000</div>
        </div>
      `;
    }
  }
}

// ── Render orders ─────────────────────────────────────────────
function renderOrders() {
  const grid = document.getElementById('ordersGrid');
  
  if (!allOrders.length) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">👨‍🍳</div>
        <div>Tidak ada pesanan aktif saat ini.</div>
        <div style="font-size:.9rem;color:#0284c7;margin-top:.5rem">Semua order sudah selesai atau belum ada pesanan</div>
      </div>
    `;
    return;
  }

  grid.innerHTML = allOrders.map(order => {
    const totalItems = order.items.length;
    const totalPending = order.kitchenPending + order.barPending;
    const totalCompleted = order.kitchenCompleted + order.barCompleted;
    const isReady = totalPending === 0 && totalCompleted > 0;
    
    return `
      <div class="order-card">
        <div class="order-header">
          <div>
            <div class="order-table">${order.table_name}</div>
            <div class="order-time">
              <span>⏱</span>
              <span>${formatElapsed(order.order_created)}</span>
            </div>
            <div class="order-kasir">Kasir: ${order.kasir_name}</div>
          </div>
          <div class="status-badge ${isReady ? 'status-ready' : 'status-pending'}">
            ${isReady ? 'SIAP DISAJIKAN' : 'DALAM PROSES'}
          </div>
        </div>
        <div class="order-items">
          <div style="display:flex;justify-content:space-between;margin-bottom:.75rem;font-size:.85rem">
            <div>
              <div style="color:#92400e;font-weight:600">🍳 Kitchen</div>
              <div>${order.kitchenCompleted}/${order.kitchenCompleted + order.kitchenPending} selesai</div>
            </div>
            <div style="text-align:right">
              <div style="color:#1e40af;font-weight:600">🍹 Bar</div>
              <div>${order.barCompleted}/${order.barCompleted + order.barPending} selesai</div>
            </div>
          </div>
          ${order.items.slice(0, 3).map(item => `
            <div class="order-item">
              <div>
                <div class="item-name">${item.name}</div>
                <div class="item-station">${item.station === 'kitchen' ? '🍳 Kitchen' : '🍹 Bar'} • ${item.completed_at ? '✅ Selesai' : '⏳ Proses'}</div>
              </div>
              <span class="item-qty">×${item.qty}</span>
            </div>
          `).join('')}
          ${order.items.length > 3 ? `
            <div style="text-align:center;padding:.5rem;color:#64748b;font-size:.85rem">
              +${order.items.length - 3} item lainnya
            </div>
          ` : ''}
        </div>
        ${order.order_note ? `
          <div class="order-note">
            <strong>Catatan:</strong> ${order.order_note}
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
}

// ── Event listeners ───────────────────────────────────────────
document.getElementById('refreshBtn').addEventListener('click', () => {
  loadData();
  // Animasi tombol refresh
  const btn = document.getElementById('refreshBtn');
  btn.style.transform = 'rotate(180deg)';
  setTimeout(() => { btn.style.transform = 'rotate(0)'; }, 300);
});

// ── Auto refresh setiap 10 detik ──────────────────────────────
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

init();