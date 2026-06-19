/* ---------- Event handling ---------- */
const SWIPE_REVEAL = 72; // px the set face slides to expose the trash button
let swipe = null;
let suppressNextClick = false;

function bindGlobalEvents() {
  document.addEventListener('click', onClick);
  document.addEventListener('input', onInput);
  document.addEventListener('keydown', onKeydown);
  document.addEventListener('focusin', onFocusIn);
  document.addEventListener('touchstart', onTouchStart, { passive: true });
  document.addEventListener('touchmove', onTouchMove, { passive: false });
  document.addEventListener('touchend', onTouchEnd);
  document.addEventListener('touchcancel', onTouchEnd);
  document.addEventListener('pointerdown', onDragHandleDown);
}

/* ---------- Drag-to-reorder upcoming exercises ----------
   Press the dots handle on an upcoming exercise row and drag vertically.
   The dragged row follows the pointer; siblings shift out of the way. On
   drop, the new order is committed to the session and the program. */
let dragEx = null;

function onDragHandleDown(e) {
  if (e.button != null && e.button !== 0) return;
  const handle = e.target.closest && e.target.closest('.drag-handle');
  if (!handle) return;
  const row = handle.closest('.ex-rail-step');
  const rail = row && row.closest('.ex-rail');
  if (!row || !rail) return;
  const rows = Array.from(rail.querySelectorAll('.ex-rail-step.upcoming'));
  const fromPos = rows.indexOf(row);
  if (rows.length < 2 || fromPos < 0) return;
  e.preventDefault();
  closeAllReveals(null);
  dragEx = {
    pointerId: e.pointerId,
    handle, row, rows,
    rects: rows.map(r => r.getBoundingClientRect()),
    startY: e.clientY,
    fromPos,
    curPos: fromPos,
    moved: false
  };
  rows.forEach(r => r.classList.add(r === row ? 'dragging' : 'drag-sib'));
  try { handle.setPointerCapture(e.pointerId); } catch (_) {}
  document.addEventListener('pointermove', onDragMove);
  document.addEventListener('pointerup', onDragEnd);
  document.addEventListener('pointercancel', onDragEnd);
}

function onDragMove(e) {
  if (!dragEx || e.pointerId !== dragEx.pointerId) return;
  const d = dragEx;
  const dy = e.clientY - d.startY;
  if (Math.abs(dy) > 4) d.moved = true;
  d.row.style.transform = `translateY(${dy}px)`;

  const dragRect = d.rects[d.fromPos];
  // A row is passed once the dragged row's leading edge crosses its center
  // (i.e. overlaps it by half) — the standard sortable feel.
  const top = dragRect.top + dy;
  const bottom = dragRect.bottom + dy;
  let pos = d.fromPos;
  d.rows.forEach((r, i) => {
    if (i === d.fromPos) return;
    const center = d.rects[i].top + d.rects[i].height / 2;
    if (i < d.fromPos && top < center) pos--;
    if (i > d.fromPos && bottom > center) pos++;
  });
  d.curPos = pos;

  // Siblings shift by the dragged row's height to open/close the gap.
  d.rows.forEach((r, i) => {
    if (i === d.fromPos) return;
    const without = i < d.fromPos ? i : i - 1; // position with dragged removed
    const newPos = without >= pos ? without + 1 : without;
    r.style.transform = newPos !== i ? `translateY(${(newPos - i) * dragRect.height}px)` : '';
  });
}

function onDragEnd(e) {
  if (!dragEx || e.pointerId !== dragEx.pointerId) return;
  // Fold the release position into the final slot calculation.
  if (e.type === 'pointerup' && typeof e.clientY === 'number') onDragMove(e);
  const d = dragEx;
  dragEx = null;
  document.removeEventListener('pointermove', onDragMove);
  document.removeEventListener('pointerup', onDragEnd);
  document.removeEventListener('pointercancel', onDragEnd);
  // A drag must not double as a tap on the row underneath.
  suppressNextClick = true;
  setTimeout(() => { suppressNextClick = false; }, 400);

  const commit = d.moved && e.type !== 'pointercancel' && d.curPos !== d.fromPos;
  const slotIdxs = d.rows.map(r => +r.dataset.exIdx);
  const seq = d.rows.map((_, i) => i).filter(i => i !== d.fromPos);
  seq.splice(d.curPos, 0, d.fromPos);
  const orderedExIdxs = seq.map(i => +d.rows[i].dataset.exIdx);

  d.rows.forEach(r => {
    r.style.transform = '';
    r.classList.remove('dragging', 'drag-sib');
  });
  if (commit) reorderWorkoutExercises(slotIdxs, orderedExIdxs);
}

