// ===== COMPONENT: Menu Grid =====
// Render kartu menu dan handle klik tambah ke cart

const MenuGrid = {
  _onAdd: null,

  /**
   * @param {HTMLElement} container
   * @param {Array} items - array menu dari API
   * @param {Function} onAdd - callback(item) saat menu diklik
   */
  render(container, items, onAdd) {
    this._onAdd = onAdd;
    container.innerHTML = '';

    if (!items.length) {
      container.innerHTML = '<div class="menu-empty">Tidak ada menu ditemukan</div>';
      return;
    }

    items.forEach(item => {
      const div = document.createElement('div');
      div.className = 'menu-item' + (item.stock === 0 ? ' unavailable' : '');

      const stockClass = item.stock <= 5 ? 'stock-low' : item.stock <= 10 ? 'stock-mid' : 'stock-ok';
      const stockLabel = item.stock === 0 ? 'Habis' : `Stok: ${item.stock}`;

      div.innerHTML = `
        <img src="${item.image || ''}" alt="${item.name}" class="item-image"
             onerror="this.style.background='#e2e8f0';this.src=''" />
        <div class="item-name">${item.name}</div>
        <div class="item-price">${formatRp(item.price)}</div>
        <div class="item-stock ${stockClass}">${stockLabel}</div>
      `;

      if (item.stock > 0) {
        div.addEventListener('click', (e) => {
          e.stopPropagation();
          if (this._onAdd) this._onAdd(item);
        });
      }

      container.appendChild(div);
    });
  },
};
