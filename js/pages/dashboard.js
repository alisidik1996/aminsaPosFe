// ===== PAGE: Dashboard (Pilih Meja) =====
const session = requireAuth();
if (!session) throw new Error('Not authenticated');

document.getElementById('kasirName').textContent    = '' + session.name;
document.getElementById('currentDate').textContent  = new Date().toLocaleDateString('id-ID', {
  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
});

document.getElementById('logoutBtn').addEventListener('click', () => {
  Modal.confirm('', 'Logout', 'Yakin ingin logout?', () => {
    sessionStorage.removeItem('pos_session');
    window.location.href = 'index.html';
  }, 'Ya, Logout', 'Batal', 'btn-danger');
});

let selectedTableId = null;

async function renderTables() {
  const tables = await API.getTables();
  const grid   = document.getElementById('tableGrid');
  grid.innerHTML = '';
  tables.forEach(table => {
    const card = document.createElement('div');
    card.className = `table-card ${table.status}`;
    const timeInfo = table.status === 'occupied' && table.openedAt
      ? `<div class="table-time">${getElapsed(table.openedAt)}</div>` : '';
    card.innerHTML = `
      <div class="table-icon">${table.status === 'available' ? '' : ''}</div>
      <div class="table-name">${table.name}</div>
      <div class="table-status">${table.status === 'available' ? 'Tersedia' : 'Terisi'}</div>
      ${timeInfo}
    `;
    card.addEventListener('click', () => openTableModal(table));
    grid.appendChild(card);
  });
}

async function openTableModal(table) {
  selectedTableId = table.id;
  const confirmBtn = document.getElementById('modalConfirm');
  const voidBtn    = document.getElementById('modalVoid');
  document.getElementById('modalTitle').textContent = table.name;
  voidBtn.classList.add('hidden');

  const bill = await API.getBillByTable(table.id).catch(() => null);

  if (bill && bill.status === 'unpaid') {
    if (table.status === 'available') {
      await API.updateTable(table.id, { status: 'occupied', openedAt: bill.createdAt, kasirId: bill.kasirId });
      renderTables();
    }
    document.getElementById('modalDesc').textContent = `Ada tagihan UNPAID sebesar ${formatRp(bill.total)}.`;
    confirmBtn.textContent = 'Lihat Bill & Bayar';
    confirmBtn.className   = 'btn btn-success';
  } else if (table.status === 'available') {
    document.getElementById('modalDesc').textContent = 'Meja kosong. Buka pesanan baru?';
    confirmBtn.textContent = 'Buka Meja';
    confirmBtn.className   = 'btn btn-primary';
  } else {
    const order = await API.getActiveOrderByTable(table.id).catch(() => null);
    if (order && order.status === 'open') {
      document.getElementById('modalDesc').textContent = 'Meja terisi. Lanjutkan pesanan?';
      confirmBtn.textContent = 'Lanjut Pesanan';
      confirmBtn.className   = 'btn btn-primary';
      if (!order.items?.length) voidBtn.classList.remove('hidden');
    } else {
      document.getElementById('modalDesc').textContent = 'Meja terisi tapi tidak ada tagihan aktif.';
      confirmBtn.textContent = 'Lanjut Pesanan';
      confirmBtn.className   = 'btn btn-primary';
      voidBtn.classList.remove('hidden');
    }
  }
  document.getElementById('tableModal').classList.remove('hidden');
}

document.getElementById('modalCancel').addEventListener('click', () => {
  document.getElementById('tableModal').classList.add('hidden');
  selectedTableId = null;
});

document.getElementById('modalVoid').addEventListener('click', () => {
  if (!selectedTableId) return;
  Modal.confirm('', 'Batalkan Meja', 'Batalkan dan kosongkan meja ini?', async () => {
    const order = await API.getActiveOrderByTable(selectedTableId).catch(() => null);
    if (order) await API.updateOrder(order.id, { status: 'cancelled' });
    await API.updateTable(selectedTableId, { status: 'available', openedAt: null, kasirId: null });
    document.getElementById('tableModal').classList.add('hidden');
    selectedTableId = null;
    renderTables();
  }, 'Ya, Batalkan', 'Batal', 'btn-danger');
});

document.getElementById('modalConfirm').addEventListener('click', async () => {
  if (!selectedTableId) return;
  const table = await API.getTable(selectedTableId);
  const bill  = await API.getBillByTable(selectedTableId).catch(() => null);

  if (bill && bill.status === 'unpaid') {
    sessionStorage.setItem('pos_current_table', selectedTableId);
    sessionStorage.setItem('pos_current_bill',  bill.id);
    window.location.href = 'bill.html';
    return;
  }

  if (table.status === 'available') {
    const newOrder = await API.createOrder({ tableId: selectedTableId, kasirId: session.id, kasirName: session.name });
    await API.updateTable(selectedTableId, { status: 'occupied', openedAt: new Date().toISOString(), kasirId: session.id });
    sessionStorage.setItem('pos_current_table', selectedTableId);
    sessionStorage.setItem('pos_current_order', newOrder.id);
  } else {
    let openOrder = await API.getOrderByTable(selectedTableId).catch(() => null);
    if (!openOrder) openOrder = await API.createOrder({ tableId: selectedTableId, kasirId: session.id, kasirName: session.name });
    sessionStorage.setItem('pos_current_table', selectedTableId);
    sessionStorage.setItem('pos_current_order', openOrder.id);
  }
  window.location.href = 'order.html';
});

renderTables();
setInterval(renderTables, 30000);
