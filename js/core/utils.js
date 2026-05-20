// ===== UTILITIES =====

/**
 * Format angka ke format Rupiah
 * @param {number} n
 * @returns {string} "Rp 35.000"
 */
function formatRp(n) {
  return 'Rp ' + Number(n).toLocaleString('id-ID');
}

/**
 * Format ISO string ke tanggal lokal Indonesia
 * @param {string} iso
 * @returns {string}
 */
function formatDate(iso) {
  return new Date(iso).toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

/**
 * Hitung elapsed time dari ISO string ke sekarang
 * @param {string} iso
 * @returns {string} "5 mnt" atau "1 jam 20 mnt"
 */
function getElapsed(iso) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  return diff < 60 ? `${diff} mnt` : `${Math.floor(diff / 60)} jam ${diff % 60} mnt`;
}

/**
 * Guard: redirect ke login jika belum ada session
 * @returns {object} session user
 */
function requireAuth() {
  const session = JSON.parse(sessionStorage.getItem('pos_session') || 'null');
  if (!session) { window.location.href = 'index.html'; return null; }
  return session;
}

/**
 * Guard: redirect jika bukan admin
 * @returns {object} session user
 */
function requireAdmin() {
  const session = requireAuth();
  if (session && session.role !== 'admin') {
    window.location.href = 'dashboard.html';
    return null;
  }
  return session;
}
