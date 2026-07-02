/* ---------- Undo snackbar ----------
   Forgiveness over confirmation: recoverable actions (skip exercise,
   delete exercise / set / logged session) apply immediately and offer a
   brief Undo instead of asking first. Mounted on <body> (like the rest
   timer) so it survives full re-renders. One live undo at a time; any
   later state-mutating save() commits (dismisses) a pending undo, so an
   undo can never resurrect state the user has since built on. */

let undoState = null;   // { timer, undoFn, armedAt }
let undoSaveCount = 0;  // bumped by save() via noteSaveForUndo()

function undoBar(message, undoFn, opts = {}) {
  dismissUndoBar();
  const bar = document.createElement('div');
  bar.id = 'undo-bar';
  bar.innerHTML = `
    <span class="undo-msg">${esc(message)}</span>
    <button type="button" id="undo-action">Undo</button>
  `;
  document.body.appendChild(bar);
  undoState = {
    undoFn,
    armedAt: undoSaveCount,
    timer: setTimeout(dismissUndoBar, opts.timeout || 6000)
  };
}

function dismissUndoBar() {
  if (!undoState) return;
  clearTimeout(undoState.timer);
  undoState = null;
  const el = document.getElementById('undo-bar');
  if (el) el.remove();
}

// save() calls this on every persist. A save after the bar was armed means
// the user has moved on — commit the action by dismissing its undo.
function noteSaveForUndo() {
  undoSaveCount++;
  if (undoState && undoSaveCount > undoState.armedAt) dismissUndoBar();
}

function runPendingUndo() {
  if (!undoState) return;
  const fn = undoState.undoFn;
  dismissUndoBar();
  fn();
}

// Snapshot the given top-level state slices; returns a function that
// restores them (and resets transient UI pointers) when called.
function captureUndoSlices(keys) {
  const snap = {};
  keys.forEach(k => { snap[k] = structuredClone(state[k]); });
  return () => {
    keys.forEach(k => { state[k] = structuredClone(snap[k]); });
    editingSet = null;
    lingeringExIdx = null;
    expandedExIdx = null;
    save();
    render();
  };
}
