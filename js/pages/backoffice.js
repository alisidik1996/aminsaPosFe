// ===== PAGE: Backoffice =====
const session = requireAdmin();
if (!session) throw new Error('Not admin');

document.getElementById('boKasirName').textContent = '👤 ' + session.name;

document.getElementById('boLogoutBtn').addEventListener('click', () => {
  Modal.confirm('🚪', 'Logout', 'Yakin ingin logout?', () => {
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
  const titles = { items: 'Item', categories: 'Kategori', stock: 'Manajemen Stok', void: 'Void', users: 'Users', settings: 'Pengaturan' };
  document.getElementById('boPageTitle').textContent = titles[tab];
  const addBtn = document.getElementById('boAddBtn');
  addBtn.style.display  = ['stock', 'void', 'settings'].includes(tab) ? 'none' : '';
  addBtn.textContent    = tab === 'users' ? '+ Tambah User' : tab === 'categories' ? '+ Tambah Kategori' : '+ Tambah Item';
  
  if (tab === 'items')      loadMenu();
  if (tab === 'categories') loadCategories();
  if (tab === 'stock')      loadStock();
  if (tab === 'void')       loadVoid();
  if (tab === 'users')      loadUsers();
  if (tab === 'settings')   loadSettings();
}

document.getElementById('boAddBtn').addEventListener('click', () => {
  if (activeTab === 'items')      openMenuModal(null);
  if (activeTab === 'categories') openCategoryModal(null);
  if (activeTab === 'users')      openUserModal(null);
});

// ══ ITEMS (MENU) ══════════════════════════════════════════════
let allMenuItems = [];
let allCategories = [];

async function loadMenu() {
  allMenuItems = await API.getMenu();
  allCategories = await API.getCategories();
  
  const cats = [...new Set(allMenuItems.map(m => m.category))];
  const sel  = document.getElementById('menuCatFilter');
  sel.innerHTML = '<option value="">Semua Kategori</option>';
  cats.forEach(c => sel.innerHTML += `<option value="${c}">${c}</option>`);
  renderMenuTable(allMenuItems);
}

function renderMenuTable(items) {
  const tbody = document.getElementById('menuTbody');
  if (!items.length) { tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:2rem">Tidak ada item</td></tr>'; return; }
  tbody.innerHTML = items.map(item => `
    <tr>
      <td><img src="${item.image || ''}" class="menu-thumb" onerror="this.style.background='#e2e8f0';this.src=''" /></td>
      <td><strong>${item.name}</strong></td>
      <td>${item.category}</td>
      <td><span class="bo-badge bo-badge-${item.station}">${item.station === 'kitchen' ? '🍳 Kitchen' : '🍹 Bar'}</span></td>
      <td>${formatRp(item.price)}</td>
      <td><span class="item-stock ${item.stock <= 5 ? 'stock-low' : item.stock <= 10 ? 'stock-mid' : 'stock-ok'}">${item.stock}</span></td>
      <td><span class="bo-badge ${item.active ? 'bo-badge-active' : 'bo-badge-inactive'}">${item.active ? 'Aktif' : 'Nonaktif'}</span></td>
      <td><div class="bo-actions">
        <button class="btn btn-outline btn-sm" onclick="openMenuModal(${item.id})">✏️ Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deleteMenu(${item.id}, '${item.name.replace(/'/g, "\\'")}')">🗑</button>
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
  } catch (err) { Modal.alert('❌', 'Gagal', err.message); }
  finally { saveBtn.disabled = false; saveBtn.textContent = 'Simpan'; }
});

async function deleteMenu(id, name) {
  Modal.confirm('🗑️', 'Hapus Item', `Hapus item "${name}"?`, async () => {
    try { await API.deleteMenu(id); await loadMenu(); }
    catch (err) { Modal.alert('❌', 'Gagal', err.message); }
  }, 'Ya, Hapus', 'Batal', 'btn-danger');
}

// ══ CATEGORIES ════════════════════════════════════════════════
async function loadCategories() {
  allCategories = await API.getCategories();
  renderCategoriesTable(allCategories);
}

function renderCategoriesTable(cats) {
  const tbody = document.getElementById('catTbody');
  if (!cats.length) { tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:var(--text-muted);padding:2rem">Tidak ada kategori</td></tr>'; return; }
  tbody.innerHTML = cats.map(c => `
    <tr>
      <td><strong>${c.name}</strong></td>
      <td><span class="bo-badge bo-badge-${c.station}">${c.station === 'kitchen' ? '🍳 Kitchen' : '🍹 Bar'}</span></td>
      <td><div class="bo-actions">
        <button class="btn btn-outline btn-sm" onclick="openCategoryModal(${c.id})">✏️ Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deleteCategory(${c.id}, '${c.name.replace(/'/g, "\\'")}')">🗑</button>
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
  } catch (err) { Modal.alert('❌', 'Gagal', err.message); }
  finally { saveBtn.disabled = false; saveBtn.textContent = 'Simpan'; }
});

async function deleteCategory(id, name) {
  Modal.confirm('🗑️', 'Hapus Kategori', `Hapus kategori "${name}"?\n\nKategori yang masih digunakan tidak bisa dihapus.`, async () => {
    try { await API.deleteCategory(id); await loadCategories(); }
    catch (err) { Modal.alert('❌', 'Gagal', err.message); }
  }, 'Ya, Hapus', 'Batal', 'btn-danger');
}

// ══ STOCK ═════════════════════════════════════════════════════
let allStockItems = [];
async function loadStock() {
  allStockItems = await API.getMenu();
  renderStockTable(allStockItems);
}

function renderStockTable(items) {
  const tbody = document.getElementById('stockTbody');
  if (!items.length) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:2rem">Tidak ada item</td></tr>'; return; }
  tbody.innerHTML = items.map(item => {
    const buffer = item.buffer_stock || 5;
    return `
    <tr>
      <td><strong>${item.name}</strong></td>
      <td>${item.category}</td>
      <td><span class="item-stock ${item.stock <= buffer ? 'stock-low' : item.stock <= buffer * 2 ? 'stock-mid' : 'stock-ok'}">${item.stock}</span></td>
      <td><span class="bo-badge" style="background:#f1f5f9;color:#64748b">${buffer}</span></td>
      <td><button class="btn btn-outline btn-sm" onclick="openStockModal(${item.id})">✏️ Edit</button></td>
    </tr>
  `;
  }).join('');
}

document.getElementById('stockSearch').addEventListener('input', function () {
  const q = this.value.toLowerCase();
  renderStockTable(allStockItems.filter(m => m.name.toLowerCase().includes(q)));
});

let editingStockItemId = null;
function openStockModal(id) {
  editingStockItemId = id;
  const item = allStockItems.find(m => m.id === id);
  if (!item) return;
  document.getElementById('smItemName').value = item.name;
  document.getElementById('smStock').value = item.stock;
  document.getElementById('smBuffer').value = item.buffer_stock || 5;
  document.getElementById('stockModal').classList.remove('hidden');
}

document.getElementById('stockModalCancel').addEventListener('click', () => document.getElementById('stockModal').classList.add('hidden'));

document.getElementById('stockModalForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const stock = parseInt(document.getElementById('smStock').value);
  const buffer = parseInt(document.getElementById('smBuffer').value);
  if (isNaN(stock) || stock < 0 || isNaN(buffer) || buffer < 0) {
    Modal.alert('⚠️', 'Input Tidak Valid', 'Stok dan buffer harus angka >= 0');
    return;
  }
  const saveBtn = document.getElementById('stockModalSave');
  saveBtn.disabled = true; saveBtn.textContent = 'Menyimpan...';
  try {
    await API.updateMenuStock(editingStockItemId, stock);
    // TODO: jika ada endpoint untuk buffer_stock, update di sini
    const item = allStockItems.find(m => m.id === editingStockItemId);
    if (item) { item.stock = stock; item.buffer_stock = buffer; }
    document.getElementById('stockModal').classList.add('hidden');
    renderStockTable(allStockItems);
    Modal.alert('✅', 'Berhasil', 'Stok dan buffer berhasil diupdate.');
  } catch (err) { Modal.alert('❌', 'Gagal', err.message); }
  finally { saveBtn.disabled = false; saveBtn.textContent = 'Simpan'; }
});

// ══ VOID ══════════════════════════════════════════════════════
let activeTables = [];
let voidHistory = [];

async function loadVoid() {
  activeTables = (await API.getTables()).filter(t => t.status === 'occupied');
  voidHistory = await API.getVoidHistory();
  renderVoidTables();
  renderVoidHistory();
}

function renderVoidTables() {
  const grid = document.getElementById('voidTableGrid');
  if (!activeTables.length) {
    grid.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:2rem">Tidak ada meja aktif</div>';
    return;
  }
  grid.innerHTML = activeTables.map(t => `
    <div class="void-table-card" onclick="openVoidModal(${t.id}, '${t.name}')">
      <div class="void-table-icon">👥</div>
      <div class="void-table-name">${t.name}</div>
      <div class="void-table-time">⏱ ${getElapsed(t.openedAt)}</div>
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
      <td>${v.table_name}</td>
      <td>${formatRp(v.total)}</td>
      <td>${v.kasir_name}</td>
      <td style="font-size:.8rem">${formatDate(v.created_at)}</td>
      <td style="font-size:.85rem;color:var(--text-muted)">${v.note || '-'}</td>
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
    Modal.alert('✅', 'Berhasil', 'Meja berhasil di-void.');
  } catch (err) { Modal.alert('❌', 'Gagal', err.message); }
  finally { btn.disabled = false; btn.textContent = 'Ya, Void'; }
});

// ══ USERS ═════════════════════════════════════════════════════
let allUsers = [];
async function loadUsers() {
  allUsers = await API.getUsers();
  renderUsersTable(allUsers);
}

function renderUsersTable(users) {
  const tbody = document.getElementById('usersTbody');
  if (!users.length) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:2rem">Tidak ada user</td></tr>'; return; }
  tbody.innerHTML = users.map(u => `
    <tr>
      <td>${u.id}</td>
      <td><code>${u.username}</code></td>
      <td>${u.name}</td>
      <td><span class="bo-badge bo-badge-${u.role}">${u.role}</span></td>
      <td><div class="bo-actions">
        <button class="btn btn-outline btn-sm" onclick="openUserModal(${u.id})">✏️ Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deleteUser(${u.id}, '${u.username.replace(/'/g, "\\'")}')">🗑</button>
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
  try {
    if (editingUserId) await API.updateUser(editingUserId, data);
    else { if (!password) { Modal.alert('⚠️', 'Password Wajib', 'Password wajib diisi untuk user baru.'); return; } await API.addUser(data); }
    document.getElementById('userModal').classList.add('hidden');
    await loadUsers();
  } catch (err) { Modal.alert('❌', 'Gagal', err.message); }
});

