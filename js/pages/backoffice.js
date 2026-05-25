// ===== PAGE: Backoffice =====
const session = requireAdmin();
if (!session) throw new Error('Not admin');

// ── XSS helper — escape semua data dari server sebelum masuk innerHTML ──
function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

document.getElementById('boKasirName').textContent = '' + session.name;

document.getElementById('boLogoutBtn').addEventListener('click', () => {
  Modal.confirm('', 'Logout', 'Yakin ingin logout?', () => {
    sessionStorage.removeItem('pos_session');
    window.location.href = 'index.html';
  }, 'Ya, Logout', 'Batal', 'btn-danger');
});

// ── Tab navigation ────────────────────────────────────────────
let activeTab = 'items';

document.querySelectorAll('.bo-nav-item').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

function switchTab(tab) {
  activeTab = tab;
  document.querySelectorAll('.bo-nav-item').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.bo-tab').forEach(s => s.classList.toggle('active', s.id === `tab-${tab}`));
  const titles = {
    items: 'Item', categories: 'Kategori', stock: 'Manajemen Stok',
    ingredients: 'Bahan Baku', recipes: 'Resep',
    void: 'Void', users: 'Users', settings: 'Pengaturan',
  };
  document.getElementById('boPageTitle').textContent = titles[tab];
  const addBtn = document.getElementById('boAddBtn');
  addBtn.style.display  = ['stock', 'void', 'settings'].includes(tab) ? 'none' : '';
  addBtn.textContent    = tab === 'users' ? '+ Tambah User'
    : tab === 'categories' ? '+ Tambah Kategori'
    : tab === 'ingredients' ? '+ Tambah Bahan'
    : tab === 'recipes' ? '+ Buat Resep'
    : '+ Tambah Item';

  if (tab === 'items')       loadMenu();
  if (tab === 'categories')  loadCategories();
  if (tab === 'stock')       loadStock();
  if (tab === 'ingredients') loadIngredients();
  if (tab === 'recipes')     loadRecipes();
  if (tab === 'void')        loadVoid();
  if (tab === 'users')       loadUsers();
  if (tab === 'settings')    loadSettings();
}

document.getElementById('boAddBtn').addEventListener('click', () => {
  if (activeTab === 'items')       openMenuModal(null);
  if (activeTab === 'categories')  openCategoryModal(null);
  if (activeTab === 'users')       openUserModal(null);
  if (activeTab === 'ingredients') openIngredientModal(null);
  if (activeTab === 'recipes')     openRecipeModal(null);
});

// ══ ITEMS (MENU) ══════════════════════════════════════════════
let allMenuItems = [];
let allCategories = [];

async function loadMenu() {
  try {
    [allMenuItems, allCategories] = await Promise.all([
      API.getAllMenu(),
      API.getCategories(),
    ]);
    const cats = [...new Set(allMenuItems.map(m => m.category))];
    const sel  = document.getElementById('menuCatFilter');
    sel.innerHTML = '<option value="">Semua Kategori</option>';
    cats.forEach(c => sel.innerHTML += `<option value="${c}">${escHtml(c)}</option>`);
    renderMenuTable(allMenuItems);
  } catch (err) {
    Modal.alert('', 'Gagal Memuat', 'Gagal memuat data menu: ' + err.message);
  }
}

