// ===== PAGE: Bar Dashboard =====
const STATION      = 'bar';
const STATION_ICON = '🍹';
const EMPTY_MSG    = 'Tidak ada pesanan di bar saat ini.';

let activeItems = [];   // order yang masih pending (ditampilkan di grid)
let logItems    = [];   // order yang sudah selesai semua (sidebar log)
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

// ── Group items by order ──────────────────────────────────────
function groupByOrder(items) {
  const map = {};
  items.forEach(item => {
    if (!map[item.order_id]) {
      map[item.order_id] = {
        order_id: item.order_id,
        table_name: item.table_name,
        kasir_name: item.kasir_name,
        order_note: item.order_note,
        order_created: item.order_created,
        items: [],
        allCompleted: true,
      };
    }
    map[item.order_id].items.push(item);
    if (!item.completed_at) map[item.order_id].allCompleted = false;
  });
  return Object.values(map);
}

// ── Render grid utama (hanya order yang ada item pending) ─────
function renderGrid() {
  const grid = document.getElementById('ordersGrid');
  const orders = groupByOrder(activeItems).filter(o => !o.allCompleted);

  if (!orders.length) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">${STATION_ICON}</div>
        <div>${EMPTY_MSG}</div>
        <div style="font-size:.9rem;opacity:.7;margin-top:.5rem">Tunggu pesanan dari kasir...</div>
      </div>`;
    return;
  }

  grid.innerHTML = orders.map(order => {
    const pending   = order.items.filter(i => !i.completed_at);
    const completed = order.items.filter(i =>  i.completed_at);
    return `
      <div class="order-card">
        <div class="order-header">
          <div>
            <div class="order-table">${order.table_name}</div>
            <div class="order-time">⏱ ${formatElapsed(order.order_created)}</div>
            <div class="order-kasir">Kasir: ${order.kasir_name}</div>
          </div>
          <div class="status-badge status-pending">PENDING</div>
        </div>
        <div class="order-items">
          ${pending.map(item => `
            <div class="order-item">
              <div>
                <div class="item-name">${item.name}</div>
                <div class="item-actions" style="margin-top:.3rem">
                  <button class="btn btn-success btn-sm" onclick="completeItem(${item.id})">✓ Selesai</button>
                </div>
              </div>
              <span class="item-qty">×${item.qty}</span>
            </div>`).join('')}
          ${completed.length ? `
            <div style="margin-top:.5rem;padding-top:.5rem;border-top:1px dashed #e5e7eb;font-size:.8rem;color:#9ca3af">
              ${completed.map(i => `
                <div style="display:flex;justify-content:space-between;padding:.2rem 0">
                  <span style="text-decoration:line-through">${i.name}</span>
                  <span>×${i.qty} ✅</span>
                </div>`).join('')}
            </div>` : ''}
        </div>
        ${order.order_note ? `<div class="order-note"><strong>Catatan:</strong> ${order.order_note}</div>` : ''}
      </div>`;
  }).join('');
}

// ── Render sidebar log ────────────────────────────────────────
function renderLog() {
  const list  = document.getElementById('logList');
  const badge = document.getElementById('logBadge');
  const orders = groupByOrder(logItems);

  badge.textContent = orders.length || '';
  badge.style.display = orders.length ? 'inline-flex' : 'none';

  if (!orders.length) {
    list.innerHTML = '<div style="padding:1rem;color:#94a3b8;font-size:.85rem;text-align:center">Belum ada log hari ini</div>';
    return;
  }

  list.innerHTML = orders.map(order => `
    <div class="log-entry">
      <div class="log-entry-header">
        <span class="log-table">${order.table_name}</span>
        <span class="log-time">${formatElapsed(order.order_created)}</span>
      </div>
      <div class="log-items">
        ${order.items.map(i => `<span class="log-item-chip">${i.name} ×${i.qty}</span>`).join('')}
      </div>
    </div>`).join('');
}

// ── Load data ─────────────────────────────────────────────────
async function loadData() {
  try {
    const items = await API.getStationItems(STATION);
    // Pisahkan: order yang masih ada pending item → grid, semua selesai → log
    const byOrder = groupByOrder(items);
    activeItems = items.filter(i => {
      const order = byOrder.find(o => o.order_id === i.order_id);
      return order && !order.allCompleted;
    });
    logItems = items.filter(i => {
      const order = byOrder.find(o => o.order_id === i.order_id);
      return order && order.allCompleted;
    });
    renderGrid();
    renderLog();
  } catch (err) {
    console.error('Gagal load data:', err);
    if (!activeItems.length) {
      document.getElementById('ordersGrid').innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">⚠️</div>
          <div>Tidak dapat terhubung ke server.</div>
        </div>`;
    }
  }
}

// ── Complete item ─────────────────────────────────────────────
async function completeItem(itemId) {
  try {
    const result = await API.completeItem(itemId);
    const item = activeItems.find(i => i.id === itemId);
    if (item) item.completed_at = result.item.completed_at;

    // Cek apakah semua item di order ini sudah selesai
    const orderId = result.item.order_id;
    const orderItems = activeItems.filter(i => i.order_id === orderId);
    const allDone = orderItems.every(i => i.completed_at);

    if (allDone) {
      // Pindahkan ke log, hapus dari active
      logItems.push(...orderItems);
      activeItems = activeItems.filter(i => i.order_id !== orderId);
    }

    renderGrid();
    renderLog();
  } catch (err) {
    Modal.alert('', 'Gagal', 'Gagal menandai item selesai.');
  }
}

// ── Toggle sidebar log ────────────────────────────────────────
function toggleLog() {
  const sidebar = document.getElementById('logSidebar');
  sidebar.classList.toggle('open');
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

// ── Auto refresh setiap 15 detik ─────────────────────────────
function startAutoRefresh() {
  if (refreshInterval) clearInterval(refreshInterval);
  refreshInterval = setInterval(loadData, 15000);
}

// ── Init ──────────────────────────────────────────────────────
async function init() {
  updateTime();
  setInterval(updateTime, 1000);
  await loadData();
  startAutoRefresh();
}

window.completeItem = completeItem;
init();
