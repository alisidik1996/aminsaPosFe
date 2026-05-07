// ===== BILL & PAYMENT PAGE =====
const session = JSON.parse(sessionStorage.getItem('pos_session') || 'null');
if (!session) window.location.href = 'index.html';

const tableId = parseInt(sessionStorage.getItem('pos_current_table'));
const billId  = parseInt(sessionStorage.getItem('pos_current_bill'));
if (!tableId || !billId) window.location.href = 'dashboard.html';

let table = null;
let bill  = null;

function formatRp(n) { return 'Rp ' + n.toLocaleString('id-ID'); }
function formatDate(iso) {
  return new Date(iso).toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

// ── Init ──────────────────────────────────────────────────────
async function init() {
  table = await API.getTable(tableId);
  bill  = await API.getBill(billId);
  if (!bill) { window.location.href = 'dashboard.html'; return; }

  document.getElementById('kasirName').textContent  = '👤 ' + session.name;
  document.getElementById('tableLabel').textContent = table?.name || '';

  renderBill();
}

document.getElementById('backBtn').addEventListener('click', () => {
  window.location.href = 'dashboard.html';
});

document.getElementById('addOrderBtn').addEventListener('click', async () => {
  // Buat order baru (status open) untuk meja ini
  const newOrder = await API.createOrder({ tableId, kasirId: session.id, kasirName: session.name });
  // Simpan bill id agar order.js tahu harus link ke bill mana setelah kirim
  sessionStorage.setItem('pos_current_order',    newOrder.id);
  sessionStorage.setItem('pos_current_bill',     billId);   // tetap bill yang sama
  sessionStorage.setItem('pos_append_to_bill',   billId);   // flag: append ke bill ini
  window.location.href = 'order.html';
});

// ── Render bill ───────────────────────────────────────────────
function renderBill() {
  document.getElementById('billTableName').textContent = `📍 ${bill.tableName}`;
  document.getElementById('billDate').textContent      = `📅 ${formatDate(bill.createdAt)}`;
  document.getElementById('billKasir').textContent     = `👤 ${bill.kasirName}`;
  document.getElementById('billStatus').innerHTML      =
    `<span class="status-badge ${bill.status}">${bill.status.toUpperCase()}</span>`;

  const itemsEl = document.getElementById('billItems');
  itemsEl.innerHTML = '';
  bill.items.forEach(item => {
    const div = document.createElement('div');
    div.className = 'bill-item';
    div.innerHTML = `
      <span class="bi-name">${item.name}</span>
      <span class="bi-qty">x${item.qty}</span>
      <span class="bi-price">${formatRp(item.price * item.qty)}</span>
    `;
    itemsEl.appendChild(div);
  });

  document.getElementById('subtotal').textContent   = formatRp(bill.subtotal);
  document.getElementById('taxAmount').textContent  = formatRp(bill.tax);
  document.getElementById('grandTotal').textContent = formatRp(bill.total);
  document.getElementById('billNote').textContent   = bill.note ? `📝 ${bill.note}` : '';

  if (bill.status === 'paid') {
    document.getElementById('payBtn').disabled    = true;
    document.getElementById('payBtn').textContent = '✓ Sudah Dibayar';
    document.getElementById('addOrderBtn').disabled = true;
  }
}

// ── Payment method toggle ─────────────────────────────────────
document.querySelectorAll('input[name="payMethod"]').forEach(radio => {
  radio.addEventListener('change', function () {
    document.getElementById('cashSection').classList.toggle('hidden',  this.value !== 'cash');
    document.getElementById('debitSection').classList.toggle('hidden', this.value !== 'debit');
    document.getElementById('payError').classList.add('hidden');
  });
});

// ── Kembalian ─────────────────────────────────────────────────
document.getElementById('cashInput').addEventListener('input', updateChange);

function updateChange() {
  const paid   = parseInt(document.getElementById('cashInput').value) || 0;
  const change = paid - bill.total;
  const el     = document.getElementById('changeAmount');
  el.textContent = change >= 0 ? formatRp(change) : `- ${formatRp(Math.abs(change))} (kurang)`;
  el.style.color = change >= 0 ? 'var(--success)' : 'var(--danger)';
}

// ── Format kartu ──────────────────────────────────────────────
document.getElementById('cardNumber').addEventListener('input', function () {
  const val = this.value.replace(/\D/g, '').substring(0, 16);
  this.value = val.replace(/(.{4})/g, '$1-').replace(/-$/, '');
});

// ── Proses bayar ──────────────────────────────────────────────
document.getElementById('payBtn').addEventListener('click', processPayment);

async function processPayment() {
  const method = document.querySelector('input[name="payMethod"]:checked').value;
  const errEl  = document.getElementById('payError');
  errEl.classList.add('hidden');

  let paymentDetail = {};

  if (method === 'cash') {
    const paid = parseInt(document.getElementById('cashInput').value) || 0;
    if (paid < bill.total) {
      errEl.textContent = `Jumlah bayar kurang. Minimal ${formatRp(bill.total)}`;
      errEl.classList.remove('hidden');
      return;
    }
    paymentDetail = { paid, change: paid - bill.total };
  } else {
    const cardNumber = document.getElementById('cardNumber').value.trim();
    const cardHolder = document.getElementById('cardHolder').value.trim();
    const bankName   = document.getElementById('bankName').value;
    if (!cardNumber || cardNumber.replace(/-/g, '').length < 16) {
      errEl.textContent = 'Nomor kartu tidak valid (16 digit).';
      errEl.classList.remove('hidden'); return;
    }
    if (!cardHolder) {
      errEl.textContent = 'Nama pemegang kartu wajib diisi.';
      errEl.classList.remove('hidden'); return;
    }
    if (!bankName) {
      errEl.textContent = 'Pilih bank terlebih dahulu.';
      errEl.classList.remove('hidden'); return;
    }
    paymentDetail = { cardNumber, cardHolder, bankName };
  }

  bill = await API.updateBill(billId, {
    status: 'paid',
    paidAt: new Date().toISOString(),
    paymentMethod: method,
    paymentDetail,
  });

  await API.updateOrder(bill.orderId, { status: 'closed' });
  await API.updateTable(tableId, { status: 'available', openedAt: null, kasirId: null });

  renderBill();
  showSuccessModal(method, paymentDetail);
}

function showSuccessModal(method, detail) {
  const modal    = document.getElementById('successModal');
  const detailEl = document.getElementById('successDetail');
  let html = `<strong>${table.name}</strong><br>`;
  html += `Total: <strong>${formatRp(bill.total)}</strong><br>`;
  html += `Metode: <strong>${method === 'cash' ? 'Cash' : 'Debit'}</strong><br>`;
  if (method === 'cash') {
    html += `Bayar: ${formatRp(detail.paid)}<br>`;
    html += `Kembalian: <strong style="color:var(--success)">${formatRp(detail.change)}</strong>`;
  } else {
    html += `Bank: ${detail.bankName}<br>Kartu: ${detail.cardNumber}<br>Atas nama: ${detail.cardHolder}`;
  }
  detailEl.innerHTML = html;
  modal.classList.remove('hidden');
}

document.getElementById('doneBtn').addEventListener('click', () => {
  sessionStorage.removeItem('pos_current_order');
  sessionStorage.removeItem('pos_current_bill');
  window.location.href = 'dashboard.html';
});

init();