/* ---------- Swipe-to-reveal delete on set rows and exercise rows ---------- */
function closeAllReveals(except) {
  document.querySelectorAll('.swipe-wrap.revealed').forEach(el => {
    if (el !== except) el.classList.remove('revealed');
  });
}

/* ---------- Exercise overflow (3-dot) menu ---------- */
function closeExMenus() {
  document.querySelectorAll('.ex-menu-wrap.open').forEach(w => {
    w.classList.remove('open');
    const b = w.querySelector('.ex-menu-btn');
    if (b) b.setAttribute('aria-expanded', 'false');
  });
}

function onTouchStart(e) {
  // A fresh touch is deliberate intent — never suppress its click.
  suppressNextClick = false;
  if (e.touches.length !== 1) { swipe = null; return; }
  // Innermost swipeable wins: a set row inside an exercise card swipes the
  // set; touching the card elsewhere swipes the whole exercise.
  const wrap = e.target.closest && e.target.closest('.swipe-wrap');
  // Don't begin a swipe from a trash button or from a text input (so the
  // active row's weight field keeps its native touch behaviour).
  if (!wrap || (e.target.closest && e.target.closest('.set-delete, .drag-handle, input'))) { swipe = null; return; }
  const face = wrap.querySelector(':scope > .swipe-face');
  if (!face) { swipe = null; return; }
  const t = e.touches[0];
  swipe = {
    wrap, face,
    startX: t.clientX, startY: t.clientY,
    base: wrap.classList.contains('revealed') ? -SWIPE_REVEAL : 0,
    horizontal: false, vertical: false, curr: null
  };
}

function onTouchMove(e) {
  if (!swipe) return;
  const t = e.touches[0];
  const dx = t.clientX - swipe.startX;
  const dy = t.clientY - swipe.startY;
  if (!swipe.horizontal && !swipe.vertical) {
    if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) swipe.horizontal = true;
    else if (Math.abs(dy) > 8) swipe.vertical = true;
  }
  if (swipe.vertical) { swipe = null; return; } // it's a scroll — let it through
  if (!swipe.horizontal) return;
  e.preventDefault(); // claim the gesture so the page doesn't scroll
  swipe.wrap.classList.add('swiping'); // reveal the trash only while dragging
  let tx = Math.max(-SWIPE_REVEAL, Math.min(0, swipe.base + dx));
  swipe.curr = tx;
  swipe.face.style.transition = 'none';
  swipe.face.style.transform = `translateX(${tx}px)`;
}

function onTouchEnd() {
  if (!swipe) return;
  const s = swipe;
  swipe = null;
  s.wrap.classList.remove('swiping');
  if (!s.horizontal) return;
  // Hand the snap back to the CSS class transition.
  s.face.style.transition = '';
  s.face.style.transform = '';
  const shouldReveal = (s.curr != null ? s.curr : s.base) <= -SWIPE_REVEAL / 2;
  closeAllReveals(s.wrap);
  s.wrap.classList.toggle('revealed', shouldReveal);
  // A horizontal swipe must not also fire the tap-to-edit click.
  suppressNextClick = true;
  setTimeout(() => { suppressNextClick = false; }, 400);
}

function onFocusIn(e) {
  // Select the prefilled weight on focus so it can be overtyped immediately.
  if (e.target.classList && e.target.classList.contains('set-w') && e.target.value) {
    setTimeout(() => { try { e.target.select(); } catch (_) {} }, 0);
  }
}