function renderMenuTable(items) {
  const tbody = document.getElementById('menuTbody');
  if (!items.length) { tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:2rem">Tidak ada item</td></tr>'; return; }
  tbody.innerHTML = items.map(item => `
    <tr>
      <td><img src="${escHtml(item.image || '')}" class="menu-thumb" onerror="this.style.background='#e2e8f0';this.src=''" /></td>
      <td><strong>${escHtml(item.name)}</strong></td>
      <td>${escHtml(item.category)}</td>
      <td><span class="bo-badge bo-badge-${escHtml(item.station)}">${item.station === 'kitchen' ? 'Kitchen' : 'Bar'}</span></td>
      <td>${formatRp(item.price)}</td>
      <td><span class="item-stock ${item.stock <= 5 ? 'stock-low' : item.stock <= 10 ? 'stock-mid' : 'stock-ok'}">${item.stock}</span></td>
      <td><span class="bo-badge ${item.active ? 'bo-badge-active' : 'bo-badge-inactive'}">${item.active ? 'Aktif' : 'Nonaktif'}</span></td>
      <td><div class="bo-actions">
        <button class="btn btn-outline btn-sm" onclick="openMenuModal(${item.id})">Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deleteMenu(${item.id}, '${escHtml(item.name).replace(/'/g, '&#39;')}')">🗑</button>
      </div></td>
    </tr>
  `).join('');
}

document.getElementById('menuSearch').addEventListener('input', filterMenu);
document.getElementById('menuCatFilter').addEventListener('change', filterMenu);
function filterMenu() {
  const q   = document.getElementById('menuSearch').value.toLowerCase();
  const cat = document.getElementById('menuCatFilter').value;
  let items = allMenuItems;
  if (cat) items = items.filter(m => m.category === cat);
  if (q)   items = items.filter(m => m.name.toLowerCase().includes(q));
  renderMenuTable(items);
}

let editingMenuId = null;
async function openMenuModal(id) {
  editingMenuId = id;
  document.getElementById('menuModalTitle').textContent = id ? 'Edit Item' : 'Tambah Item';
  document.getElementById('menuForm').reset();
  document.getElementById('mPreviewWrap').style.display = 'none';
  
  // Populate kategori dropdown
  const catSel = document.getElementById('mCategory');
  catSel.innerHTML = '<option value="">-- Pilih Kategori --</option>';
  allCategories.forEach(c => {
    catSel.innerHTML += `<option value="${c.name}" data-station="${c.station}">${c.name}</option>`;
  });
  
  const stockField = document.getElementById('mStock');
  const stationField = document.getElementById('mStation');
  
  if (id) {
    const item = allMenuItems.find(m => m.id === id);
    if (item) {
      document.getElementById('mName').value     = item.name;
      document.getElementById('mPrice').value    = item.price;
      catSel.value                               = item.category;
      stationField.value                         = item.station;
      stockField.value                           = item.stock;
      document.getElementById('mActive').value   = item.active;
      document.getElementById('mImage').value    = item.image || '';
      if (item.image) { document.getElementById('mPreview').src = item.image; document.getElementById('mPreviewWrap').style.display = ''; }
    }
    // Disable stok field saat edit
    stockField.disabled = true;
    stockField.style.backgroundColor = '#f1f5f9';
    stockField.style.cursor = 'not-allowed';
    document.getElementById('mStockHint').textContent = '(edit di tab Stok)';
  } else {
    // Enable stok field saat tambah item baru
    stockField.disabled = false;
    stockField.style.backgroundColor = '';
    stockField.style.cursor = '';
    document.getElementById('mStockHint').textContent = '';
  }
  
  document.getElementById('menuModal').classList.remove('hidden');
}

// Auto-fill stasiun saat kategori dipilih
document.getElementById('mCategory').addEventListener('change', function() {
  const opt = this.options[this.selectedIndex];
  if (opt && opt.dataset.station) {
    document.getElementById('mStation').value = opt.dataset.station;
  }
});

document.getElementById('mImage').addEventListener('input', function () {
  const wrap = document.getElementById('mPreviewWrap');
  if (this.value) { document.getElementById('mPreview').src = this.value; wrap.style.display = ''; }
  else wrap.style.display = 'none';
});

document.getElementById('menuModalCancel').addEventListener('click', () => document.getElementById('menuModal').classList.add('hidden'));

document.getElementById('menuForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = {
    name: document.getElementById('mName').value.trim(),
    price: parseInt(document.getElementById('mPrice').value),
    category: document.getElementById('mCategory').value,
    station: document.getElementById('mStation').value,
    active: parseInt(document.getElementById('mActive').value),
    image: document.getElementById('mImage').value.trim(),
  };
  // Stok hanya disertakan saat tambah item baru (saat edit, field disabled)
  if (!editingMenuId) {
    data.stock = parseInt(document.getElementById('mStock').value) || 0;
  }
  const saveBtn = document.getElementById('menuModalSave');
  saveBtn.disabled = true; saveBtn.textContent = 'Menyimpan...';
  try {
    if (editingMenuId) await API.updateMenu(editingMenuId, data);
    else await API.addMenu(data);
    document.getElementById('menuModal').classList.add('hidden');
    await loadMenu();
  } catch (err) { Modal.alert('', 'Gagal', err.message); }
  finally { saveBtn.disabled = false; saveBtn.textContent = 'Simpan'; }
});

async function deleteMenu(id, name) {
  Modal.confirm('', 'Hapus Item', `Hapus item "${name}"?`, async () => {
    try { await API.deleteMenu(id); await loadMenu(); }
    catch (err) { Modal.alert('', 'Gagal', err.message); }
  }, 'Ya, Hapus', 'Batal', 'btn-danger');
}

// ══ CATEGORIES ════════════════════════════════════════════════
async function loadCategories() {
  try {
    allCategories = await API.getCategories();
    renderCategoriesTable(allCategories);
  } catch (err) {
    Modal.alert('', 'Gagal Memuat', 'Gagal memuat kategori: ' + err.message);
  }
}

function renderCategoriesTable(cats) {
  const tbody = document.getElementById('catTbody');
  if (!cats.length) { tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:var(--text-muted);padding:2rem">Tidak ada kategori</td></tr>'; return; }
  tbody.innerHTML = cats.map(c => `
    <tr>
      <td><strong>${escHtml(c.name)}</strong></td>
      <td><span class="bo-badge bo-badge-${escHtml(c.station)}">${c.station === 'kitchen' ? 'Kitchen' : 'Bar'}</span></td>
      <td><div class="bo-actions">
        <button class="btn btn-outline btn-sm" onclick="openCategoryModal(${c.id})">Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deleteCategory(${c.id}, '${escHtml(c.name).replace(/'/g, '&#39;')}')">🗑</button>
      </div></td>
    </tr>
  `).join('');
}

let editingCategoryId = null;
function openCategoryModal(id) {
  editingCategoryId = id;
  document.getElementById('catModalTitle').textContent = id ? 'Edit Kategori' : 'Tambah Kategori';
  document.getElementById('catForm').reset();
  if (id) {
    const cat = allCategories.find(c => c.id === id);
    if (cat) {
      document.getElementById('cName').value = cat.name;
      document.getElementById('cStation').value = cat.station;
    }
  }
  document.getElementById('catModal').classList.remove('hidden');
}

document.getElementById('catModalCancel').addEventListener('click', () => document.getElementById('catModal').classList.add('hidden'));

document.getElementById('catForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = {
    name: document.getElementById('cName').value.trim(),
    station: document.getElementById('cStation').value,
  };
  const saveBtn = document.getElementById('catModalSave');
  saveBtn.disabled = true; saveBtn.textContent = 'Menyimpan...';
  try {
    if (editingCategoryId) await API.updateCategory(editingCategoryId, data);
    else await API.addCategory(data);
    document.getElementById('catModal').classList.add('hidden');
    await loadCategories();
  } catch (err) { Modal.alert('', 'Gagal', err.message); }
  finally { saveBtn.disabled = false; saveBtn.textContent = 'Simpan'; }
});

async function deleteCategory(id, name) {
  Modal.confirm('', 'Hapus Kategori', `Hapus kategori "${name}"?\n\nKategori yang masih digunakan tidak bisa dihapus.`, async () => {
    try { await API.deleteCategory(id); await loadCategories(); }
    catch (err) { Modal.alert('', 'Gagal', err.message); }
  }, 'Ya, Hapus', 'Batal', 'btn-danger');
}

