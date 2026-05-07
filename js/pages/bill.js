// ===== PAGE: Bill & Payment =====
const session = requireAuth();
if (!session) throw new Error('Not authenticated');

const tableId = parseInt(sessionStorage.getItem('pos_current_table'));
const billId  = parseInt(sessionStorage.getItem('pos_current_bill'));
if (!tableId || !billId) window.location.href = 'dashboard.html';

let table = null;
let bill  = null;

async function init() {
  table = await API.getTable(tableId);
  bill  = await API.getBill(billId);
  if (!bill) { window.location.href = 'dashboard.html'; return; }
  document.getElementById('kasirName').textContent  = '👤 ' + session.name;
  document.getElementById('tableLabel').textContent = table?.name || '';
  renderBill();
}

document.getElementById('backBtn').addEventListener('click', () => { window.location.href = 'dashboard.html'; });

document.getElementById('addOrderBtn').addEventListener('click', async () => {
  let order = await API.getOrderByTable(tableId).catch(() => null);
  if (!order || order.status !== 'open') {
    order = await API.createOrder({ tableId, kasirId: session.id, kasirName: session.name });
  }
  sessionStorage.setItem('pos_current_order', order.id);
  sessionStorage.setItem('pos_append_to_bill', billId);
  window.location.href = 'order.html';
});

function renderBill() {
  document.getElementById('billTableName').textContent = `📍 ${bill.tableName}`;
  document.getElementById('billDate').textContent      = `📅 ${formatDate(bill.createdAt)}`;
  document.getElementById('billKasir').textContent     = `👤 ${bill.kasirName}`;
  document.getElementById('billStatus').innerHTML      = `<span class="status-badge ${bill.status}">${bill.status.toUpperCase()}</span>`;

  const itemsEl = document.getElementById('billItems');
  itemsEl.innerHTML = '';
  bill.items.forEach(item => {
    const div = document.createElement('div');
    div.className = 'bill-item';
    div.innerHTML = `<span class="bi-name">${item.name}</span><span class="bi-qty">x${item.qty}</span><span class="bi-price">${formatRp(item.price * item.qty)}</span>`;
    itemsEl.appendChild(div);
  });

  document.getElementById('subtotal').textContent   = formatRp(bill.subtotal);
  document.getElementById('taxAmount').textContent  = formatRp(bill.tax);
  document.getElementById('grandTotal').textContent = formatRp(bill.total);
  document.getElementById('billNote').textContent   = bill.note ? `📝 ${bill.note}` : '';

  if (bill.status === 'paid') {
    document.getElementById('payBtn').disabled      = true;
    document.getElementById('payBtn').textContent   = '✓ Sudah Dibayar';
    document.getElementById('addOrderBtn').disabled = true;
  }
}

document.querySelectorAll('input[name="payMethod"]').forEach(radio => {
  radio.addEventListener('change', function () {
    document.getElementById('cashSection').classList.toggle('hidden',  this.value !== 'cash');
    document.getElementById('debitSection').classList.toggle('hidden', this.value !== 'debit');
    document.getElementById('payError').classList.add('hidden');
  });
});

document.getElementById('cashInput').addEventListener('input', () => {
  const paid   = parseInt(document.getElementById('cashInput').value) || 0;
  const change = paid - bill.total;
  const el     = document.getElementById('changeAmount');
  el.textContent = change >= 0 ? formatRp(change) : `- ${formatRp(Math.abs(change))} (kurang)`;
  el.style.color = change >= 0 ? 'var(--success)' : 'var(--danger)';
});

document.getElementById('cardNumber').addEventListener('input', function () {
  const val = this.value.replace(/\D/g, '').substring(0, 16);
  this.value = val.replace(/(.{4})/g, '$1-').replace(/-$/, '');
});

document.getElementById('payBtn').addEventListener('click', async () => {
  const method = document.querySelector('input[name="payMethod"]:checked').value;
  const errEl  = document.getElementById('payError');
  errEl.classList.add('hidden');
  let paymentDetail = {};

  if (method === 'cash') {
    const paid = parseInt(document.getElementById('cashInput').value) || 0;
    if (paid < bill.total) {
      errEl.textContent = `Jumlah bayar kurang. Minimal ${formatRp(bill.total)}`;
      errEl.classList.remove('hidden'); return;
    }
    paymentDetail = { paid, change: paid - bill.total };
  } else {
    const cardNumber = document.getElementById('cardNumber').value.trim();
    const cardHolder = document.getElementById('cardHolder').value.trim();
    const bankName   = document.getElementById('bankName').value;
    if (!cardNumber || cardNumber.replace(/-/g, '').length < 16) { errEl.textContent = 'Nomor kartu tidak valid.'; errEl.classList.remove('hidden'); return; }
    if (!cardHolder) { errEl.textContent = 'Nama pemegang kartu wajib diisi.'; errEl.classList.remove('hidden'); return; }
    if (!bankName)   { errEl.textContent = 'Pilih bank terlebih dahulu.'; errEl.classList.remove('hidden'); return; }
    paymentDetail = { cardNumber, cardHolder, bankName };
  }

  bill = await API.updateBill(billId, { status: 'paid', paidAt: new Date().toISOString(), paymentMethod: method, paymentDetail });
  await API.updateOrder(bill.orderId, { status: 'closed' });
  await API.updateTable(tableId, { status: 'available', openedAt: null, kasirId: null });
  renderBill();

  const modal    = document.getElementById('successModal');
  const detailEl = document.getElementById('successDetail');
  let html = `<strong>${table.name}</strong><br>Total: <strong>${formatRp(bill.total)}</strong><br>Metode: <strong>${method === 'cash' ? 'Cash' : 'Debit'}</strong><br>`;
  if (method === 'cash') html += `Bayar: ${formatRp(paymentDetail.paid)}<br>Kembalian: <strong style="color:var(--success)">${formatRp(paymentDetail.change)}</strong>`;
  else html += `Bank: ${paymentDetail.bankName}<br>Kartu: ${paymentDetail.cardNumber}<br>Atas nama: ${paymentDetail.cardHolder}`;
  detailEl.innerHTML = html;
  modal.classList.remove('hidden');
});

document.getElementById('doneBtn').addEventListener('click', () => {
  sessionStorage.removeItem('pos_current_order');
  sessionStorage.removeItem('pos_current_bill');
  window.location.href = 'dashboard.html';
});

init();