function onClick(e) {
  // A just-finished swipe shouldn't trigger a tap action.
  if (suppressNextClick) { suppressNextClick = false; return; }
  // The reorder handle is drag-only — a stray tap on it must not select the row.
  if (e.target.closest && e.target.closest('.drag-handle')) return;

  // A tap outside an open exercise menu dismisses it, then proceeds normally.
  // Taps inside the menu (toggle button or items) are handled further down.
  if (document.querySelector('.ex-menu-wrap.open') &&
      !(e.target.closest && e.target.closest('.ex-menu-wrap'))) {
    closeExMenus();
  }

  // Tap the revealed trash button to delete that set.
  const delBtn = e.target.closest && e.target.closest('[data-act="delete-set"]');
  if (delBtn) {
    const [exIdx, si] = delBtn.dataset.delSet.split(',').map(Number);
    removeSet(exIdx, si);
    return;
  }
  // "Delete exercise" in the 3-dot menu — remove the whole exercise from the
  // workout and from the program going forward.
  const exDelBtn = e.target.closest && e.target.closest('[data-act="delete-ex"]');
  if (exDelBtn) {
    closeExMenus();
    closeAllReveals(null);
    removeExerciseFromWorkout(+exDelBtn.dataset.exIdx);
    return;
  }
  // With a row swiped open, the next tap anywhere just closes it.
  if (document.querySelector('.swipe-wrap.revealed')) {
    closeAllReveals(null);
    return;
  }

  const t = e.target.closest('[data-tab]');
  if (t) {
    setState({ tab: t.dataset.tab });
    return;
  }

  // Rest timer controls
  const restBtn = e.target.closest('[data-rest]');
  if (restBtn) {
    const v = restBtn.dataset.rest;
    if (v === 'skip') stopRest();
    else adjustRest(parseInt(v, 10));
    return;
  }

  // "Last time" chip — fill the active set with the previous values
  const fillBtn = e.target.closest('[data-fill-last]');
  if (fillBtn) {
    const row = fillBtn.closest('.set-row.active');
    if (row) {
      const wInput = row.querySelector('.set-w');
      const rHidden = row.querySelector('.set-r');
      const rDisplay = row.querySelector('.reps-stepper .step-val');
      if (wInput) wInput.value = fillBtn.dataset.w;
      if (rHidden) rHidden.value = fillBtn.dataset.r;
      if (rDisplay) rDisplay.textContent = fillBtn.dataset.r;
      row.dataset.dirty = '1';
      updateLogBtn(row);
    }
    return;
  }

  // Setup screen
  if (e.target.classList.contains('step-btn')) {
    if (e.target.closest('.set-row')) {
      handleRepsStepperClick(e.target);
    } else {
      handleStepperClick(e.target);
    }
    return;
  }
  if (e.target.id === 'add-day') {
    setupDraft.days.push(makeDay());
    rerenderSetup();
    return;
  }
  if (e.target.dataset.act === 'rm-day') {
    const di = +e.target.closest('[data-day]').dataset.day;
    setupDraft.days.splice(di, 1);
    rerenderSetup();
    return;
  }
  if (e.target.dataset.act === 'add-ex') {
    const di = +e.target.closest('[data-day]').dataset.day;
    setupDraft.days[di].exercises.push(makeEx());
    rerenderSetup();
    return;
  }
  if (e.target.dataset.act === 'rm-ex') {
    const di = +e.target.closest('[data-day]').dataset.day;
    const ej = +e.target.closest('[data-ex]').dataset.ex;
    setupDraft.days[di].exercises.splice(ej, 1);
    if (setupDraft.days[di].exercises.length === 0) {
      setupDraft.days[di].exercises.push(makeEx());
    }
    rerenderSetup();
    return;
  }
  if (e.target.id === 'save-program') {
    saveSetup();
    return;
  }
  if (e.target.id === 'cancel-setup') {
    setupDraft = null;
    state.editing = false;
    setState({ tab: 'program' });
    return;
  }

  // Program tab (calendar)
  const weekEl = e.target.closest && e.target.closest('[data-select-week]');
  if (weekEl) {
    calendarExpanded = true;
    render();
    return;
  }
  const dayCell = e.target.closest && e.target.closest('[data-select-date]');
  if (dayCell) {
    selectedDateTs = parseInt(dayCell.dataset.selectDate, 10);
    expandedPickIdx = null;
    render();
    return;
  }
  if (e.target.closest && e.target.closest('#toggle-calendar')) {
    calendarExpanded = !calendarExpanded;
    render();
    return;
  }
  const sessToggle = e.target.closest && e.target.closest('[data-toggle-session]');
  if (sessToggle) {
    const key = parseInt(sessToggle.dataset.toggleSession, 10);
    expandedSessionKey = (expandedSessionKey === key) ? null : key;
    render();
    return;
  }
  const progToggle = e.target.closest && e.target.closest('[data-toggle-progress]');
  if (progToggle) {
    const name = progToggle.dataset.toggleProgress; // dataset auto-decodes the esc()'d entities
    expandedProgressName = (expandedProgressName === name) ? null : name;
    render();
    return;
  }
  const editSessionBtn = e.target.closest && e.target.closest('[data-edit-session]');
  if (editSessionBtn) {
    editLoggedSession(parseInt(editSessionBtn.dataset.editSession, 10));
    return;
  }
  const delSessionBtn = e.target.closest && e.target.closest('[data-delete-session]');
  if (delSessionBtn) {
    deleteLoggedSession(parseInt(delSessionBtn.dataset.deleteSession, 10));
    return;
  }
  if (e.target.dataset.startDay != null) {
    startWorkout(parseInt(e.target.dataset.startDay, 10));
    return;
  }
  const pickEl = e.target.closest && e.target.closest('[data-toggle-pick]');
  if (pickEl) {
    const i = parseInt(pickEl.dataset.togglePick, 10);
    expandedPickIdx = expandedPickIdx === i ? null : i;
    render();
    return;
  }
  const expandEl = e.target.closest && e.target.closest('[data-expand-day-key]');
  if (expandEl && !e.target.closest('[data-start-day]')) {
    const key = expandEl.dataset.expandDayKey;
    expandedDayKey = (expandedDayKey === key) ? null : key;
    render();
    return;
  }
  if (e.target.id === 'restart-program') {
    showModal({
      title: 'Start program over?',
      body: 'Your week progress will reset to Week 1. History stays intact.',
      confirmText: 'Restart',
      onConfirm: () => {
        state.currentRun = { startedAt: Date.now(), weekIndex: 0, completedDayIndices: [] };
        selectedWeekIndex = null;
        expandedDayKey = null;
        closeModal();
        setState({});
      }
    });
    return;
  }

  // Start (choice) screen
  if (e.target.id === 'start-create') {
    setupDraft = { id: null, name: 'My Program', weeks: 8, days: [makeDay()], makeActive: true };
    state.editing = true;
    save();
    render();
    return;
  }
  const toggleTpl = e.target.closest && e.target.closest('[data-act="toggle-template"]');
  if (toggleTpl) {
    const row = toggleTpl.closest('[data-template-id]');
    const id = row && row.dataset.templateId;
    expandedTemplateId = (expandedTemplateId === id) ? null : id;
    render();
    return;
  }
  if (e.target.dataset.act === 'use-template') {
    const id = e.target.dataset.templateId;
    const tpl = findPrebuiltProgram(id);
    if (!tpl) return;
    showModal({
      title: `Use ${tpl.name}?`,
      body: 'This adds an editable copy to your library and makes it your active program, starting from Week 1.',
      confirmText: 'Use Program',
      onConfirm: () => {
        if (useTemplateProgram(id)) {
          expandedTemplateId = null;
          closeModal();
          setState({ tab: 'today' });
        } else {
          closeModal();
        }
      }
    });
    return;
  }

  // Program tab
  if (e.target.id === 'add-program') {
    setupDraft = { id: null, name: 'New Program', weeks: 8, days: [makeDay()], makeActive: true };
    state.editing = true;
    save();
    render();
    return;
  }
  if (e.target.id === 'edit-program') {
    const active = findProgramRecord(state.activeProgramId);
    const program = active || makeProgramRecord(state.program || { name: 'My Program', weeks: 8, template: [makeDay()] }, { id: state.activeProgramId || undefined });
    setupDraft = { id: program.id, name: program.name, weeks: program.weeks, days: structuredClone(program.template), makeActive: true };
    state.editing = true;
    save();
    render();
    return;
  }
  const programRow = e.target.closest && e.target.closest('[data-program-id]');
  if (programRow && e.target.dataset.act === 'edit-program-library') {
    const program = findProgramRecord(programRow.dataset.programId);
    if (!program) return;
    setupDraft = { id: program.id, name: program.name, weeks: program.weeks, days: structuredClone(program.template), makeActive: program.id === state.activeProgramId };
    state.editing = true;
    save();
    render();
    return;
  }
  if (programRow && e.target.dataset.act === 'use-program') {
    showModal({
      title: 'Use this program?',
      body: 'Today will switch to this program and start its progress from Week 1.',
      confirmText: 'Use Program',
      onConfirm: () => {
        setActiveProgram(programRow.dataset.programId, { resetProgress: true });
        closeModal();
        setState({ tab: 'today' });
      }
    });
    return;
  }
  if (programRow && e.target.dataset.act === 'delete-program-library') {
    deleteProgramRecord(programRow.dataset.programId);
    return;
  }
  if (e.target.id === 'reset-program') {
    showModal({
      title: 'Reset everything?',
      body: 'This deletes your program, all logged workouts, XP, and streak. Cannot be undone.',
      confirmText: 'Delete All',
      danger: true,
      onConfirm: () => {
        state = structuredClone(DEFAULT_STATE);
        setupDraft = null;
        selectedWeekIndex = null;
        expandedDayKey = null;
        closeModal();
        setState({});
      }
    });
    return;
  }
  if (e.target.id === 'add-library-exercise') {
    addLibraryExercise();
    return;
  }
  const libraryRow = e.target.closest && e.target.closest('[data-library-ex-id]');
  if (libraryRow && e.target.dataset.act === 'edit-library-ex') {
    editingExerciseLibraryId = libraryRow.dataset.libraryExId;
    render();
    return;
  }
  if (libraryRow && e.target.dataset.act === 'cancel-library-ex') {
    editingExerciseLibraryId = null;
    render();
    return;
  }
  if (libraryRow && e.target.dataset.act === 'save-library-ex') {
    saveLibraryExercise(libraryRow);
    return;
  }
  if (libraryRow && e.target.dataset.act === 'remove-library-ex') {
    removeLibraryExercise(libraryRow.dataset.libraryExId);
    return;
  }

  // Workout
  if (e.target.id === 'finish-workout') {
    if (withUnloggedSetGuard(endWorkoutFlow, 'Finish without set')) return;
    endWorkoutFlow();
    return;
  }
  // 3-dot exercise menu — toggle open/closed.
  const exMenuBtn = e.target.closest && e.target.closest('[data-act="ex-menu"]');
  if (exMenuBtn) {
    const wrap = exMenuBtn.closest('.ex-menu-wrap');
    const open = wrap.classList.toggle('open');
    exMenuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    return;
  }
  const skipExBtn = e.target.closest && e.target.closest('[data-act="skip-ex"]');
  if (skipExBtn) {
    closeExMenus();
    const exIdx = parseInt(skipExBtn.dataset.exIdx, 10);
    if (withUnloggedSetGuard(() => skipExercise(exIdx), 'Skip without set')) return;
    skipExercise(exIdx);
    return;
  }
  // "+ Add set" — append an extra loggable set to an exercise
  const addSetBtn = e.target.closest && e.target.closest('[data-act="add-set"]');
  if (addSetBtn) {
    addSet(+addSetBtn.dataset.exIdx);
    return;
  }
  // "+ Add Exercise" — open the inline picker on the Workout tab
  if (e.target.dataset.act === 'add-ex-workout') {
    addingExercise = true;
    render();
    requestAnimationFrame(() => {
      const input = document.getElementById('new-workout-ex');
      if (input) input.focus();
    });
    return;
  }
  if (e.target.dataset.act === 'confirm-add-ex') {
    const input = document.getElementById('new-workout-ex');
    const name = input ? input.value : '';
    if (withUnloggedSetGuard(() => addExerciseToWorkout(name), 'Add without saving set')) return;
    addExerciseToWorkout(name);
    return;
  }
  if (e.target.dataset.act === 'cancel-add-ex') {
    addingExercise = false;
    render();
    return;
  }
  // Tap an outstanding exercise to make it the active one
  const selectActive = e.target.closest && e.target.closest('[data-select-active]');
  if (selectActive) {
    setActiveExercise(+selectActive.dataset.selectActive);
    return;
  }
  // Collapse / expand the Completed section
  if (e.target.closest && e.target.closest('[data-toggle-completed]')) {
    completedCollapsed = !completedCollapsed;
    render();
    return;
  }
  // Reopen a completed exercise in the Completed section to edit its logged sets
  const toggleDone = e.target.closest && e.target.closest('[data-toggle-done]');
  if (toggleDone) {
    const idx = +toggleDone.dataset.toggleDone;
    maybeFlushLinger(idx);
    expandedExIdx = (expandedExIdx === idx) ? null : idx;
    editingSet = null;
    render();
    return;
  }
  const editEl = e.target.closest && e.target.closest('[data-edit-set]');
  if (editEl) {
    const [exIdx, setIdx] = editEl.dataset.editSet.split(',').map(Number);
    maybeFlushLinger(exIdx);
    editingSet = { exIdx, setIdx };
    render();
    return;
  }
  if (e.target.dataset.act === 'save-edit') {
    saveEditedSet(e.target.closest('.set-row'));
    return;
  }
  if (e.target.dataset.act === 'cancel-edit') {
    editingSet = null;
    render();
    return;
  }
  if (e.target.classList.contains('log-btn')) {
    logCurrentSet(e.target.closest('.set-row'));
    return;
  }
  if (e.target.classList.contains('dot') && e.target.dataset.jump != null) {
    const idx = +e.target.dataset.jump;
    const card = document.querySelector(`[data-ex-idx="${idx}"]`);
    if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }

  if (e.target.id === 'celebrate-continue') {
    selectedDateTs = dayStartTs(Date.now());
    expandedPickIdx = null;
    state.celebration = null;
    // The session is over — return to Today rather than the empty Workout tab.
    state.tab = 'today';
    save();
    render();
    return;
  }

  // Modal
  if (e.target.classList.contains('modal-backdrop')) {
    closeModal();
    return;
  }
  if (e.target.id === 'modal-cancel') {
    closeModal();
    return;
  }
  if (e.target.id === 'modal-confirm') {
    const fn = modal && modal.onConfirm;
    if (fn) fn();
    return;
  }
  if (e.target.id === 'modal-extra') {
    const fn = modal && modal.extraAction && modal.extraAction.onClick;
    if (fn) fn();
    return;
  }
}

