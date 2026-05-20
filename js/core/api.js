// ===== API CLIENT =====
// Deteksi environment: production (Vercel) vs development (Live Server / localhost)

const BACKEND_URL = (() => {
  const { hostname, port } = window.location;

  // Jika jalan di localhost / 127.0.0.1 → arahkan ke backend lokal
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:3000/api';
  }

  // Production → backend Vercel
  return 'https://aminsa-pos-be.vercel.app/api';
})();

async function http(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);

  let res;
  try {
    res = await fetch(BACKEND_URL + path, opts);
  } catch {
    throw new Error('Tidak dapat terhubung ke server. Pastikan backend sudah berjalan.');
  }

  const text = await res.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); }
    catch { throw new Error(`Server error (${res.status}): response bukan JSON.`); }
  }

  if (!res.ok) throw new Error((data && data.error) || `HTTP ${res.status}`);
  return data;
}

const API = {
  // ── AUTH / USERS ────────────────────────────────────────
  login:      (username, password) => http('POST', '/auth/login', { username, password }),
  getUsers:   ()         => http('GET',    '/auth/users'),
  addUser:    (data)     => http('POST',   '/auth/users', data),
  updateUser: (id, data) => http('PUT',    `/auth/users/${id}`, data),
  deleteUser: (id)       => http('DELETE', `/auth/users/${id}`),

  // ── MENU ────────────────────────────────────────────────
  getMenu: (category) => {
    const q = category && category !== 'Semua'
      ? `?category=${encodeURIComponent(category)}` : '';
    return http('GET', `/menu${q}`);
  },
  getAllMenu:         ()         => http('GET', '/menu/all'),   // termasuk nonaktif (backoffice)
  getMenuCategories: () => http('GET', '/menu/categories'),
  updateMenuStock:   (id, stock) => http('PATCH', `/menu/${id}/stock`, { stock }),
  updateMenu:        (id, data)  => http('PUT',   `/menu/${id}`, data),
  addMenu:           (data)      => http('POST',  '/menu', data),
  deleteMenu:        (id)        => http('DELETE', `/menu/${id}`),

  // ── CATEGORIES ──────────────────────────────────────────
  getCategories:    ()          => http('GET',    '/categories'),
  addCategory:      (data)      => http('POST',   '/categories', data),
  updateCategory:   (id, data)  => http('PUT',    `/categories/${id}`, data),
  deleteCategory:   (id)        => http('DELETE', `/categories/${id}`),

  // ── TABLES ──────────────────────────────────────────────
  getTables:   ()          => http('GET',   '/tables'),
  getTable:    (id)        => http('GET',   `/tables/${id}`),
  updateTable: (id, data)  => http('PATCH', `/tables/${id}`, data),
  switchTable: (fromId, toId) => http('POST', '/tables/switch', { fromId, toId }),

  // ── ORDERS ──────────────────────────────────────────────
  getOrderByTable:       (tableId) => http('GET',   `/orders/table/${tableId}`),
  getActiveOrderByTable: (tableId) => http('GET',   `/orders/table/${tableId}/active`),
  getOrder:              (id)      => http('GET',   `/orders/${id}`),
  createOrder:           (data)    => http('POST',  '/orders', data),
  updateOrder:           (id, data)=> http('PATCH', `/orders/${id}`, data),

  // ── BILLS ───────────────────────────────────────────────
  getBillByOrder:  (orderId) => http('GET',  `/bills/order/${orderId}`),
  getBillByTable:  (tableId) => http('GET',  `/bills/table/${tableId}`),
  getBill:         (id)      => http('GET',  `/bills/${id}`),
  createBill:      (data)    => http('POST', '/bills', data),
  updateBill:      (id, data)=> http('PATCH',`/bills/${id}`, data),
  addOrderToBill:  (id, orderId) => http('POST', `/bills/${id}/add-order`, { orderId }),

  // ── SETTINGS ────────────────────────────────────────────
  getSettings:     ()        => http('GET',  '/settings'),
  updateSettings:  (data)    => http('PUT',  '/settings', data),

  // ── VOID ────────────────────────────────────────────────
  voidTable:       (tableId, reason) => http('POST', `/void/table/${tableId}`, { reason }),
  voidBill:        (billId,  reason) => http('POST', `/void/bill/${billId}`,   { reason }),
  getVoidHistory:  ()                => http('GET',  '/void/history'),

  // ── STATION VIEW ─────────────────────────────────────────
  getStationItems:   (station) => http('GET',  `/station/${station}/items`),
  getPendingItems:   (station) => http('GET',  `/station/${station}/pending`),
  completeItem:      (itemId)  => http('POST', `/station/items/${itemId}/complete`),
  undoCompleteItem:  (itemId)  => http('POST', `/station/items/${itemId}/undo`),

  // ── INGREDIENTS ──────────────────────────────────────────
  getIngredients:    ()          => http('GET',    '/ingredients'),
  addIngredient:     (data)      => http('POST',   '/ingredients', data),
  updateIngredient:  (id, data)  => http('PUT',    `/ingredients/${id}`, data),
  adjustIngredientStock: (id, delta) => http('PATCH', `/ingredients/${id}/stock`, { delta }),
  deleteIngredient:  (id)        => http('DELETE', `/ingredients/${id}`),

  // ── RECIPES ──────────────────────────────────────────────
  getRecipes:        ()          => http('GET',    '/recipes'),
  getRecipeByMenu:   (menuId)    => http('GET',    `/recipes/menu/${menuId}`),
  createRecipe:      (data)      => http('POST',   '/recipes', data),
  updateRecipe:      (id, data)  => http('PUT',    `/recipes/${id}`, data),
  deleteRecipe:      (id)        => http('DELETE', `/recipes/${id}`),
  syncAllRecipes:    ()          => http('POST',   '/recipes/sync-all'),
};
