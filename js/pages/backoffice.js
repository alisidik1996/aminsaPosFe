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
let activeTab = 'menu';

document.querySelectorAll('.bo-nav-item').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

function switchTab(tab) {
  activeTab = tab;
  document.querySelectorAll('.bo-nav-item').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.bo-tab').forEach(s => s.classList.toggle('active', s.id === `tab-${tab}`));
  const titles = { menu: 'Menu', stock: 'Manajemen Stok', users: 'Users' };
  document.getElementById('boPageTitle').textContent = titles[tab];
  const addBtn = document.getElementById('boAddBtn');
  addBtn.style.display  = tab === 'stock' ? 'none' : '';
  addBtn.textContent    = tab === 'users' ? '+ Tambah User' : '+ Tambah Menu';
  if (tab === 'menu')  loadMenu();
  if (tab === 'stock') loadStock();
  if (tab === 'users') loadUsers();
}

document.getElementById('boAddBtn').addEventListener('click', () => {
  if (activeTab === 'menu')  openMenuModal(null);
  if (activeTab === 'users') openUserModal(null);
});

// ══ MENU ══════════════════════════════════════════════════════
let allMenuItems = [];

async function loadMenu() {
  allMenuItems = await API.getMenu();
  const cats = [...new Set(allMenuItems.map(m => m.category))];
  const sel  = document.getElementById('menuCatFilter');
  sel.innerHTML = '<option value="">Semua Kategori</option>';
  cats.forEach(c => sel.innerHTML += `<option value="${c}">${c}</option>`);
  renderMenuTable(allMenuItems);
}

function renderMenuTable(items) {
  const tbody = document.getElementById('menuTbody');
  if (!items.length) { tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:2rem">Tidak ada menu</td></tr>'; return; }
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
  document.getElementById('menuModalTitle').textContent = id ? 'Edit Menu' : 'Tambah Menu';
  document.getElementById('menuForm').reset();
  document.getElementById('mPreviewWrap').style.display = 'none';
  if (id) {
    const item = allMenuItems.find(m => m.id === id);
    if (item) {
      document.getElementById('mName').value     = item.name;
      document.getElementById('mPrice').value    = item.price;
      document.getElementById('mCategory').value = item.category;
      document.getElementById('mStation').value  = item.station;
      document.getElementById('mStock').value    = item.stock;
      document.getElementById('mActive').value   = item.active;
      document.getElementById('mImage').value    = item.image || '';
      if (item.image) { document.getElementById('mPreview').src = item.image; document.getElementById('mPreviewWrap').style.display = ''; }
    }
  }
  document.getElementById('menuModal').classList.remove('hidden');
}

document.getElementById('mImage').addEventListener('input', function () {
  const wrap = document.getElementById('mPreviewWrap');
  if (this.value) { document.getElementById('mPreview').src = this.value; wrap.style.display = ''; }
  else wrap.style.display = 'none';
});

document.getElementById('menuModalCancel').addEventListener('click', () => document.getElementById('menuModal').classList.add('hidden'));

document.getElementById('menuForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = {
    name: document.getElementById('mName').value.trim(), price: parseInt(document.getElementById('mPrice').value),
    category: document.getElementById('mCategory').value.trim(), station: document.getElementById('mStation').value,
    stock: parseInt(document.getElementById('mStock').value) || 0, active: parseInt(document.getElementById('mActive').value),
    image: document.getElementById('mImage').value.trim(),
  };
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
  Modal.confirm('🗑️', 'Hapus Menu', `Hapus menu "${name}"?`, async () => {
    try { await API.deleteMenu(id); await loadMenu(); }
    catch (err) { Modal.alert('❌', 'Gagal', err.message); }
  }, 'Ya, Hapus', 'Batal', 'btn-danger');
}

// ══ STOCK ══════════════════════════════════════════════════════
let allStockItems = [];
async function loadStock() {
  allStockItems = await API.getMenu();
  renderStockTable(allStockItems);
}
function renderStockTable(items) {
  const tbody = document.getElementById('stockTbody');
  if (!items.length) { tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:2rem">Tidak ada menu</td></tr>'; return; }
  tbody.innerHTML = items.map(item => `
    <tr>
      <td><strong>${item.name}</strong></td>
      <td>${item.category}</td>
      <td><span class="item-stock ${item.stock <= 5 ? 'stock-low' : item.stock <= 10 ? 'stock-mid' : 'stock-ok'}">${item.stock}</span></td>
      <td><div class="stock-input-wrap">
        <input type="number" class="stock-input" id="stock-${item.id}" value="${item.stock}" min="0" />
        <button class="btn btn-primary btn-sm" onclick="saveStock(${item.id})">Simpan</button>
      </div></td>
    </tr>
  `).join('');
}
document.getElementById('stockSearch').addEventListener('input', function () {
  const q = this.value.toLowerCase();
  renderStockTable(allStockItems.filter(m => m.name.toLowerCase().includes(q)));
});
async function saveStock(id) {
  const input = document.getElementById(`stock-${id}`);
  const stock = parseInt(input.value);
  if (isNaN(stock) || stock < 0) { Modal.alert('⚠️', 'Input Tidak Valid', 'Stok harus angka >= 0'); return; }
  try {
    await API.updateMenuStock(id, stock);
    const item = allStockItems.find(m => m.id === id);
    if (item) item.stock = stock;
    const span = input.closest('tr').querySelector('.item-stock');
    if (span) { span.textContent = stock; span.className = `item-stock ${stock <= 5 ? 'stock-low' : stock <= 10 ? 'stock-mid' : 'stock-ok'}`; }
    Modal.alert('✅', 'Berhasil', `Stok "${item?.name}" diupdate ke ${stock}`);
  } catch (err) { Modal.alert('❌', 'Gagal', err.message); }
}

// ══ USERS ══════════════════════════════════════════════════════
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

// ── Init ──────────────────────────────────────────────────────
switchTab('menu');
