// ===== PAGE: Bill & Payment =====
const session = requireAuth();
if (!session) throw new Error('Not authenticated');

const tableId = parseInt(sessionStorage.getItem('pos_current_table'));
const billId  = parseInt(sessionStorage.getItem('pos_current_bill'));
if (!tableId || !billId) window.location.href = 'dashboard.html';

let table     = null;
let bill      = null;
let settings  = {};   // merchant settings (nama, logo, footer, dll)

// ── Init ──────────────────────────────────────────────────────
async function init() {
  [table, bill, settings] = await Promise.all([
    API.getTable(tableId),
    API.getBill(billId),
    API.getSettings().catch(() => ({})),
  ]);
  if (!bill) { window.location.href = 'dashboard.html'; return; }

  // Terapkan nama & logo merchant dari settings ke navbar/header
  const merchantName = settings.merchant_name || 'CafePos';
  document.querySelectorAll('.bill-logo, .nav-brand-text').forEach(el => {
    el.textContent = merchantName;
  });
  // Tampilkan logo di header bill jika ada
  const logoEl = document.getElementById('billLogoImg');
  if (logoEl) {
    if (settings.merchant_logo) {
      logoEl.src = settings.merchant_logo;
      logoEl.classList.remove('hidden');
    } else {
      logoEl.classList.add('hidden');
    }
  }

  document.getElementById('kasirName').textContent  = '' + session.name;
  document.getElementById('tableLabel').textContent = table?.name || '';
  renderBill();
}

document.getElementById('backBtn').addEventListener('click', () => {
  window.location.href = 'dashboard.html';
});

document.getElementById('addOrderBtn').addEventListener('click', async () => {
  // Gunakan getActiveOrderByTable agar order berstatus 'sent' juga terdeteksi
  let order = await API.getActiveOrderByTable(tableId).catch(() => null);
  if (!order || order.status !== 'open') {
    // Buat order baru jika tidak ada order open
    order = await API.createOrder({ tableId, kasirId: session.id, kasirName: session.name });
  }
  sessionStorage.setItem('pos_current_order', order.id);
  sessionStorage.setItem('pos_append_to_bill', billId);
  window.location.href = 'order.html';
});

