// ===== MODAL UTILITY =====
const Modal = {
  _ensure() {
    if (document.getElementById('_modalOverlay')) return;
    const div = document.createElement('div');
    div.innerHTML = `
      <div id="_modalOverlay" class="modal-overlay hidden" style="z-index:9999">
        <div class="modal" style="max-width:460px;width:92%">
          <div id="_modalIcon" style="font-size:2rem;margin-bottom:.5rem;text-align:center"></div>
          <h3 id="_modalTitle" style="margin-bottom:.6rem"></h3>
          <div id="_modalBody" style="color:var(--text-muted);font-size:.9rem;line-height:1.6;margin-bottom:1.25rem;white-space:pre-wrap"></div>
          <div id="_modalActions" class="modal-actions"></div>
        </div>
      </div>`;
    document.body.appendChild(div.firstElementChild);
  },

  alert(icon, title, body, btnLabel = 'OK') {
    this._ensure();
    document.getElementById('_modalIcon').textContent  = icon;
    document.getElementById('_modalTitle').textContent = title;
    document.getElementById('_modalBody').textContent  = body;
    const actions = document.getElementById('_modalActions');
    actions.innerHTML = '';
    const btn = document.createElement('button');
    btn.className   = 'btn btn-primary btn-full';
    btn.textContent = btnLabel;
    btn.onclick = () => document.getElementById('_modalOverlay').classList.add('hidden');
    actions.appendChild(btn);
    document.getElementById('_modalOverlay').classList.remove('hidden');
  },

  confirm(icon, title, body, onConfirm, confirmLabel = 'Ya', cancelLabel = 'Batal', confirmClass = 'btn-danger') {
    this._ensure();
    document.getElementById('_modalIcon').textContent  = icon;
    document.getElementById('_modalTitle').textContent = title;
    document.getElementById('_modalBody').textContent  = body;
    const actions = document.getElementById('_modalActions');
    actions.innerHTML = '';

    const cancelBtn = document.createElement('button');
    cancelBtn.className   = 'btn btn-secondary';
    cancelBtn.textContent = cancelLabel;
    cancelBtn.style.flex  = '1';
    cancelBtn.onclick = () => document.getElementById('_modalOverlay').classList.add('hidden');

    const confirmBtn = document.createElement('button');
    confirmBtn.className   = `btn ${confirmClass}`;
    confirmBtn.textContent = confirmLabel;
    confirmBtn.style.flex  = '1';
    confirmBtn.onclick = () => {
      document.getElementById('_modalOverlay').classList.add('hidden');
      onConfirm();
    };

    actions.appendChild(cancelBtn);
    actions.appendChild(confirmBtn);
    document.getElementById('_modalOverlay').classList.remove('hidden');
  },
};