// ══ STOCK ═════════════════════════════════════════════════════
let allStockItems  = [];
let stockSummary   = null;

async function loadStock() {
  try {
    stockSummary  = await API.getStockSummary();
    allStockItems = stockSummary.menu;
    renderStockDashboard();
    renderStockTable(allStockItems);
  } catch (err) {
    Modal.alert('', 'Gagal Memuat', 'Gagal memuat data stok: ' + err.message);
  }
}

// ── Kartu ringkasan stok ──────────────────────────────────────
function renderStockDashboard() {
  const el = document.getElementById('stockDashboard');
  if (!el || !stockSummary) return;
  const { totalMenu, totalIngredients, totalRecipes, lowStockCount } = stockSummary;
  el.innerHTML = `
    <div class="stock-stat-cards">
      <div class="stock-stat-card">
        <div class="stock-stat-num">${totalMenu}</div>
        <div class="stock-stat-label">Total Item Menu</div>
      </div>
      <div class="stock-stat-card">
        <div class="stock-stat-num">${totalIngredients}</div>
        <div class="stock-stat-label">Bahan Baku</div>
      </div>
      <div class="stock-stat-card">
        <div class="stock-stat-num">${totalRecipes}</div>
        <div class="stock-stat-label">Resep Terdaftar</div>
      </div>
      <div class="stock-stat-card ${lowStockCount > 0 ? 'stock-stat-danger' : ''}">
        <div class="stock-stat-num">${lowStockCount}</div>
        <div class="stock-stat-label">Bahan Stok Rendah</div>
      </div>
    </div>
    ${lowStockCount > 0 ? `
      <div class="stock-alert">
        ⚠️ <strong>${lowStockCount} bahan baku</strong> di bawah stok minimum:
        ${stockSummary.lowStockIngredients.map(i =>
          `<span class="stock-alert-chip">${escHtml(i.name)} (${parseFloat(i.stock).toLocaleString('id-ID')} ${escHtml(i.unit)})</span>`
        ).join('')}
      </div>` : ''}
  `;
}

function renderStockTable(items) {
  const tbody = document.getElementById('stockTbody');
  if (!items.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:2rem">Tidak ada item</td></tr>';
    return;
  }
  tbody.innerHTML = items.map(item => {
    const buffer     = item.buffer_stock || 5;
    const stockClass = item.stock <= buffer ? 'stock-low' : item.stock <= buffer * 2 ? 'stock-mid' : 'stock-ok';
    const hasRecipe  = item.hasRecipe;
    const mismatch   = item.stockMismatch;
    return `
    <tr>
      <td><strong>${escHtml(item.name)}</strong></td>
      <td>${escHtml(item.category)}</td>
      <td>
        <span class="item-stock ${stockClass}">${item.stock}</span>
        ${mismatch ? `<span title="Stok tidak sinkron dengan bahan baku" style="color:var(--warning);margin-left:.3rem;cursor:help">⚠</span>` : ''}
      </td>
      <td>
        ${hasRecipe
          ? `<span class="bo-badge bo-badge-active">Ada Resep</span>
             <span style="font-size:.78rem;color:var(--text-muted);margin-left:.3rem">est. ${item.estimatedStock} porsi</span>`
          : `<span class="bo-badge bo-badge-inactive">Tanpa Resep</span>`}
      </td>
      <td><span class="bo-badge" style="background:#f1f5f9;color:#64748b">${buffer}</span></td>
      <td><button class="btn btn-outline btn-sm" onclick="openStockModal(${item.id})">Edit Stok</button></td>
    </tr>`;
  }).join('');
}

document.getElementById('stockSearch').addEventListener('input', function () {
  const q = this.value.toLowerCase();
  renderStockTable(allStockItems.filter(m => m.name.toLowerCase().includes(q)));
});

// Tombol sync semua stok dari bahan
document.getElementById('syncStockBtn')?.addEventListener('click', async () => {
  const btn = document.getElementById('syncStockBtn');
  btn.disabled = true; btn.textContent = 'Menyinkronkan...';
  try {
    const result = await API.syncAllStock();
    await loadStock();
    Modal.alert('', 'Sync Selesai', `${result.synced} menu berhasil disinkronkan dari bahan baku.`);
  } catch (err) { Modal.alert('', 'Gagal', err.message); }
  finally { btn.disabled = false; btn.textContent = '↻ Sync dari Bahan'; }
});

let editingStockItemId = null;
function openStockModal(id) {
  editingStockItemId = id;
  const item = allStockItems.find(m => m.id === id);
  if (!item) return;
  document.getElementById('smItemName').value = item.name;
  document.getElementById('smStock').value    = item.stock;
  document.getElementById('smBuffer').value   = item.buffer_stock || 5;
  document.getElementById('stockModal').classList.remove('hidden');
}

document.getElementById('stockModalCancel').addEventListener('click', () =>
  document.getElementById('stockModal').classList.add('hidden'));

document.getElementById('stockModalForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const stock  = parseInt(document.getElementById('smStock').value);
  const buffer = parseInt(document.getElementById('smBuffer').value);
  if (isNaN(stock) || stock < 0 || isNaN(buffer) || buffer < 0) {
    Modal.alert('', 'Input Tidak Valid', 'Stok dan buffer harus angka >= 0');
    return;
  }
  const saveBtn = document.getElementById('stockModalSave');
  saveBtn.disabled = true; saveBtn.textContent = 'Menyimpan...';
  try {
    await API.updateMenuStock(editingStockItemId, stock);
    const item = allStockItems.find(m => m.id === editingStockItemId);
    if (item) { item.stock = stock; item.buffer_stock = buffer; }
    document.getElementById('stockModal').classList.add('hidden');
    await loadStock();   // reload untuk update estimasi & mismatch
  } catch (err) { Modal.alert('', 'Gagal', err.message); }
  finally { saveBtn.disabled = false; saveBtn.textContent = 'Simpan'; }
});

