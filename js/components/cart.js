// ===== COMPONENT: Cart =====
// Mengelola state cart dan render ke DOM
// Validasi stok dilakukan di sisi client (UX) — backend tetap jadi penjaga akhir

const Cart = {
  _items:    [],
  _onChange: null,
  _stockMap: {},   // { menuId: availableStock } — diisi dari MENU_DATA di order.js

  /**
   * Inisialisasi cart dengan items dari order yang sudah ada
   * @param {Array}    items    - items dari order sebelumnya
   * @param {Function} onChange - callback saat cart berubah
   */
  init(items = [], onChange) {
    this._items    = JSON.parse(JSON.stringify(items));
    this._onChange = onChange;
    this._stockMap = {};
  },

  /**
   * Update peta stok dari MENU_DATA terbaru
   * Dipanggil setiap kali MENU_DATA di-refresh di order.js
   * @param {Array} menuList - array menu dari API
   */
  updateStock(menuList = []) {
    this._stockMap = {};
    menuList.forEach(m => { this._stockMap[m.id] = m.stock; });
  },

  getItems()  { return this._items; },
  getTotal()  { return this._items.reduce((s, i) => s + i.price * i.qty, 0); },
  isEmpty()   { return this._items.length === 0; },

  /**
   * Tambah item ke cart dengan validasi stok
   * @returns {string|null} pesan error jika stok tidak cukup, null jika berhasil
   */
  add(item) {
    const existing  = this._items.find(c => c.id === item.id);
    const inCart    = existing ? existing.qty : 0;
    const available = this._stockMap[item.id] ?? item.stock ?? Infinity;

    if (inCart >= available) {
      return `Stok "${item.name}" tidak cukup. Tersedia: ${available}, sudah di cart: ${inCart}.`;
    }

    if (existing) {
      existing.qty++;
    } else {
      this._items.push({
        id:      item.id,
        name:    item.name,
        price:   item.price,
        station: item.station,
        image:   item.image || '',
        qty:     1,
        stock:   available,   // simpan stok untuk validasi tombol +
      });
    }
    this._notify();
    return null;
  },

  /**
   * Ubah qty item di cart dengan validasi stok
   * @returns {string|null} pesan error jika stok tidak cukup, null jika berhasil
   */
  changeQty(itemId, delta) {
    const idx = this._items.findIndex(c => c.id === itemId);
    if (idx === -1) return null;

    const item      = this._items[idx];
    const newQty    = item.qty + delta;
    const available = this._stockMap[itemId] ?? item.stock ?? Infinity;

    if (newQty > available) {
      return `Stok "${item.name}" tidak cukup. Maksimal: ${available}.`;
    }

    if (newQty <= 0) {
      this._items.splice(idx, 1);
    } else {
      this._items[idx].qty = newQty;
    }
    this._notify();
    return null;
  },

  clear() {
    this._items = [];
    this._notify();
  },

  _notify() {
    if (this._onChange) this._onChange(this._items);
  },

  /**
   * Render cart items ke container DOM
   * @param {HTMLElement} container
   * @param {HTMLElement} emptyEl
   * @param {HTMLElement} totalEl
   */
  render(container, emptyEl, totalEl) {
    Array.from(container.children).forEach(child => {
      if (child !== emptyEl) child.remove();
    });

    if (this._items.length === 0) {
      emptyEl.classList.remove('hidden');
      totalEl.textContent = 'Rp 0';
      return;
    }

    emptyEl.classList.add('hidden');
    let total = 0;

    this._items.forEach(item => {
      const subtotal  = item.price * item.qty;
      const available = this._stockMap[item.id] ?? item.stock ?? Infinity;
      const atMax     = item.qty >= available;
      total += subtotal;

      const div = document.createElement('div');
      div.className = 'order-item';

      const infoDiv = document.createElement('div');
      infoDiv.style.flex = '1';
      infoDiv.innerHTML = `
        <div class="oi-name">${item.name}</div>
        <div class="oi-sub">${formatRp(item.price)} · ${item.station === 'kitchen' ? '🍳' : '🍹'}</div>
        ${atMax ? `<div style="font-size:.72rem;color:var(--danger);margin-top:.1rem">Stok maks: ${available}</div>` : ''}
      `;

      const qtyDiv = document.createElement('div');
      qtyDiv.className = 'oi-qty';

      const btnMinus = document.createElement('button');
      btnMinus.className   = 'qty-btn';
      btnMinus.textContent = '−';
      btnMinus.setAttribute('aria-label', `Kurangi ${item.name}`);
      btnMinus.addEventListener('click', (e) => {
        e.stopPropagation();
        const err = this.changeQty(item.id, -1);
        if (err) Modal.alert('', 'Stok Tidak Cukup', err);
      });

      const qtySpan = document.createElement('span');
      qtySpan.className   = 'qty-num';
      qtySpan.textContent = item.qty;

      const btnPlus = document.createElement('button');
      btnPlus.className   = 'qty-btn';
      btnPlus.textContent = '+';
      btnPlus.setAttribute('aria-label', `Tambah ${item.name}`);
      // Disable tombol + jika sudah mencapai batas stok
      if (atMax) {
        btnPlus.disabled = true;
        btnPlus.style.opacity = '0.35';
        btnPlus.style.cursor  = 'not-allowed';
      }
      btnPlus.addEventListener('click', (e) => {
        e.stopPropagation();
        const err = this.changeQty(item.id, 1);
        if (err) Modal.alert('', 'Stok Tidak Cukup', err);
      });

      qtyDiv.append(btnMinus, qtySpan, btnPlus);

      const priceDiv = document.createElement('div');
      priceDiv.className   = 'oi-price';
      priceDiv.textContent = formatRp(subtotal);

      div.append(infoDiv, qtyDiv, priceDiv);
      container.appendChild(div);
    });

    totalEl.textContent = formatRp(total);
  },
};
