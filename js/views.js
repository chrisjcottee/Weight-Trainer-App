/* ---------- Routing ---------- */
function pickView() {
  if (state.celebration) return 'celebration';
  if (!state.program || state.editing) return 'setup';
  if (state.active) return 'workout';
  return state.tab;
}

function render() {
  const view = pickView();
  const app = $('#app');
  const tabs = $('#tabs');
  let body = (Views[view] || Views.today)();
  if (view !== 'workout') {
    body += `<div class="version-stamp">${APP_VERSION}</div>`;
  }
  app.innerHTML = body;
  // The rest timer only belongs to an active workout; clear it elsewhere.
  if (view !== 'workout' && typeof stopRest === 'function') stopRest();
  app.classList.toggle('fullscreen', view === 'workout');
  const showTabs = view === 'today' || view === 'program' || view === 'history';
  tabs.hidden = !showTabs;
  if (showTabs) {
    $$('.tab', tabs).forEach(t => t.classList.toggle('active', t.dataset.tab === state.tab));
  }
  if (modal) renderModal();
  // Scroll to top on view change (but not for active workout re-renders)
  if (view !== 'workout') window.scrollTo(0, 0);
}

/* ---------- Views ---------- */
const Views = {};


/* ---------- Modal ---------- */
function showModal(cfg) {
  modal = cfg;
  renderModal();
}
function closeModal() {
  modal = null;
  const el = document.getElementById('modal-root');
  if (el) el.remove();
}
function renderModal() {
  let root = document.getElementById('modal-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'modal-root';
    document.body.appendChild(root);
  }
  root.innerHTML = `
    <div class="modal-backdrop">
      <div class="modal">
        <h3>${esc(modal.title)}</h3>
        ${modal.body ? `<p>${esc(modal.body)}</p>` : ''}
        <div class="btn-group">
          ${modal.hideCancel ? '' : `<button class="btn secondary" id="modal-cancel">Cancel</button>`}
          <button class="btn" id="modal-confirm" style="${modal.danger ? 'background: var(--danger);' : ''}">${esc(modal.confirmText || 'OK')}</button>
        </div>
        ${modal.extraAction ? `<button class="modal-extra ${modal.extraAction.danger ? 'danger' : ''}" id="modal-extra">${esc(modal.extraAction.label)}</button>` : ''}
      </div>
    </div>
  `;
}