// ── Render bill ───────────────────────────────────────────────
function renderBill() {
  document.getElementById('billTableName').textContent = `${bill.tableName}`;
  document.getElementById('billDate').textContent      = `${formatDate(bill.createdAt)}`;
  document.getElementById('billKasir').textContent     = `${bill.kasirName}`;
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
  document.getElementById('billNote').textContent   = bill.note ? `${bill.note}` : '';

  // Render tombol quick cash
  renderQuickCash();

  if (bill.status === 'paid') {
    document.getElementById('payBtn').disabled      = true;
    document.getElementById('payBtn').textContent   = 'Sudah Dibayar';
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
document.getElementById('cashInput').addEventListener('input', () => {
  const paid   = parseInt(document.getElementById('cashInput').value) || 0;
  const change = paid - bill.total;
  const el     = document.getElementById('changeAmount');
  el.textContent = change >= 0 ? formatRp(change) : `- ${formatRp(Math.abs(change))} (kurang)`;
  el.style.color = change >= 0 ? 'var(--success)' : 'var(--danger)';
});

// ── Quick cash buttons ────────────────────────────────────────
function renderQuickCash() {
  const total = bill.total;
  // Nominal bulat di atas total
  const bases = [5000, 10000, 20000, 50000, 100000];
  const suggestions = [];
  // Tambah nominal pas
  suggestions.push(total);
  // Tambah nominal bulat terdekat
  for (const base of bases) {
    const rounded = Math.ceil(total / base) * base;
    if (!suggestions.includes(rounded) && suggestions.length < 4) {
      suggestions.push(rounded);
    }
  }
  suggestions.sort((a, b) => a - b);

  const container = document.getElementById('quickCash');
  container.innerHTML = suggestions.slice(0, 4).map(amount => `
    <button type="button" class="btn btn-outline btn-sm quick-cash-btn"
      onclick="document.getElementById('cashInput').value=${amount};document.getElementById('cashInput').dispatchEvent(new Event('input'))">
      ${formatRp(amount)}
    </button>`).join('');
}

// Hanya izinkan angka di field 4 digit terakhir kartu
document.getElementById('cardLast4').addEventListener('input', function () {
  this.value = this.value.replace(/\D/g, '').substring(0, 4);
});

// ── Proses bayar ──────────────────────────────────────────────
document.getElementById('payBtn').addEventListener('click', async () => {
  const payBtn = document.getElementById('payBtn');
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
    const bankName  = document.getElementById('bankName').value;
    const cardLast4 = document.getElementById('cardLast4').value.trim();
    if (!bankName) {
      errEl.textContent = 'Pilih bank terlebih dahulu.';
      errEl.classList.remove('hidden'); return;
    }
    if (!cardLast4 || cardLast4.length !== 4) {
      errEl.textContent = '4 digit terakhir nomor kartu wajib diisi.';
      errEl.classList.remove('hidden'); return;
    }
    paymentDetail = { bankName, cardLast4 };
  }

  // Disable tombol untuk cegah double-submit
  payBtn.disabled    = true;
  payBtn.textContent = 'Memproses...';

  try {
    bill = await API.updateBill(billId, {
      status: 'paid',
      paidAt: new Date().toISOString(),
      paymentMethod: method,
      paymentDetail,
    });
    // Tutup semua order yang terkait dengan bill ini
    const orderIds = bill.orderIds?.length ? bill.orderIds : [bill.orderId];
    for (const oid of orderIds) {
      await API.updateOrder(oid, { status: 'closed' }).catch(() => {});
    }
    await API.updateTable(tableId, { status: 'available', openedAt: null, kasirId: null });
    renderBill();

    // Tampilkan modal sukses
    const detailEl = document.getElementById('successDetail');
    let html = `<strong>${table.name}</strong><br>`;
    html += `Total: <strong>${formatRp(bill.total)}</strong><br>`;
    html += `Metode: <strong>${method === 'cash' ? 'Cash' : 'Debit'}</strong><br>`;
    if (method === 'cash') {
      html += `Bayar: ${formatRp(paymentDetail.paid)}<br>`;
      html += `Kembalian: <strong style="color:var(--success)">${formatRp(paymentDetail.change)}</strong>`;
    } else {
      html += `Bank: ${paymentDetail.bankName}<br>`;
      html += `Kartu: ****-****-****-${paymentDetail.cardLast4}`;
    }
    detailEl.innerHTML = html;
    document.getElementById('successModal').classList.remove('hidden');
  } catch (err) {
    errEl.textContent = err.message || 'Gagal memproses pembayaran.';
    errEl.classList.remove('hidden');
    payBtn.disabled    = false;
    payBtn.textContent = 'Proses Pembayaran';
  }
});

// ── Print struk ───────────────────────────────────────────────
function buildReceiptHTML(isPaid) {
  const merchantName    = settings.merchant_name    || 'CafePos';
  const merchantAddress = settings.merchant_address || '';
  const merchantPhone   = settings.merchant_phone   || '';
  const merchantSocial  = settings.merchant_social  || '';
  const receiptFooter   = settings.receipt_footer   || 'Terima kasih atas kunjungan Anda!';
  const logoBase64      = settings.merchant_logo    || '';

  const itemRows = bill.items.map(i =>
    `<tr>
      <td>${i.name}</td>
      <td style="text-align:center">x${i.qty}</td>
      <td style="text-align:right">${formatRp(i.price * i.qty)}</td>
    </tr>`
  ).join('');

  let paymentInfo = '';
  if (isPaid && bill.paymentMethod) {
    paymentInfo = `<tr><td colspan="3" style="padding-top:6px;border-top:1px dashed #000"></td></tr>`;
    if (bill.paymentMethod === 'cash') {
      const d = bill.paymentDetail || {};
      paymentInfo += `
        <tr><td>Metode</td><td></td><td style="text-align:right">Cash</td></tr>
        <tr><td>Bayar</td><td></td><td style="text-align:right">${formatRp(d.paid || 0)}</td></tr>
        <tr><td><strong>Kembalian</strong></td><td></td><td style="text-align:right"><strong>${formatRp(d.change || 0)}</strong></td></tr>
      `;
    } else {
      const d = bill.paymentDetail || {};
      paymentInfo += `
        <tr><td>Metode</td><td></td><td style="text-align:right">Debit</td></tr>
        <tr><td>Bank</td><td></td><td style="text-align:right">${d.bankName || '-'}</td></tr>
        <tr><td>Kartu</td><td></td><td style="text-align:right">****-****-****-${d.cardLast4 || '****'}</td></tr>
      `;
    }
  }

  const logoHTML = logoBase64
    ? `<img src="${logoBase64}" style="max-width:80px;max-height:60px;object-fit:contain;margin-bottom:6px;display:block;margin-left:auto;margin-right:auto" />`
    : '';

  const addressHTML = merchantAddress
    ? `<div style="font-size:10px;color:#444;margin-top:2px">${merchantAddress.replace(/\n/g, '<br>')}</div>`
    : '';
  const phoneHTML  = merchantPhone  ? `<div style="font-size:10px;color:#444">${merchantPhone}</div>`  : '';
  const socialHTML = merchantSocial ? `<div style="font-size:10px;color:#444">${merchantSocial}</div>` : '';

  return `
    <div style="font-family:'Courier New',monospace;font-size:12px;width:280px;margin:0 auto;color:#000">
      <div style="text-align:center;margin-bottom:8px">
        ${logoHTML}
        <div style="font-size:16px;font-weight:bold">${merchantName}</div>
        ${addressHTML}${phoneHTML}${socialHTML}
        <div style="font-size:11px;margin-top:4px">${formatDate(bill.createdAt)}</div>
        <div style="font-size:11px">Kasir: ${bill.kasirName}</div>
        <div style="font-size:11px">Meja: ${bill.tableName}</div>
        <div style="font-size:11px">No. Bill: #${bill.id}</div>
      </div>
      <div style="border-top:1px dashed #000;border-bottom:1px dashed #000;padding:4px 0;margin-bottom:4px">
        <table style="width:100%;border-collapse:collapse;font-size:11px">
          <thead>
            <tr>
              <th style="text-align:left">Item</th>
              <th style="text-align:center">Qty</th>
              <th style="text-align:right">Harga</th>
            </tr>
          </thead>
          <tbody>
            ${itemRows}
          </tbody>
        </table>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:11px">
        <tr><td>Subtotal</td><td></td><td style="text-align:right">${formatRp(bill.subtotal)}</td></tr>
        <tr><td>PPN (10%)</td><td></td><td style="text-align:right">${formatRp(bill.tax)}</td></tr>
        <tr>
          <td><strong>TOTAL</strong></td>
          <td></td>
          <td style="text-align:right"><strong>${formatRp(bill.total)}</strong></td>
        </tr>
        ${paymentInfo}
      </table>
      ${bill.note ? `<div style="margin-top:6px;font-size:11px;border-top:1px dashed #000;padding-top:4px">Catatan: ${bill.note}</div>` : ''}
      <div style="text-align:center;margin-top:10px;font-size:11px;border-top:1px dashed #000;padding-top:6px">
        ${isPaid
          ? `<strong>LUNAS</strong><br>${receiptFooter}`
          : '<em>** BELUM DIBAYAR **</em>'
        }
      </div>
    </div>
  `;
}

function printReceipt() {
  const isPaid   = bill.status === 'paid';
  const content  = buildReceiptHTML(isPaid);
  const printWin = window.open('', '_blank', 'width=350,height=600');
  printWin.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Struk #${bill.id}</title>
      <style>
        body { margin: 0; padding: 10px; background: #fff; }
        @media print {
          body { margin: 0; padding: 0; }
          @page { margin: 5mm; size: 80mm auto; }
        }
      </style>
    </head>
    <body>
      ${content}
      <script>
        window.onload = function() {
          window.print();
          window.onafterprint = function() { window.close(); };
        };
      <\/script>
    </body>
    </html>
  `);
  printWin.document.close();
}

// Tombol print di bill panel (sebelum/sesudah bayar)
document.getElementById('printBtn').addEventListener('click', printReceipt);

// Tombol print di success modal (setelah bayar)
document.getElementById('printAfterPayBtn').addEventListener('click', printReceipt);

// ── Selesai ───────────────────────────────────────────────────
document.getElementById('doneBtn').addEventListener('click', () => {
  sessionStorage.removeItem('pos_current_order');
  sessionStorage.removeItem('pos_current_bill');
  window.location.href = 'dashboard.html';
});

init();
