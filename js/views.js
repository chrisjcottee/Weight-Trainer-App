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
  // The unified bottom bar (Finish + rest/quick-log) lives on <body>.
  if (typeof renderWorkoutBar === 'function') renderWorkoutBar();
  // Extra bottom padding only when the workout log (with its bottom bar) is shown.
  app.classList.toggle('workout-mode', view === 'workout' && !!state.active);
  const showTabs = view === 'today' || view === 'workout' || view === 'program';
  tabs.hidden = !showTabs;
  if (showTabs) {
    $$('.tab', tabs).forEach(t => t.classList.toggle('active', t.dataset.tab === state.tab));
    const wt = tabs.querySelector('[data-tab="workout"]');
    if (wt) wt.classList.toggle('has-session', !!state.active);
  }
  if (modal) renderModal();
  // Arm the back-trap whenever a closable layer is on screen.
  if (typeof navMaybeArm === 'function') navMaybeArm();
  // Scroll to top on view change (but not for active workout re-renders)
  if (view !== 'workout') window.scrollTo(0, 0);
}

/* ---------- Views ---------- */
const Views = {};


/* ---------- Bottom sheet ----------
   A slide-up panel for glanceable content (e.g. an exercise's recent
   history). Body-mounted like the modal; back / Escape / backdrop close. */
function showSheet(cfg) {
  sheet = cfg;
  let root = document.getElementById('sheet-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'sheet-root';
    document.body.appendChild(root);
  }
  root.innerHTML = `
    <div class="sheet-backdrop" id="sheet-backdrop">
      <div class="sheet" role="dialog" aria-label="${esc(sheet.title)}">
        <div class="sheet-grip" aria-hidden="true"></div>
        <div class="row between" style="margin-bottom:6px;">
          <h3 style="margin:0;">${esc(sheet.title)}</h3>
          <button class="btn icon" id="sheet-close" aria-label="Close">×</button>
        </div>
        ${sheet.bodyHtml || ''}
      </div>
    </div>
  `;
  if (typeof navMaybeArm === 'function') navMaybeArm();
}

function closeSheet() {
  sheet = null;
  const el = document.getElementById('sheet-root');
  if (el) el.remove();
}

/* ---------- Modal ---------- */
function showModal(cfg) {
  modal = cfg;
  renderModal();
  if (typeof navMaybeArm === 'function') navMaybeArm();
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