async function deleteUser(id, username) {
  if (id === session.id) { Modal.alert('⚠️', 'Tidak Bisa', 'Tidak bisa menghapus akun yang sedang login.'); return; }
  Modal.confirm('🗑️', 'Hapus User', `Hapus user "${username}"?`, async () => {
    try { await API.deleteUser(id); await loadUsers(); }
    catch (err) { Modal.alert('❌', 'Gagal', err.message); }
  }, 'Ya, Hapus', 'Batal', 'btn-danger');
}

// ══ SETTINGS ══════════════════════════════════════════════════
async function loadSettings() {
  try {
    const settings = await API.getSettings();
    document.getElementById('sMerchantName').value    = settings.merchant_name || '';
    document.getElementById('sMerchantAddress').value = settings.merchant_address || '';
    document.getElementById('sMerchantPhone').value   = settings.merchant_phone || '';
    document.getElementById('sMerchantSocial').value  = settings.merchant_social || '';
    document.getElementById('sReceiptFooter').value   = settings.receipt_footer || '';
  } catch (err) {
    Modal.alert('❌', 'Gagal Memuat', err.message);
  }
}

document.getElementById('settingsForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = {
    merchant_name:    document.getElementById('sMerchantName').value.trim(),
    merchant_address: document.getElementById('sMerchantAddress').value.trim(),
    merchant_phone:   document.getElementById('sMerchantPhone').value.trim(),
    merchant_social:  document.getElementById('sMerchantSocial').value.trim(),
    receipt_footer:   document.getElementById('sReceiptFooter').value.trim(),
  };
  const saveBtn = document.getElementById('settingsSaveBtn');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Menyimpan...';
  try {
    await API.updateSettings(data);
    Modal.alert('✅', 'Berhasil', 'Pengaturan berhasil disimpan.');
  } catch (err) {
    Modal.alert('❌', 'Gagal', err.message);
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = '💾 Simpan Pengaturan';
  }
});

// ── Init ──────────────────────────────────────────────────────
switchTab('items');
