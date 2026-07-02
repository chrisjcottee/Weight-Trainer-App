/* ---------- Back-button semantics ----------
   The browser/Android back gesture closes the topmost UI layer instead of
   exiting the PWA. Design: a "trap" history entry is pushed whenever any
   closable layer is open (modal, program editor, celebration, or a
   non-Today tab). popstate inspects app state directly — state is the
   single source of truth under the full-re-render model, so there is no
   parallel stack to fall out of sync. Programmatic closes (buttons,
   Escape) touch no history; the trap simply re-arms on the next layer.

   Net behaviour: back closes modal → editor/celebration → returns to
   Today → exits (second press). */

let navArmed = false;

function navEnsureArmed() {
  if (navArmed) return;
  try { history.pushState({ wt: 1 }, ''); navArmed = true; } catch (e) {}
}

// Close the topmost layer. Returns true if the back press was consumed.
function navConsumeBack() {
  if (sheet) {
    closeSheet();
    return true;
  }
  if (modal) {
    // Same semantics as tapping Cancel / the backdrop.
    if (modal.onCancel) modal.onCancel();
    closeModal();
    return true;
  }
  if (state.editing) {
    // Same semantics as the editor's Cancel button.
    setupDraft = null;
    state.editing = false;
    setState({ tab: 'program' });
    return true;
  }
  if (state.celebration) {
    // Same semantics as the Continue button.
    selectedDateTs = dayStartTs(Date.now());
    expandedPickIdx = null;
    state.celebration = null;
    state.tab = 'today';
    save();
    render();
    return true;
  }
  if (state.tab !== 'today') {
    setState({ tab: 'today' });
    return true;
  }
  return false;
}

function navInit() {
  window.addEventListener('popstate', () => {
    navArmed = false;
    if (navConsumeBack()) navEnsureArmed();
    // Not consumed: stay unarmed so the next back exits the app. Opening
    // any layer re-arms via navMaybeArm().
  });
  navMaybeArm();
}

// Called after every render (and on modal open): arm the trap whenever a
// closable layer is on screen.
function navMaybeArm() {
  if (modal || sheet || state.editing || state.celebration || state.tab !== 'today') {
    navEnsureArmed();
  }
}