// ══ VOID ══════════════════════════════════════════════════════
let activeTables = [];
let voidHistory = [];

async function loadVoid() {
  try {
    [activeTables, voidHistory] = await Promise.all([
      API.getTables().then(t => t.filter(t => t.status === 'occupied')),
      API.getVoidHistory(),
    ]);
    renderVoidTables();
    renderVoidHistory();
  } catch (err) {
    Modal.alert('', 'Gagal Memuat', 'Gagal memuat data void: ' + err.message);
  }
}

function renderVoidTables() {
  const grid = document.getElementById('voidTableGrid');
  if (!activeTables.length) {
    grid.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:2rem">Tidak ada meja aktif</div>';
    return;
  }
  grid.innerHTML = activeTables.map(t => `
    <div class="void-table-card" onclick="openVoidModal(${t.id}, '${escHtml(t.name).replace(/'/g, '&#39;')}')">
      <div class="void-table-icon">🪑</div>
      <div class="void-table-name">${escHtml(t.name)}</div>
      <div class="void-table-time">${getElapsed(t.openedAt)}</div>
    </div>
  `).join('');
}

function renderVoidHistory() {
  const tbody = document.getElementById('voidHistoryTbody');
  if (!voidHistory.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:2rem">Belum ada riwayat void</td></tr>';
    return;
  }
  tbody.innerHTML = voidHistory.map(v => `
    <tr>
      <td>${v.id}</td>
      <td>${escHtml(v.table_name)}</td>
      <td>${formatRp(v.total)}</td>
      <td>${escHtml(v.kasir_name)}</td>
      <td style="font-size:.8rem">${formatDate(v.created_at)}</td>
      <td style="font-size:.85rem;color:var(--text-muted)">${escHtml(v.note || '-')}</td>
    </tr>
  `).join('');
}

let voidingTableId = null;
function openVoidModal(tableId, tableName) {
  voidingTableId = tableId;
  document.getElementById('voidModalTitle').textContent = `Void ${tableName}`;
  document.getElementById('voidModalDesc').textContent = `Semua pesanan di ${tableName} akan dibatalkan dan meja akan direset.`;
  document.getElementById('voidReason').value = '';
  document.getElementById('voidModal').classList.remove('hidden');
}

document.getElementById('voidModalCancel').addEventListener('click', () => document.getElementById('voidModal').classList.add('hidden'));

document.getElementById('voidModalConfirm').addEventListener('click', async () => {
  const reason = document.getElementById('voidReason').value.trim();
  const btn = document.getElementById('voidModalConfirm');
  btn.disabled = true; btn.textContent = 'Memproses...';
  try {
    await API.voidTable(voidingTableId, reason);
    document.getElementById('voidModal').classList.add('hidden');
    await loadVoid();
    Modal.alert('', 'Berhasil', 'Meja berhasil di-void.');
  } catch (err) { Modal.alert('', 'Gagal', err.message); }
  finally { btn.disabled = false; btn.textContent = 'Ya, Void'; }
});

// ══ USERS ═════════════════════════════════════════════════════
let allUsers = [];
async function loadUsers() {
  try {
    allUsers = await API.getUsers();
    renderUsersTable(allUsers);
  } catch (err) {
    Modal.alert('', 'Gagal Memuat', 'Gagal memuat data user: ' + err.message);
  }
}

function renderUsersTable(users) {
  const tbody = document.getElementById('usersTbody');
  if (!users.length) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:2rem">Tidak ada user</td></tr>'; return; }
  tbody.innerHTML = users.map(u => `
    <tr>
      <td>${u.id}</td>
      <td><code>${escHtml(u.username)}</code></td>
      <td>${escHtml(u.name)}</td>
      <td><span class="bo-badge bo-badge-${escHtml(u.role)}">${escHtml(u.role)}</span></td>
      <td><div class="bo-actions">
        <button class="btn btn-outline btn-sm" onclick="openUserModal(${u.id})">Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deleteUser(${u.id}, '${escHtml(u.username).replace(/'/g, '&#39;')}')">🗑</button>
      </div></td>
    </tr>
  `).join('');
}

let editingUserId = null;
function openUserModal(id) {
  editingUserId = id;
  document.getElementById('userModalTitle').textContent = id ? 'Edit User' : 'Tambah User';
  document.getElementById('userForm').reset();
  if (id) {
    const u = allUsers.find(u => u.id === id);
    if (u) { document.getElementById('uUsername').value = u.username; document.getElementById('uName').value = u.name; document.getElementById('uRole').value = u.role; }
    document.getElementById('uPassword').placeholder = 'Kosongkan jika tidak diubah';
  }
  document.getElementById('userModal').classList.remove('hidden');
}

document.getElementById('userModalCancel').addEventListener('click', () => document.getElementById('userModal').classList.add('hidden'));

document.getElementById('userForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('uUsername').value.trim();
  const password = document.getElementById('uPassword').value;
  const name     = document.getElementById('uName').value.trim();
  const role     = document.getElementById('uRole').value;
  const data     = { username, name, role };
  if (password) data.password = password;

  const saveBtn = e.target.querySelector('button[type="submit"]');
  saveBtn.disabled = true; saveBtn.textContent = 'Menyimpan...';
  try {
    if (editingUserId) {
      await API.updateUser(editingUserId, data);
    } else {
      if (!password) { Modal.alert('', 'Password Wajib', 'Password wajib diisi untuk user baru.'); return; }
      await API.addUser(data);
    }
    document.getElementById('userModal').classList.add('hidden');
    await loadUsers();
  } catch (err) {
    Modal.alert('', 'Gagal', err.message);
  } finally {
    saveBtn.disabled = false; saveBtn.textContent = 'Simpan';
  }
});