function onInput(e) {
  if (e.target.id === 'exercise-library-search') {
    exerciseLibrarySearch = e.target.value;
    const pos = e.target.selectionStart || exerciseLibrarySearch.length;
    const scrollY = window.scrollY || 0;
    render();
    requestAnimationFrame(() => {
      window.scrollTo(0, scrollY);
      const input = document.getElementById('exercise-library-search');
      if (input) {
        input.focus();
        try { input.setSelectionRange(pos, pos); } catch (_) {}
      }
    });
    return;
  }

  // Setup live edits
  if (e.target.id === 'prog-name') {
    setupDraft.name = e.target.value;
    return;
  }
  if (e.target.classList.contains('day-name')) {
    const di = +e.target.closest('[data-day]').dataset.day;
    setupDraft.days[di].name = e.target.value;
    return;
  }
  if (e.target.matches('.ex-editor input[data-f]')) {
    const di = +e.target.closest('[data-day]').dataset.day;
    const ej = +e.target.closest('[data-ex]').dataset.ex;
    const field = e.target.dataset.f;
    const val = field === 'name' ? e.target.value : parseFloat(e.target.value) || 0;
    setupDraft.days[di].exercises[ej][field] = val;
    return;
  }

  // Workout set inputs
  if (e.target.classList.contains('set-w') || e.target.classList.contains('set-r')) {
    const row = e.target.closest('.set-row');
    if (row) row.dataset.dirty = '1';
    updateLogBtn(row);
    return;
  }
}

