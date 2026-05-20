// ===== PAGE: Service Dashboard =====
// Waiter melihat status order — siap disajikan atau masih diproses

let allOrders  = [];   // order aktif (ditampilkan di grid)
let logOrders  = [];   // order yang sudah disajikan (sidebar log)
let refreshInterval = null;

// ── Waktu ─────────────────────────────────────────────────────
function updateTime() {
  document.getElementById('currentTime').textContent =
    new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatElapsed(iso) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 1) return 'Baru saja';
  if (diff < 60) return `${diff} mnt lalu`;
  return `${Math.floor(diff / 60)} jam ${diff % 60} mnt lalu`;
}

// ── Load data ─────────────────────────────────────────────────
async function loadData() {
  try {
    const [kitchenItems, barItems] = await Promise.all([
      API.getStationItems('kitchen').catch(() => []),
      API.getStationItems('bar').catch(() => []),
    ]);

    const allItems = [...kitchenItems, ...barItems];
    const map = {};

    allItems.forEach(item => {
      if (!map[item.order_id]) {
        map[item.order_id] = {
          order_id:      item.order_id,
          table_name:    item.table_name,
          kasir_name:    item.kasir_name,
          order_note:    item.order_note,
          order_created: item.order_created,
          items:         [],
          pendingCount:  0,
          totalCount:    0,
          served:        false,   // ditandai sudah disajikan oleh waiter
        };
      }
      map[item.order_id].items.push(item);
      map[item.order_id].totalCount++;
      if (!item.completed_at) map[item.order_id].pendingCount++;
    });

    // Pertahankan status 'served' dari state sebelumnya
    const prevServed = new Set([...logOrders.map(o => o.order_id)]);
    const orders = Object.values(map);

    allOrders = orders.filter(o => !prevServed.has(o.order_id));
    // logOrders tetap dari state sebelumnya (tidak di-reset saat refresh)

    renderGrid();
    renderLog();
  } catch (err) {
    console.error('Gagal load data:', err);
    if (!allOrders.length) {
      document.getElementById('ordersGrid').innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">⚠️</div>
          <div>Tidak dapat terhubung ke server.</div>
        </div>`;
    }
  }
}

// ── Render grid ───────────────────────────────────────────────
function renderGrid() {
  const grid = document.getElementById('ordersGrid');

  if (!allOrders.length) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">👨‍🍳</div>
        <div>Tidak ada pesanan aktif saat ini.</div>
        <div style="font-size:.9rem;opacity:.7;margin-top:.5rem">Semua sudah disajikan atau belum ada pesanan</div>
      </div>`;
    return;
  }

  grid.innerHTML = allOrders.map(order => {
    const isReady = order.pendingCount === 0 && order.totalCount > 0;
    const kitchenItems = order.items.filter(i => i.station === 'kitchen');
    const barItems     = order.items.filter(i => i.station === 'bar');
    const kitchenDone  = kitchenItems.filter(i => i.completed_at).length;
    const barDone      = barItems.filter(i => i.completed_at).length;

    return `
      <div class="order-card ${isReady ? 'ready' : ''}">
        <div class="order-header ${isReady ? 'ready' : ''}">
          <div>
            <div class="order-table">${order.table_name}</div>
            <div class="order-time">⏱ ${formatElapsed(order.order_created)}</div>
            <div class="order-kasir">Kasir: ${order.kasir_name}</div>
          </div>
          <div class="status-badge ${isReady ? 'status-ready' : 'status-pending'}">
            ${isReady ? '✅ SIAP DISAJIKAN' : '⏳ DALAM PROSES'}
          </div>
        </div>
        <div class="order-items">
          <div style="display:flex;gap:1rem;margin-bottom:.75rem;font-size:.85rem">
            ${kitchenItems.length ? `
              <div>
                <div style="font-weight:600;color:#92400e">🍳 Kitchen</div>
                <div>${kitchenDone}/${kitchenItems.length} selesai</div>
              </div>` : ''}
            ${barItems.length ? `
              <div>
                <div style="font-weight:600;color:#1e40af">🍹 Bar</div>
                <div>${barDone}/${barItems.length} selesai</div>
              </div>` : ''}
          </div>
          ${order.items.map(item => `
            <div class="order-item">
              <div>
                <div class="item-name">${item.name}</div>
                <div style="font-size:.75rem;color:#64748b">
                  ${item.station === 'kitchen' ? '🍳' : '🍹'}
                  ${item.completed_at ? '<span style="color:#15803d">✅ Selesai</span>' : '<span style="color:#b45309">⏳ Proses</span>'}
                </div>
              </div>
              <span class="item-qty">×${item.qty}</span>
            </div>`).join('')}
        </div>
        ${order.order_note ? `<div class="order-note"><strong>Catatan:</strong> ${order.order_note}</div>` : ''}
        ${isReady ? `
          <div style="padding:.75rem 1.25rem;border-top:1px solid #e5e7eb">
            <button class="btn btn-primary btn-full" onclick="markServed(${order.order_id})">
              🍽️ Sudah Disajikan
            </button>
          </div>` : ''}
      </div>`;
  }).join('');
}

// ── Render sidebar log ────────────────────────────────────────
function renderLog() {
  const list  = document.getElementById('logList');
  const badge = document.getElementById('logBadge');

  badge.textContent = logOrders.length || '';
  badge.style.display = logOrders.length ? 'inline-flex' : 'none';

  if (!logOrders.length) {
    list.innerHTML = '<div style="padding:1rem;color:#94a3b8;font-size:.85rem;text-align:center">Belum ada log hari ini</div>';
    return;
  }

  list.innerHTML = logOrders.map(order => `
    <div class="log-entry">
      <div class="log-entry-header">
        <span class="log-table">${order.table_name}</span>
        <span class="log-time">${formatElapsed(order.order_created)}</span>
      </div>
      <div class="log-items">
        ${order.items.map(i => `<span class="log-item-chip">${i.name} ×${i.qty}</span>`).join('')}
      </div>
      <div style="font-size:.75rem;color:#15803d;margin-top:.3rem">🍽️ Sudah disajikan</div>
    </div>`).join('');
}

// ── Mark order sudah disajikan ────────────────────────────────
function markServed(orderId) {
  const order = allOrders.find(o => o.order_id === orderId);
  if (!order) return;
  order.served = true;
  logOrders.unshift(order);                              // tambah ke atas log
  allOrders = allOrders.filter(o => o.order_id !== orderId);
  renderGrid();
  renderLog();
}

// ── Toggle sidebar log ────────────────────────────────────────
function toggleLog() {
  document.getElementById('logSidebar').classList.toggle('open');
}

// ── Event listeners ───────────────────────────────────────────
document.getElementById('refreshBtn').addEventListener('click', () => {
  loadData();
  const btn = document.getElementById('refreshBtn');
  btn.style.transform = 'rotate(180deg)';
  setTimeout(() => { btn.style.transform = ''; }, 300);
});

document.getElementById('logToggleBtn').addEventListener('click', toggleLog);
document.getElementById('logCloseBtn').addEventListener('click', toggleLog);

function startAutoRefresh() {
  if (refreshInterval) clearInterval(refreshInterval);
  refreshInterval = setInterval(loadData, 15000);
}

async function init() {
  updateTime();
  setInterval(updateTime, 1000);
  await loadData();
  startAutoRefresh();
}

window.markServed = markServed;
init();
