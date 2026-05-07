// ===== AUTH =====

// Redirect jika sudah login
if (sessionStorage.getItem('pos_session')) {
  window.location.href = 'dashboard.html';
}

async function doLogin() {
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  const errEl    = document.getElementById('loginError');
  const btn      = document.getElementById('loginBtn');

  if (!username || !password) {
    errEl.textContent = 'Username dan password wajib diisi.';
    errEl.classList.remove('hidden');
    return;
  }

  errEl.classList.add('hidden');
  btn.disabled    = true;
  btn.textContent = 'Memuat...';

  try {
    const data = await API.login(username, password);
    sessionStorage.setItem('pos_session', JSON.stringify(data.user));
    window.location.href = 'dashboard.html';
  } catch (err) {
    errEl.textContent = err.message || 'Username atau password salah.';
    errEl.classList.remove('hidden');
    btn.disabled    = false;
    btn.textContent = 'Login';
  }
}

// Klik tombol
document.getElementById('loginBtn').addEventListener('click', doLogin);

// Enter di input juga trigger login
document.getElementById('loginForm').addEventListener('keydown', function (e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    doLogin();
  }
});