function onKeydown(e) {
  if (e.key === 'Escape' && document.querySelector('.ex-menu-wrap.open')) {
    closeExMenus();
    return;
  }
  if (e.key === 'Enter') {
    if (e.target.id === 'new-exercise-name') {
      e.preventDefault();
      addLibraryExercise();
      return;
    }
    if (e.target.id === 'new-workout-ex') {
      e.preventDefault();
      const name = e.target.value;
      if (withUnloggedSetGuard(() => addExerciseToWorkout(name), 'Add without saving set')) return;
      addExerciseToWorkout(name);
      return;
    }
    const libraryEditRow = e.target.closest && e.target.closest('.library-row.editing');
    if (libraryEditRow) {
      e.preventDefault();
      saveLibraryExercise(libraryEditRow);
      return;
    }
    const editRow = e.target.closest && e.target.closest('.set-row.editing');
    if (editRow) {
      e.preventDefault();
      saveEditedSet(editRow);
      return;
    }
    const row = e.target.closest && e.target.closest('.set-row.active');
    if (row) {
      e.preventDefault();
      const btn = row.querySelector('.log-btn');
      if (btn && !btn.disabled) logCurrentSet(row);
    }
  }
  if (e.key === 'Escape') {
    if (editingSet) {
      editingSet = null;
      render();
      return;
    }
    if (addingExercise) {
      addingExercise = false;
      render();
      return;
    }
    if (modal) closeModal();
  }
}