async function deleteUser(id, username) {
  if (id === session.id) { Modal.alert('', 'Tidak Bisa', 'Tidak bisa menghapus akun yang sedang login.'); return; }
  Modal.confirm('', 'Hapus User', `Hapus user "${username}"?`, async () => {
    try { await API.deleteUser(id); await loadUsers(); }
    catch (err) { Modal.alert('', 'Gagal', err.message); }
  }, 'Ya, Hapus', 'Batal', 'btn-danger');
}

// ══ SETTINGS ══════════════════════════════════════════════════
let currentLogoBase64 = ''; // menyimpan logo aktif (base64 string)

async function loadSettings() {
  try {
    const settings = await API.getSettings();
    document.getElementById('sMerchantName').value    = settings.merchant_name || '';
    document.getElementById('sMerchantAddress').value = settings.merchant_address || '';
    document.getElementById('sMerchantPhone').value   = settings.merchant_phone || '';
    document.getElementById('sMerchantSocial').value  = settings.merchant_social || '';
    document.getElementById('sReceiptFooter').value   = settings.receipt_footer || '';

    // Load logo
    currentLogoBase64 = settings.merchant_logo || '';
    applyLogoPreview(currentLogoBase64);
  } catch (err) {
    Modal.alert('', 'Gagal Memuat', err.message);
  }
}

function applyLogoPreview(base64) {
  const img         = document.getElementById('logoPreview');
  const placeholder = document.getElementById('logoPlaceholder');
  const removeBtn   = document.getElementById('logoRemoveBtn');
  if (base64) {
    img.src = base64;
    img.classList.remove('hidden');
    placeholder.classList.add('hidden');
    removeBtn.classList.remove('hidden');
  } else {
    img.src = '';
    img.classList.add('hidden');
    placeholder.classList.remove('hidden');
    removeBtn.classList.add('hidden');
  }
}

// Pilih file gambar → convert ke Base64
document.getElementById('logoFileInput').addEventListener('change', function () {
  const file = this.files[0];
  if (!file) return;

  if (file.size > 500 * 1024) {
    Modal.alert('', 'File Terlalu Besar', 'Ukuran logo maksimal 500 KB.');
    this.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    currentLogoBase64 = e.target.result;
    applyLogoPreview(currentLogoBase64);
  };
  reader.readAsDataURL(file);
});

// Hapus logo
document.getElementById('logoRemoveBtn').addEventListener('click', () => {
  Modal.confirm('', 'Hapus Logo', 'Hapus logo merchant?', () => {
    currentLogoBase64 = '';
    applyLogoPreview('');
    document.getElementById('logoFileInput').value = '';
  }, 'Ya, Hapus', 'Batal', 'btn-danger');
});

document.getElementById('settingsForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = {
    merchant_name:    document.getElementById('sMerchantName').value.trim(),
    merchant_address: document.getElementById('sMerchantAddress').value.trim(),
    merchant_phone:   document.getElementById('sMerchantPhone').value.trim(),
    merchant_social:  document.getElementById('sMerchantSocial').value.trim(),
    receipt_footer:   document.getElementById('sReceiptFooter').value.trim(),
    merchant_logo:    currentLogoBase64,
  };
  const saveBtn = document.getElementById('settingsSaveBtn');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Menyimpan...';
  try {
    await API.updateSettings(data);
    Modal.alert('', 'Berhasil', 'Pengaturan berhasil disimpan.');
  } catch (err) {
    Modal.alert('', 'Gagal', err.message);
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Simpan Pengaturan';
  }
});

// ══ INGREDIENTS ═══════════════════════════════════════════════
let allIngredients = [];

async function loadIngredients() {
  try {
    allIngredients = await API.getIngredients();
    renderIngredientsTable(allIngredients);
  } catch (err) {
    Modal.alert('', 'Gagal Memuat', 'Gagal memuat bahan baku: ' + err.message);
  }
}

function renderIngredientsTable(items) {
  const tbody = document.getElementById('ingredientsTbody');
  if (!items.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:2rem">Belum ada bahan baku</td></tr>';
    return;
  }
  tbody.innerHTML = items.map(item => {
    const isLow = parseFloat(item.stock) <= parseFloat(item.min_stock) && parseFloat(item.min_stock) > 0;
    const stockClass = !item.active ? 'stock-low' : isLow ? 'stock-low' : parseFloat(item.stock) <= parseFloat(item.min_stock) * 2 ? 'stock-mid' : 'stock-ok';
    return `
    <tr>
      <td><strong>${escHtml(item.name)}</strong></td>
      <td><span class="bo-badge" style="background:#f1f5f9;color:#475569">${escHtml(item.unit)}</span></td>
      <td>
        <span class="item-stock ${stockClass}">${parseFloat(item.stock).toLocaleString('id-ID')} ${escHtml(item.unit)}</span>
        ${isLow ? '<span style="color:var(--danger);font-size:.75rem;margin-left:.3rem">⚠ Rendah</span>' : ''}
      </td>
      <td style="color:var(--text-muted);font-size:.88rem">${parseFloat(item.min_stock).toLocaleString('id-ID')} ${escHtml(item.unit)}</td>
      <td style="font-size:.88rem">${item.cost_per_unit ? 'Rp ' + parseInt(item.cost_per_unit).toLocaleString('id-ID') : '—'}</td>
      <td><span class="bo-badge ${item.active ? 'bo-badge-active' : 'bo-badge-inactive'}">${item.active ? 'Aktif' : 'Nonaktif'}</span></td>
      <td><div class="bo-actions">
        <button class="btn btn-outline btn-sm" onclick="openAdjustStockModal(${item.id})">Sesuaikan Stok</button>
        <button class="btn btn-outline btn-sm" onclick="openIngredientModal(${item.id})">Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deleteIngredient(${item.id}, '${escHtml(item.name).replace(/'/g, '&#39;')}')">🗑</button>
      </div></td>
    </tr>`;
  }).join('');
}

