// ===== COMPONENT: Station Notification =====
// Tampilkan notifikasi pesanan ke Kitchen dan/atau Bar secara sequential

const StationNotif = {
  /**
   * @param {Array}    items      - cart items
   * @param {string}   tableName
   * @param {string}   kasirName
   * @param {string}   note
   * @param {Function} onDone     - callback setelah semua notif ditutup
   */
  show(items, tableName, kasirName, note, onDone) {
    const kitchen = items.filter(i => i.station === 'kitchen');
    const bar     = items.filter(i => i.station === 'bar');
    const sep     = '─'.repeat(26);

    const showBar = () => {
      if (!bar.length) { onDone(); return; }
      const body = `Meja  : ${tableName}\nKasir : ${kasirName}\n${sep}\n` +
                   bar.map(i => `• ${i.name}  ×${i.qty}`).join('\n') +
                   (note ? `\n\nCatatan: ${note}` : '');
      Modal.alert('🍹', 'Pesanan Terkirim ke Bar', body, 'OK — Lihat Bill');
      document.getElementById('_modalOverlay').querySelector('button').onclick = () => {
        document.getElementById('_modalOverlay').classList.add('hidden');
        onDone();
      };
    };

    if (kitchen.length) {
      const body = `Meja  : ${tableName}\nKasir : ${kasirName}\n${sep}\n` +
                   kitchen.map(i => `• ${i.name}  ×${i.qty}`).join('\n') +
                   (note ? `\n\nCatatan: ${note}` : '');
      Modal.alert('🍳', 'Pesanan Terkirim ke Kitchen', body, bar.length ? 'Lanjut → Bar' : 'OK — Lihat Bill');
      document.getElementById('_modalOverlay').querySelector('button').onclick = () => {
        document.getElementById('_modalOverlay').classList.add('hidden');
        showBar();
      };
    } else {
      showBar();
    }
  },
};