function updateLogBtn(row) {
  if (!row) return;
  const w = parseFloat(row.querySelector('.set-w').value);
  const r = parseInt(row.querySelector('.set-r').value, 10);
  const ok = !isNaN(w) && w >= 0 && !isNaN(r) && r > 0;
  row.querySelector('.log-btn').disabled = !ok;
}

function rerenderSetup() {
  const app = $('#app');
  app.innerHTML = Views.setup();
}

function handleRepsStepperClick(btn) {
  const row = btn.closest('.set-row');
  if (!row) return;
  const hidden = row.querySelector('.set-r');
  const display = row.querySelector('.reps-stepper .step-val');
  if (!hidden || !display) return;
  const delta = parseInt(btn.dataset.step, 10);
  const cur = parseInt(hidden.value, 10) || 0;
  const next = clampStepper(cur + delta, 1, 100);
  hidden.value = next;
  display.textContent = next;
  row.dataset.dirty = '1';
  updateLogBtn(row);
}

function handleStepperClick(btn) {
  const delta = parseInt(btn.dataset.step, 10);
  const stepper = btn.closest('.stepper');
  if (!stepper) return;
  // Default rest-timer stepper (Library tab). Must come before the weeks
  // branch, which assumes a setupDraft exists.
  if (stepper.dataset.stepperTarget === 'rest-default') {
    setRestDefault(restDefaultSeconds() + delta); // delta is ±15; setRestDefault clamps 15–600
    render();
    return;
  }
  // Program-level stepper (weeks)
  if (stepper.dataset.stepperTarget === 'weeks') {
    setupDraft.weeks = clampStepper(setupDraft.weeks + delta, 1, 52);
    rerenderSetup();
    return;
  }
  // Per-exercise stepper (sets or reps)
  const field = stepper.dataset.f;
  if (!field) return;
  const dayEl = btn.closest('[data-day]');
  const exEl = btn.closest('[data-ex]');
  if (!dayEl || !exEl) return;
  const di = +dayEl.dataset.day;
  const ei = +exEl.dataset.ex;
  const max = field === 'sets' ? 20 : 100;
  const ex = setupDraft.days[di].exercises[ei];
  ex[field] = clampStepper((ex[field] || 1) + delta, 1, max);
  rerenderSetup();
}