// ── Modal Bahan Baku ──────────────────────────────────────────
let editingIngredientId = null;

function openIngredientModal(id) {
  editingIngredientId = id;
  document.getElementById('ingredientModalTitle').textContent = id ? 'Edit Bahan Baku' : 'Tambah Bahan Baku';
  document.getElementById('ingredientForm').reset();
  if (id) {
    const item = allIngredients.find(i => i.id === id);
    if (item) {
      document.getElementById('ingName').value     = item.name;
      document.getElementById('ingUnit').value     = item.unit;
      document.getElementById('ingStock').value    = item.stock;
      document.getElementById('ingMinStock').value = item.min_stock;
      document.getElementById('ingCost').value     = item.cost_per_unit || '';
    }
    // Stok tidak bisa diedit langsung saat edit — pakai Sesuaikan Stok
    document.getElementById('ingStock').disabled = true;
    document.getElementById('ingStock').style.background = '#f1f5f9';
  } else {
    document.getElementById('ingStock').disabled = false;
    document.getElementById('ingStock').style.background = '';
  }
  document.getElementById('ingredientModal').classList.remove('hidden');
}

document.getElementById('ingredientModalCancel').addEventListener('click', () =>
  document.getElementById('ingredientModal').classList.add('hidden'));

document.getElementById('ingredientForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = {
    name:          document.getElementById('ingName').value.trim(),
    unit:          document.getElementById('ingUnit').value.trim(),
    min_stock:     parseFloat(document.getElementById('ingMinStock').value) || 0,
    cost_per_unit: document.getElementById('ingCost').value ? parseFloat(document.getElementById('ingCost').value) : null,
  };
  if (!editingIngredientId) {
    data.stock = parseFloat(document.getElementById('ingStock').value) || 0;
  }
  const btn = document.getElementById('ingredientModalSave');
  btn.disabled = true; btn.textContent = 'Menyimpan...';
  try {
    if (editingIngredientId) await API.updateIngredient(editingIngredientId, data);
    else await API.addIngredient(data);
    document.getElementById('ingredientModal').classList.add('hidden');
    await loadIngredients();
  } catch (err) { Modal.alert('', 'Gagal', err.message); }
  finally { btn.disabled = false; btn.textContent = 'Simpan'; }
});

// ── Modal Sesuaikan Stok ──────────────────────────────────────
let adjustingIngredientId = null;
let adjustingIngredientStock = 0;

function openAdjustStockModal(id) {
  adjustingIngredientId = id;
  const item = allIngredients.find(i => i.id === id);
  if (!item) return;
  adjustingIngredientStock = parseFloat(item.stock);
  document.getElementById('adjustStockDesc').textContent = `Bahan: ${item.name} (${item.unit})`;
  document.getElementById('adjustCurrentStock').value = `${adjustingIngredientStock} ${item.unit}`;
  document.getElementById('adjustDelta').value = '';
  document.getElementById('adjustNewStock').value = `${adjustingIngredientStock} ${item.unit}`;
  document.getElementById('adjustStockModal').classList.remove('hidden');
}

document.getElementById('adjustDelta').addEventListener('input', function () {
  const delta = parseFloat(this.value) || 0;
  const newStock = Math.max(0, adjustingIngredientStock + delta);
  const item = allIngredients.find(i => i.id === adjustingIngredientId);
  document.getElementById('adjustNewStock').value = `${newStock.toLocaleString('id-ID')} ${item?.unit || ''}`;
  document.getElementById('adjustNewStock').style.color = delta >= 0 ? 'var(--success)' : 'var(--danger)';
});

document.getElementById('adjustStockCancel').addEventListener('click', () =>
  document.getElementById('adjustStockModal').classList.add('hidden'));

document.getElementById('adjustStockConfirm').addEventListener('click', async () => {
  const delta = parseFloat(document.getElementById('adjustDelta').value);
  if (isNaN(delta)) { Modal.alert('', 'Input Tidak Valid', 'Masukkan angka perubahan stok.'); return; }
  const btn = document.getElementById('adjustStockConfirm');
  btn.disabled = true; btn.textContent = 'Menyimpan...';
  try {
    await API.adjustIngredientStock(adjustingIngredientId, delta);
    document.getElementById('adjustStockModal').classList.add('hidden');
    await loadIngredients();
    // Refresh resep jika sedang di tab resep
    if (activeTab === 'recipes') await loadRecipes();
    Modal.alert('', 'Berhasil', 'Stok bahan berhasil diperbarui. Stok menu terkait sudah disinkronkan.');
  } catch (err) { Modal.alert('', 'Gagal', err.message); }
  finally { btn.disabled = false; btn.textContent = 'Simpan'; }
});

async function deleteIngredient(id, name) {
  Modal.confirm('', 'Hapus Bahan', `Hapus bahan "${name}"?`, async () => {
    try {
      await API.deleteIngredient(id);
      await loadIngredients();
    } catch (err) { Modal.alert('', 'Gagal', err.message); }
  }, 'Ya, Hapus', 'Batal', 'btn-danger');
}

// ══ RECIPES ═══════════════════════════════════════════════════
let allRecipes = [];
let allMenuForRecipe = [];

async function loadRecipes() {
  try {
    [allRecipes, allMenuForRecipe, allIngredients] = await Promise.all([
      API.getRecipes(),
      API.getAllMenu(),
      API.getIngredients(),
    ]);
    renderRecipeCards(allRecipes);
  } catch (err) {
    Modal.alert('', 'Gagal Memuat', 'Gagal memuat resep: ' + err.message);
  }
}

