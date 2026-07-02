/* ---------- Routing ---------- */
function pickView() {
  if (state.celebration) return 'celebration';
  if (state.editing) return 'setup';
  // No active program yet: offer the choice screen (create vs. pick a program)
  // instead of dropping straight into the editor.
  if (!state.program) return 'start';
  // The active workout now lives in its own tab, so honour state.tab and let
  // the user freely navigate in and out of the workout while a session runs.
  return state.tab;
}

function render() {
  const view = pickView();
  const app = $('#app');
  const tabs = $('#tabs');
  let body = (Views[view] || Views.today)();
  if (view === 'program') {
    body += `<div class="version-stamp">${APP_VERSION}</div>`;
  }
  app.innerHTML = body;
  // The rest timer belongs to the active session, not a specific tab — keep it
  // running while you navigate, and clear it only when the session ends.
  if (!state.active && typeof stopRest === 'function') stopRest();
  // Extra bottom padding only when the workout log (with its Finish bar) is shown.
  app.classList.toggle('workout-mode', view === 'workout' && !!state.active);
  const showTabs = view === 'today' || view === 'workout' || view === 'program';
  tabs.hidden = !showTabs;
  if (showTabs) {
    $$('.tab', tabs).forEach(t => t.classList.toggle('active', t.dataset.tab === state.tab));
    const wt = tabs.querySelector('[data-tab="workout"]');
    if (wt) wt.classList.toggle('has-session', !!state.active);
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