function clampStepper(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function findLibraryExercise(id) {
  state.exerciseLibrary = normalizeExerciseLibrary(state);
  return state.exerciseLibrary.find(e => e.id === id);
}

function addLibraryExercise() {
  const input = document.getElementById('new-exercise-name');
  const name = input ? input.value.trim() : '';
  if (!name) {
    showModal({
      title: 'Name required',
      body: 'Enter an exercise name first.',
      confirmText: 'OK',
      hideCancel: true,
      onConfirm: closeModal
    });
    return;
  }
  ensureExerciseInLibrary(name);
  exerciseLibrarySearch = '';
  save();
  render();
}

function saveLibraryExercise(row) {
  const ex = findLibraryExercise(row.dataset.libraryExId);
  if (!ex) return;
  const input = row.querySelector('.library-edit-name');
  const nextName = input ? input.value.trim() : '';
  if (!nextName) {
    showModal({
      title: 'Name required',
      body: 'Exercise names cannot be blank.',
      confirmText: 'OK',
      hideCancel: true,
      onConfirm: closeModal
    });
    return;
  }
  const duplicate = state.exerciseLibrary.find(e =>
    e.id !== ex.id && !e.archived && e.name.toLowerCase() === nextName.toLowerCase()
  );
  if (duplicate) {
    showModal({
      title: 'Already in library',
      body: 'An active exercise already uses that name.',
      confirmText: 'OK',
      hideCancel: true,
      onConfirm: closeModal
    });
    return;
  }
  const oldName = ex.name;
  ex.name = nextName;
  updateProgramExerciseName(oldName, nextName);
  editingExerciseLibraryId = null;
  state.exerciseLibrary.sort((a, b) => a.name.localeCompare(b.name));
  save();
  render();
}

function removeLibraryExercise(id) {
  const ex = findLibraryExercise(id);
  if (!ex) return;
  const doRemove = () => {
    ex.archived = true;
    editingExerciseLibraryId = null;
    closeModal();
    save();
    render();
  };
  if (exerciseUsedInCurrentProgram(ex.name)) {
    showModal({
      title: 'Remove from library?',
      body: 'This exercise stays in your current program and workout history, but it will no longer appear as a new selection.',
      confirmText: 'Remove',
      danger: true,
      onConfirm: doRemove
    });
    return;
  }
  doRemove();
}

function deleteProgramRecord(id) {
  const program = findProgramRecord(id);
  if (!program) return;
  const remaining = activeProgramLibrary().filter(p => p.id !== id);
  const doDelete = () => {
    program.archived = true;
    if (state.activeProgramId === id) {
      if (remaining.length) {
        setActiveProgram(remaining[0].id, { resetProgress: true });
      } else {
        state.activeProgramId = null;
        state.program = null;
        state.active = null;
        state.celebration = null;
        state.currentRun = { startedAt: null, weekIndex: 0, completedDayIndices: [] };
        selectedWeekIndex = null;
        expandedDayKey = null;
      }
    }
    state.programLibrary = state.programLibrary.filter(p => p.id !== id);
    closeModal();
    save();
    render();
  };
  showModal({
    title: 'Delete program?',
    body: state.activeProgramId === id
      ? 'This removes the active program from your Library. Workout history stays saved, but Today will switch to another saved program if one exists.'
      : 'This removes the program from your Library. Workout history stays saved.',
    confirmText: 'Delete',
    danger: true,
    onConfirm: doDelete
  });
}

function saveSetup() {
  setupDraft.name = (setupDraft.name || '').trim() || 'My Program';
  // Validate: at least one day, each day has at least one exercise with a name
  const cleanDays = setupDraft.days
    .map(d => ({
      name: (d.name || '').trim(),
      exercises: d.exercises
        .filter(e => (e.name || '').trim())
        .map(e => ({
          name: e.name.trim(),
          sets: Math.max(1, parseInt(e.sets) || 1),
          reps: Math.max(1, parseInt(e.reps) || 1)
        }))
    }))
    .filter(d => d.exercises.length > 0);

  if (!cleanDays.length) {
    showModal({
      title: 'Add an exercise',
      body: 'Your program needs at least one workout with at least one exercise.',
      confirmText: 'OK',
      hideCancel: true,
      onConfirm: closeModal
    });
    return;
  }

  cleanDays.forEach((d, i) => { if (!d.name) d.name = 'Workout ' + (i + 1); });
  cleanDays.forEach(d => d.exercises.forEach(e => ensureExerciseInLibrary(e.name)));

  const weeks = Math.max(1, parseInt(setupDraft.weeks) || 1);
  const program = { name: setupDraft.name, weeks, template: cleanDays };
  state.programLibrary = normalizeProgramLibrary(state);
  const existing = setupDraft.id ? state.programLibrary.find(p => p.id === setupDraft.id) : null;
  const record = makeProgramRecord(program, existing || { id: setupDraft.id || undefined });
  const idx = state.programLibrary.findIndex(p => p.id === record.id);
  if (idx >= 0) state.programLibrary[idx] = record;
  else state.programLibrary.unshift(record);

  const shouldActivate = setupDraft.makeActive || !state.program || state.activeProgramId === record.id;
  if (shouldActivate) {
    const sameProgram = state.activeProgramId === record.id;
    state.activeProgramId = record.id;
    state.program = programFromRecord(record);
    state.active = null;
    state.celebration = null;
    selectedWeekIndex = null;
    expandedDayKey = null;
    if (!sameProgram) {
      state.currentRun = { startedAt: Date.now(), weekIndex: 0, completedDayIndices: [] };
    } else {
      state.currentRun.weekIndex = Math.min(state.currentRun.weekIndex, weeks);
      state.currentRun.completedDayIndices = state.currentRun.completedDayIndices.filter(i => i < cleanDays.length);
    }
  }

  state.editing = false;
  setupDraft = null;
  state.tab = shouldActivate ? 'today' : 'program';
  save();
  render();
}