function renderRecipeCards(recipes) {
  const container = document.getElementById('recipeCards');
  if (!recipes.length) {
    container.innerHTML = `
      <div style="text-align:center;padding:3rem;color:var(--text-muted)">
        <div style="font-size:2.5rem;margin-bottom:.5rem">📋</div>
        <div>Belum ada resep. Klik "+ Buat Resep" untuk mulai.</div>
      </div>`;
    return;
  }
  container.innerHTML = recipes.map(r => {
    const stockColor = r.estimated_stock === 0 ? 'var(--danger)'
      : r.estimated_stock <= 5 ? '#d97706' : 'var(--success)';
    const ingList = r.ingredients.map(i =>
      `<div class="recipe-ing-row">
        <span class="recipe-ing-name">${escHtml(i.ingredient_name)}</span>
        <span class="recipe-ing-qty">${parseFloat(i.quantity).toLocaleString('id-ID')} ${escHtml(i.unit)}</span>
        <span class="recipe-ing-stock" style="color:${parseFloat(i.ingredient_stock) < parseFloat(i.quantity) ? 'var(--danger)' : 'var(--text-muted)'}">
          (stok: ${parseFloat(i.ingredient_stock).toLocaleString('id-ID')} ${escHtml(i.ingredient_unit)})
        </span>
      </div>`
    ).join('');
    return `
      <div class="recipe-card">
        <div class="recipe-card-header">
          <div>
            <div class="recipe-menu-name">${escHtml(r.menu_name)}</div>
            <div class="recipe-yield">Hasil: ${r.yield_count} porsi per resep</div>
          </div>
          <div class="recipe-stock-badge" style="background:${stockColor}20;color:${stockColor};border:1.5px solid ${stockColor}40">
            <span style="font-size:1.1rem;font-weight:800">${r.estimated_stock}</span>
            <span style="font-size:.7rem">porsi tersedia</span>
          </div>
        </div>
        <div class="recipe-ing-list">
          ${ingList || '<div style="color:var(--text-muted);font-size:.85rem;padding:.5rem 0">Belum ada bahan</div>'}
        </div>
        ${r.notes ? `<div class="recipe-notes">📝 ${escHtml(r.notes)}</div>` : ''}
        <div class="recipe-card-actions">
          <button class="btn btn-outline btn-sm" onclick="openRecipeModal(${r.id})">Edit Resep</button>
          <button class="btn btn-danger btn-sm" onclick="deleteRecipe(${r.id}, '${escHtml(r.menu_name).replace(/'/g, '&#39;')}')">🗑</button>
        </div>
      </div>`;
  }).join('');
}

document.getElementById('recipeSearch').addEventListener('input', function () {
  const q = this.value.toLowerCase();
  renderRecipeCards(allRecipes.filter(r => r.menu_name.toLowerCase().includes(q)));
});

document.getElementById('syncAllBtn').addEventListener('click', async () => {
  const btn = document.getElementById('syncAllBtn');
  btn.disabled = true; btn.textContent = 'Menyinkronkan...';
  try {
    const result = await API.syncAllRecipes();
    await loadRecipes();
    Modal.alert('', 'Sync Selesai', `${result.synced} resep berhasil disinkronkan.`);
  } catch (err) { Modal.alert('', 'Gagal', err.message); }
  finally { btn.disabled = false; btn.textContent = '↻ Sync Semua Stok'; }
});

// ── Modal Resep ───────────────────────────────────────────────
let editingRecipeId = null;
let recipeIngRows   = [];   // [{ ingredientId, quantity, unit }]

function openRecipeModal(id) {
  editingRecipeId = id;
  document.getElementById('recipeModalTitle').textContent = id ? 'Edit Resep' : 'Buat Resep';
  document.getElementById('recipeForm').reset();
  document.getElementById('recipeStockPreview').style.display = 'none';

  // Populate menu dropdown — hanya menu yang belum punya resep (kecuali yang sedang diedit)
  const menuSel = document.getElementById('recipeMenuId');
  const usedMenuIds = allRecipes.map(r => r.menu_id);
  menuSel.innerHTML = '<option value="">-- Pilih Menu --</option>';
  allMenuForRecipe.forEach(m => {
    const alreadyUsed = usedMenuIds.includes(m.id) && (!id || allRecipes.find(r => r.id === id)?.menu_id !== m.id);
    if (!alreadyUsed) {
      menuSel.innerHTML += `<option value="${m.id}">${m.name}</option>`;
    }
  });

  recipeIngRows = [];
  if (id) {
    const recipe = allRecipes.find(r => r.id === id);
    if (recipe) {
      menuSel.innerHTML = `<option value="${recipe.menu_id}">${recipe.menu_name}</option>`;
      menuSel.disabled = true;
      document.getElementById('recipeYield').value = recipe.yield_count;
      document.getElementById('recipeNotes').value = recipe.notes || '';
      recipeIngRows = recipe.ingredients.map(i => ({
        ingredientId: i.ingredient_id,
        quantity: i.quantity,
        unit: i.unit,
      }));
    }
  } else {
    menuSel.disabled = false;
  }

  renderIngRows();
  document.getElementById('recipeModal').classList.remove('hidden');
}

