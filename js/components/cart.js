// ===== COMPONENT: Cart =====
// Mengelola state cart dan render ke DOM

const Cart = {
  _items: [],
  _onChange: null,

  /** Inisialisasi cart dengan items dari order yang sudah ada */
  init(items = [], onChange) {
    this._items = JSON.parse(JSON.stringify(items));
    this._onChange = onChange;
  },

  getItems() { return this._items; },

  getTotal() {
    return this._items.reduce((s, i) => s + i.price * i.qty, 0);
  },

  isEmpty() { return this._items.length === 0; },

  add(item) {
    const existing = this._items.find(c => c.id === item.id);
    if (existing) {
      existing.qty++;
    } else {
      this._items.push({
        id: item.id, name: item.name, price: item.price,
        station: item.station, image: item.image || '', qty: 1,
      });
    }
    this._notify();
  },

  changeQty(itemId, delta) {
    const idx = this._items.findIndex(c => c.id === itemId);
    if (idx === -1) return;
    this._items[idx].qty += delta;
    if (this._items[idx].qty <= 0) this._items.splice(idx, 1);
    this._notify();
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
    // Hapus semua kecuali emptyEl
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
      const subtotal = item.price * item.qty;
      total += subtotal;

      const div = document.createElement('div');
      div.className = 'order-item';

      const infoDiv = document.createElement('div');
      infoDiv.style.flex = '1';
      infoDiv.innerHTML = `
        <div class="oi-name">${item.name}</div>
        <div class="oi-sub">${formatRp(item.price)} · ${item.station === 'kitchen' ? '🍳' : '🍹'}</div>
      `;

      const qtyDiv = document.createElement('div');
      qtyDiv.className = 'oi-qty';

      const btnMinus = document.createElement('button');
      btnMinus.className = 'qty-btn';
      btnMinus.textContent = '−';
      btnMinus.addEventListener('click', (e) => { e.stopPropagation(); this.changeQty(item.id, -1); });

      const qtySpan = document.createElement('span');
      qtySpan.className = 'qty-num';
      qtySpan.textContent = item.qty;

      const btnPlus = document.createElement('button');
      btnPlus.className = 'qty-btn';
      btnPlus.textContent = '+';
      btnPlus.addEventListener('click', (e) => { e.stopPropagation(); this.changeQty(item.id, 1); });

      qtyDiv.append(btnMinus, qtySpan, btnPlus);

      const priceDiv = document.createElement('div');
      priceDiv.className = 'oi-price';
      priceDiv.textContent = formatRp(subtotal);

      div.append(infoDiv, qtyDiv, priceDiv);
      container.appendChild(div);
    });

    totalEl.textContent = formatRp(total);
  },
};