function renderIngRows() {
  const container = document.getElementById('recipeIngRows');
  if (!recipeIngRows.length) {
    container.innerHTML = '<div style="color:var(--text-muted);font-size:.85rem;padding:.5rem 0">Belum ada bahan. Klik "+ Tambah Bahan".</div>';
    updateStockPreview();
    return;
  }
  container.innerHTML = recipeIngRows.map((row, idx) => `
    <div class="recipe-ing-form-row" data-idx="${idx}">
      <select class="ing-select" onchange="updateIngRow(${idx}, 'ingredientId', this.value)">
        <option value="">-- Pilih Bahan --</option>
        ${allIngredients.map(i =>
          `<option value="${i.id}" ${i.id == row.ingredientId ? 'selected' : ''}>${i.name} (${i.unit})</option>`
        ).join('')}
      </select>
      <input type="number" class="ing-qty-input" min="0.01" step="0.01"
        value="${row.quantity || ''}" placeholder="Jumlah"
        onchange="updateIngRow(${idx}, 'quantity', this.value)"
        oninput="updateIngRow(${idx}, 'quantity', this.value)" />
      <input type="text" class="ing-unit-input" value="${row.unit || ''}" placeholder="Satuan"
        onchange="updateIngRow(${idx}, 'unit', this.value)"
        oninput="updateIngRow(${idx}, 'unit', this.value)" />
      <button type="button" class="btn btn-danger btn-sm" onclick="removeIngRow(${idx})">✕</button>
    </div>
  `).join('');
  updateStockPreview();
}

function updateIngRow(idx, field, value) {
  if (field === 'ingredientId') {
    recipeIngRows[idx].ingredientId = parseInt(value) || null;
    // Auto-fill unit dari ingredient
    const ing = allIngredients.find(i => i.id === parseInt(value));
    if (ing) {
      recipeIngRows[idx].unit = ing.unit;
      // Update unit input di DOM
      const row = document.querySelectorAll('.recipe-ing-form-row')[idx];
      if (row) row.querySelector('.ing-unit-input').value = ing.unit;
    }
  } else if (field === 'quantity') {
    recipeIngRows[idx].quantity = parseFloat(value) || 0;
  } else if (field === 'unit') {
    recipeIngRows[idx].unit = value;
  }
  updateStockPreview();
}

function removeIngRow(idx) {
  recipeIngRows.splice(idx, 1);
  renderIngRows();
}

document.getElementById('addIngRowBtn').addEventListener('click', () => {
  recipeIngRows.push({ ingredientId: null, quantity: 0, unit: '' });
  renderIngRows();
});

function updateStockPreview() {
  const preview = document.getElementById('recipeStockPreview');
  const yieldCount = parseInt(document.getElementById('recipeYield').value) || 1;
  const validRows = recipeIngRows.filter(r => r.ingredientId && r.quantity > 0);
  if (!validRows.length) { preview.style.display = 'none'; return; }

  let minPortions = Infinity;
  for (const row of validRows) {
    const ing = allIngredients.find(i => i.id === row.ingredientId);
    if (!ing) continue;
    const portions = Math.floor(parseFloat(ing.stock) / row.quantity);
    if (portions < minPortions) minPortions = portions;
  }
  const estimated = minPortions === Infinity ? 0 : minPortions * yieldCount;
  document.getElementById('previewStockValue').textContent = estimated;
  document.getElementById('previewStockValue').style.color =
    estimated === 0 ? 'var(--danger)' : estimated <= 5 ? '#d97706' : 'var(--success)';
  preview.style.display = 'flex';
}

document.getElementById('recipeYield').addEventListener('input', updateStockPreview);

document.getElementById('recipeModalCancel').addEventListener('click', () => {
  document.getElementById('recipeModal').classList.add('hidden');
  document.getElementById('recipeMenuId').disabled = false;
});

document.getElementById('recipeForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const menuId     = parseInt(document.getElementById('recipeMenuId').value);
  const yieldCount = parseInt(document.getElementById('recipeYield').value) || 1;
  const notes      = document.getElementById('recipeNotes').value.trim();

  if (!menuId) { Modal.alert('', 'Pilih Menu', 'Pilih menu untuk resep ini.'); return; }

  const validIngredients = recipeIngRows
    .filter(r => r.ingredientId && r.quantity > 0 && r.unit)
    .map(r => ({ ingredientId: r.ingredientId, quantity: r.quantity, unit: r.unit }));

  const btn = document.getElementById('recipeModalSave');
  btn.disabled = true; btn.textContent = 'Menyimpan...';
  try {
    if (editingRecipeId) {
      await API.updateRecipe(editingRecipeId, { yieldCount, notes, ingredients: validIngredients });
    } else {
      await API.createRecipe({ menuId, yieldCount, notes, ingredients: validIngredients });
    }
    document.getElementById('recipeModal').classList.add('hidden');
    document.getElementById('recipeMenuId').disabled = false;
    await loadRecipes();
  } catch (err) { Modal.alert('', 'Gagal', err.message); }
  finally { btn.disabled = false; btn.textContent = 'Simpan Resep'; }
});

async function deleteRecipe(id, menuName) {
  Modal.confirm('', 'Hapus Resep', `Hapus resep untuk "${menuName}"?`, async () => {
    try {
      await API.deleteRecipe(id);
      await loadRecipes();
    } catch (err) { Modal.alert('', 'Gagal', err.message); }
  }, 'Ya, Hapus', 'Batal', 'btn-danger');
}

// Expose ke global scope untuk onclick di HTML
window.openMenuModal          = openMenuModal;
window.deleteMenu             = deleteMenu;
window.openCategoryModal      = openCategoryModal;
window.deleteCategory         = deleteCategory;
window.openStockModal         = openStockModal;
window.openVoidModal          = openVoidModal;
window.openUserModal          = openUserModal;
window.deleteUser             = deleteUser;
window.openIngredientModal    = openIngredientModal;
window.openAdjustStockModal   = openAdjustStockModal;
window.deleteIngredient       = deleteIngredient;
window.openRecipeModal        = openRecipeModal;
window.deleteRecipe           = deleteRecipe;
window.updateIngRow           = updateIngRow;
window.removeIngRow           = removeIngRow;

// ── Init ──────────────────────────────────────────────────────
switchTab('items');
