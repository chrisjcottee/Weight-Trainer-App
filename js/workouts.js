/* ---------- Workout actions ---------- */
function startWorkout(dayIndex) {
  if (programIsComplete()) return;
  if (dayIsDoneToday(dayIndex)) return;
  if (state.active) return;
  const day = state.program.template[dayIndex];
  if (!day) return;
  editingSet = null;
  expandedExIdx = null;
  lingeringExIdx = null;
  completedCollapsed = true;
  addingExercise = false;
  selectedWeekIndex = state.currentRun.weekIndex || 0;
  expandedDayKey = dayKey(selectedWeekIndex, dayIndex);
  state.active = {
    programId: state.activeProgramId || null,
    programName: state.program.name,
    weekIndex: state.currentRun.weekIndex,
    dayIndex,
    dayName: day.name || ('Workout ' + (dayIndex + 1)),
    startedAt: Date.now(),
    activeExIdx: 0,
    exercises: day.exercises.map(e => ({
      name: e.name,
      targetSets: e.sets,
      targetReps: e.reps,
      sets: [],
      skipped: false
    }))
  };
  state.tab = 'workout';
  save();
  render();
}

/* ---------- Active-exercise selection (any-order) ---------- */
// The active (blue) exercise, stored on state.active for reload-resilience.
// -1 means nothing is selected — after completing an exercise we deliberately
// leave the selection empty so the user picks the next one themselves.
function currentActiveIdx() {
  const a = state.active;
  if (!a) return -1;
  const idx = a.activeExIdx;
  if (idx == null) return -1;
  if (idx < 0 || idx >= a.exercises.length || exerciseIsResolved(a.exercises[idx])) {
    a.activeExIdx = -1;
    return -1;
  }
  return idx;
}

// The just-completed exercise still shown in place, or null if none/invalid.
function validLingerIdx() {
  const a = state.active;
  if (!a || lingeringExIdx == null) return null;
  const ex = a.exercises[lingeringExIdx];
  if (!ex || !exerciseIsResolved(ex)) { lingeringExIdx = null; return null; }
  return lingeringExIdx;
}

// Engaging any exercise other than the lingering one files the lingering one
// down into the Completed section.
function maybeFlushLinger(exIdx) {
  if (lingeringExIdx != null && lingeringExIdx !== exIdx) lingeringExIdx = null;
}

// Drop any "Add set" slots that were never filled on exercises the user has
// moved on from, so an abandoned extra slot doesn't leave them stuck incomplete.
function reclaimExtraSlots(exceptIdx) {
  const a = state.active;
  if (!a) return;
  a.exercises.forEach((ex, i) => {
    if (i === exceptIdx) return;
    const min = Math.max(0, ex.sets.length - ex.targetSets);
    if ((ex.extraSets || 0) > min) ex.extraSets = min;
  });
}

// User taps an outstanding exercise to make it active.
function setActiveExercise(idx) {
  const a = state.active;
  if (!a || idx < 0 || idx >= a.exercises.length) return;
  if (exerciseIsResolved(a.exercises[idx])) return;
  if (idx === a.activeExIdx && lingeringExIdx == null) return;
  reclaimExtraSlots(idx);
  maybeFlushLinger(idx);
  a.activeExIdx = idx;
  editingSet = null;
  renderRailReorder();
}

// "+ Add set" — give an exercise one more loggable set and focus it.
function addSet(exIdx) {
  const a = state.active;
  if (!a) return;
  const ex = a.exercises[exIdx];
  if (!ex) return;

  // Preserve any half-typed value in the on-screen active row before re-render.
  let typed = null;
  const liveRow = document.querySelector(`[data-ex-idx="${exIdx}"] .set-row.active`);
  if (liveRow && liveRow.dataset.dirty === '1') {
    typed = {
      w: (liveRow.querySelector('.set-w') || {}).value || '',
      r: (liveRow.querySelector('.set-r') || {}).value || ''
    };
  }

  ex.extraSets = (ex.extraSets || 0) + 1;
  ex.skipped = false;
  if (lingeringExIdx === exIdx) lingeringExIdx = null;
  else maybeFlushLinger(exIdx);
  a.activeExIdx = exIdx;
  expandedExIdx = null;
  editingSet = null;
  // In-place change — re-render without the reorder slide so the view stays put.
  save();
  render();

  requestAnimationFrame(() => {
    const card = document.querySelector(`.ex-rail-step.active[data-ex-idx="${exIdx}"]`);
    const row = card && card.querySelector('.set-row.active');
    if (!row) return;
    if (typed) {
      const w = row.querySelector('.set-w');
      const rH = row.querySelector('.set-r');
      const rD = row.querySelector('.reps-stepper .step-val');
      if (w) w.value = typed.w;
      if (rH) rH.value = typed.r;
      if (rD && typed.r) rD.textContent = typed.r;
      row.dataset.dirty = '1';
      updateLogBtn(row);
    }
    const w = row.querySelector('.set-w');
    if (w) w.focus();
  });
}

/* ---------- Mid-workout add / remove exercise ---------- */
// The template day this active workout was started from.
function templateDayForActive() {
  const a = state.active;
  if (!a || !state.program) return null;
  return state.program.template[a.dayIndex] || null;
}

// a.exercises minus removed-but-retained entries lines up 1:1 with the
// template day's exercise list, so the template index for an active-workout
// exercise is its position among the non-removed entries.
function templateIdxForExercise(exIdx) {
  const a = state.active;
  let n = 0;
  for (let i = 0; i < exIdx; i++) if (!a.exercises[i].removed) n++;
  return n;
}

// Persist state.program.template into the matching library record so
// mid-workout program edits survive program switches.
function syncActiveProgramRecord() {
  if (!state.program || !state.activeProgramId) return;
  state.programLibrary = normalizeProgramLibrary(state);
  const rec = state.programLibrary.find(p => p.id === state.activeProgramId);
  if (!rec) return;
  rec.template = structuredClone(state.program.template);
  rec.updatedAt = Date.now();
}

// "+ Add Exercise" on the Workout tab — appends to today's workout AND to the
// program template (1 set × 0 reps placeholder), then makes it active.
function addExerciseToWorkout(name) {
  const a = state.active;
  if (!a) return;
  const clean = String(name || '').trim();
  if (!clean) {
    showModal({
      title: 'Name required',
      body: 'Enter an exercise name first.',
      confirmText: 'OK',
      hideCancel: true,
      onConfirm: closeModal
    });
    return;
  }
  const entry = ensureExerciseInLibrary(clean);
  const finalName = entry ? entry.name : clean;
  const day = templateDayForActive();
  if (day) {
    day.exercises.push({ name: finalName, sets: 1, reps: 0 });
    syncActiveProgramRecord();
  }
  a.exercises.push({
    name: finalName,
    targetSets: 1,
    targetReps: 0,
    sets: [],
    skipped: false,
    addedMidWorkout: true
  });
  const idx = a.exercises.length - 1;
  reclaimExtraSlots(idx);
  maybeFlushLinger(idx);
  a.activeExIdx = idx;
  addingExercise = false;
  editingSet = null;
  renderRailReorder();
  requestAnimationFrame(() => {
    const card = document.querySelector(`.ex-rail-step.active[data-ex-idx="${idx}"]`);
    if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
}

// Swipe-to-delete an exercise — removes it from the program going forward.
// Sets already logged this session stay saved: the exercise is retained in the
// session (marked removed) and files into the Completed section.
function removeExerciseFromWorkout(exIdx) {
  const a = state.active;
  if (!a) return;
  const ex = a.exercises[exIdx];
  if (!ex || ex.removed) return;
  if (a.exercises.filter(e => !e.removed).length <= 1) {
    showModal({
      title: 'Cannot remove',
      body: 'A workout needs at least one exercise.',
      confirmText: 'OK',
      hideCancel: true,
      onConfirm: closeModal
    });
    return;
  }
  const hasSets = ex.sets.length > 0;
  showModal({
    title: 'Remove exercise?',
    body: hasSets
      ? `${ex.name} will be removed from ${a.dayName} going forward. The ${ex.sets.length} set${ex.sets.length === 1 ? '' : 's'} you logged today stay${ex.sets.length === 1 ? 's' : ''} saved.`
      : `${ex.name} will be removed from this workout and from ${a.dayName} going forward.`,
    confirmText: 'Remove',
    danger: true,
    onConfirm: () => {
      closeModal();
      // Remove from the program template (and saved program) first, while the
      // non-removed entries still line up with the template.
      const day = templateDayForActive();
      if (day) {
        let ti = templateIdxForExercise(exIdx);
        if (!day.exercises[ti] || day.exercises[ti].name !== ex.name) {
          ti = day.exercises.findIndex(e => e.name === ex.name);
        }
        if (ti >= 0) day.exercises.splice(ti, 1);
        syncActiveProgramRecord();
      }
      if (hasSets) {
        // Keep the logged sets in the session: retain the exercise, trim its
        // slots to what was logged so it resolves into the Completed section.
        ex.removed = true;
        setExerciseSlots(ex, ex.sets.length);
        if (a.activeExIdx === exIdx) a.activeExIdx = -1;
        if (lingeringExIdx === exIdx) lingeringExIdx = null;
      } else {
        a.exercises.splice(exIdx, 1);
        if (a.activeExIdx != null && a.activeExIdx >= 0) {
          a.activeExIdx = a.activeExIdx === exIdx ? -1 : a.activeExIdx > exIdx ? a.activeExIdx - 1 : a.activeExIdx;
        }
        const shift = v => (v == null || v === exIdx) ? null : v > exIdx ? v - 1 : v;
        lingeringExIdx = shift(lingeringExIdx);
        expandedExIdx = shift(expandedExIdx);
        if (editingSet) {
          if (editingSet.exIdx === exIdx) editingSet = null;
          else if (editingSet.exIdx > exIdx) editingSet.exIdx--;
        }
      }
      renderRailReorder();
    }
  });
}

// Drag-to-reorder the upcoming exercises. slotIdxs are the array positions
// being permuted (ascending); orderedExIdxs is the same set of indices in
// their new visual order. The program template (and the saved program in the
// library) get the same new order going forward.
function reorderWorkoutExercises(slotIdxs, orderedExIdxs) {
  const a = state.active;
  if (!a || slotIdxs.length !== orderedExIdxs.length) return;
  const day = templateDayForActive();
  // Resolve template positions/items BEFORE mutating the session array.
  const tplSlots = day ? slotIdxs.map(i => templateIdxForExercise(i)) : [];
  const tplItems = day ? orderedExIdxs.map(i => {
    let ti = templateIdxForExercise(i);
    const ex = a.exercises[i];
    if (!day.exercises[ti] || day.exercises[ti].name !== ex.name) {
      ti = day.exercises.findIndex(t => t.name === ex.name);
    }
    return day.exercises[ti] || null;
  }) : [];
  const exItems = orderedExIdxs.map(i => a.exercises[i]);
  slotIdxs.forEach((slot, k) => { a.exercises[slot] = exItems[k]; });
  if (day && tplItems.length && tplItems.every(Boolean)) {
    tplSlots.forEach((slot, k) => { day.exercises[slot] = tplItems[k]; });
    syncActiveProgramRecord();
  }
  save();
  render();
}

// Exercises added mid-workout enter the template as a 1×0 placeholder; once
// the workout is saved, record what was actually performed.
function persistAddedExerciseTargets(a) {
  const day = templateDayForActive();
  if (!day) return;
  let changed = false;
  a.exercises.forEach((ex, i) => {
    if (!ex.addedMidWorkout || ex.removed || !ex.sets.length) return;
    let ti = templateIdxForExercise(i);
    if (!day.exercises[ti] || day.exercises[ti].name !== ex.name) {
      ti = day.exercises.findIndex(e => e.name === ex.name);
    }
    const tpl = day.exercises[ti];
    if (!tpl) return;
    tpl.sets = ex.sets.length;
    tpl.reps = modeReps(ex.sets);
    changed = true;
  });
  if (changed) syncActiveProgramRecord();
}

// The most common rep count across logged sets (latest wins a tie).
function modeReps(sets) {
  const counts = new Map();
  let best = sets[0] ? sets[0].reps : 0;
  sets.forEach(s => {
    const n = (counts.get(s.reps) || 0) + 1;
    counts.set(s.reps, n);
    if (n >= (counts.get(best) || 0)) best = s.reps;
  });
  return best;
}

// Set the number of set rows an exercise shows, by deriving extraSets from it.
function setExerciseSlots(ex, n) {
  n = Math.max(1, ex.sets.length, n);
  ex.extraSets = n - ex.targetSets;
}

// Swipe-to-delete a set. A logged set is removed; an unlogged (active or
// upcoming) slot just trims the exercise's planned set count by one.
function removeSet(exIdx, si) {
  const a = state.active;
  if (!a) return;
  const ex = a.exercises[exIdx];
  if (!ex) return;
  const logged = si < ex.sets.length;
  const slots = exerciseSlots(ex);
  // Deleting an unlogged slot needs a spare slot, and we always keep >= 1 set.
  if (!logged && slots <= Math.max(1, ex.sets.length)) return;
  if (logged) ex.sets.splice(si, 1);
  setExerciseSlots(ex, slots - 1);
  editingSet = null;
  // If the deletion leaves the exercise unfinished, keep the user focused on it.
  if (!exerciseIsResolved(ex)) {
    if (lingeringExIdx === exIdx) lingeringExIdx = null;
    a.activeExIdx = exIdx;
  }
  // In-place change — re-render without the reorder slide so the view stays put.
  save();
  render();
}

/* ---------- Rail reorder animation (FLIP) ---------- */
function captureRailState() {
  const map = new Map();
  document.querySelectorAll('.ex-rail [data-ex-idx]').forEach(el => {
    map.set(el.getAttribute('data-ex-idx'), { rect: el.getBoundingClientRect(), clone: el.cloneNode(true) });
  });
  return map;
}

function playRailReorder(prev) {
  if (!prev || !prev.size) return;
  if (!Element.prototype.animate) return; // no Web Animations API — skip gracefully
  const seen = new Set();
  document.querySelectorAll('.ex-rail [data-ex-idx]').forEach(el => {
    const id = el.getAttribute('data-ex-idx');
    seen.add(id);
    const before = prev.get(id);
    if (!before) {
      el.animate(
        [{ opacity: 0, transform: 'translateY(-6px)' }, { opacity: 1, transform: 'none' }],
        { duration: 220, easing: 'ease-out' }
      );
      return;
    }
    const after = el.getBoundingClientRect();
    const dy = before.rect.top - after.top;
    if (Math.abs(dy) < 2) return;
    el.animate(
      [{ transform: `translateY(${dy}px)` }, { transform: 'translateY(0)' }],
      { duration: 340, easing: 'cubic-bezier(.2,.7,.2,1)' }
    );
  });

  // Anything that disappeared (e.g. filed into a collapsed Completed section)
  // fades out from where it was via a floating ghost.
  prev.forEach((info, id) => {
    if (seen.has(id)) return;
    const r = info.rect;
    if (r.width === 0 && r.height === 0) return;
    const ghost = info.clone;
    Object.assign(ghost.style, {
      position: 'fixed', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px',
      margin: '0', zIndex: '5', pointerEvents: 'none'
    });
    document.body.appendChild(ghost);
    const anim = ghost.animate(
      [{ opacity: 1, transform: 'translateY(0) scale(1)' }, { opacity: 0, transform: 'translateY(10px) scale(0.97)' }],
      { duration: 240, easing: 'ease-in' }
    );
    anim.onfinish = anim.oncancel = () => ghost.remove();
  });
}

// Save + render, animating any rail steps that changed position or filed away.
function renderRailReorder() {
  const prev = captureRailState();
  save();
  render();
  requestAnimationFrame(() => playRailReorder(prev));
}

function withUnloggedSetGuard(next, continueText) {
  const row = document.querySelector('.set-row.active');
  if (!row) return false;
  const weightInput = row.querySelector('.set-w');
  const repsInput = row.querySelector('.set-r');
  if (row.dataset.dirty !== '1') return false;
  const weightText = weightInput ? weightInput.value.trim() : '';
  if (!weightText) return false;

  const w = parseFloat(weightText);
  const r = parseInt(repsInput && repsInput.value, 10);
  if (isNaN(w) || w < 0 || isNaN(r) || r <= 0) {
    showModal({
      title: 'Check current set',
      body: 'The current set has a value typed in, but it is not valid yet.',
      confirmText: 'OK',
      hideCancel: true,
      onConfirm: closeModal
    });
    return true;
  }

  showModal({
    title: 'Save current set?',
    body: 'You have numbers typed into the current set, but it has not been logged yet.',
    confirmText: 'Save Set',
    onConfirm: () => {
      closeModal();
      logCurrentSet(row);
      next();
    },
    extraAction: {
      label: continueText || 'Continue without set',
      onClick: () => {
        closeModal();
        next();
      }
    }
  });
  return true;
}

function skipExercise(exIdx) {
  const a = state.active;
  if (!a) return;
  const ex = a.exercises[exIdx];
  if (!ex || exerciseIsResolved(ex)) return;

  const applySkip = () => {
    maybeFlushLinger(exIdx);
    ex.skipped = true;
    ex.skippedAt = Date.now();
    editingSet = null;
    a.activeExIdx = -1; // user selects the next exercise themselves
    closeModal();
    renderRailReorder();
  };

  showModal({
    title: ex.sets.length ? 'Skip remaining sets?' : 'Skip exercise?',
    body: ex.sets.length
      ? 'Logged sets stay saved. The remaining sets for this exercise will be marked skipped.'
      : 'This exercise will be marked skipped and the workout will move to the next exercise.',
    confirmText: ex.sets.length ? 'Skip Rest' : 'Skip',
    onConfirm: applySkip
  });
}

function endWorkoutFlow() {
  const a = state.active;
  if (!a) return;
  reclaimExtraSlots(-1); // drop any unfilled added slots before resolving status
  const fullyComplete = a.exercises.every(exerciseIsResolved);
  const anyLogged = a.exercises.some(e => e.sets.length > 0);
  const anySkipped = a.exercises.some(e => e.skipped);

  if (fullyComplete) {
    finishWorkout();
    return;
  }

  if (!anyLogged && !anySkipped) {
    showModal({
      title: 'Discard workout?',
      body: 'You haven\'t logged any sets yet.',
      confirmText: 'Discard',
      danger: true,
      onConfirm: () => {
        state.active = null;
        editingSet = null;
        closeModal();
        setState({ tab: 'today' });
      }
    });
    return;
  }

  // Some (not all) exercises resolved — finishing logs just those and marks the
  // workout complete for today. The rest are simply dropped.
  showModal({
    title: 'Finish workout?',
    body: 'Only the exercises you\'ve completed will be logged. This workout will be marked complete for today.',
    confirmText: 'Finish',
    onConfirm: () => {
      closeModal();
      finishWorkout();
    }
  });
}

function saveEditedSet(row) {
  if (!row || !state.active || !editingSet) return;
  const w = parseFloat(row.querySelector('.set-w').value);
  const r = parseInt(row.querySelector('.set-r').value, 10);
  if (isNaN(w) || isNaN(r) || r <= 0 || w < 0) return;
  const ex = state.active.exercises[editingSet.exIdx];
  const existing = ex.sets[editingSet.setIdx];
  if (!existing) { editingSet = null; render(); return; }
  ex.sets[editingSet.setIdx] = { ...existing, weight: w, reps: r };
  editingSet = null;
  save();
  render();
}

function logCurrentSet(row) {
  if (!row || !state.active) return;
  const w = parseFloat(row.querySelector('.set-w').value);
  const r = parseInt(row.querySelector('.set-r').value, 10);
  if (isNaN(w) || isNaN(r) || r <= 0) return;
  const card = row.closest('[data-ex-idx]');
  if (!card) return;
  const exIdx = +card.dataset.exIdx;
  const ex = state.active.exercises[exIdx];

  // Logging on the active exercise is the "next action" that files away any
  // previously lingering completed exercise.
  maybeFlushLinger(exIdx);

  ex.sets.push({ weight: w, reps: r, ts: Date.now() });
  const stillSameEx = ex.sets.length < exerciseSlots(ex);
  buzz(stillSameEx ? 12 : [20, 40, 20]);
  startRest();

  if (stillSameEx) {
    save();
    // In-place advance: patch only this exercise's set rows + counter so the
    // input stays responsive and we avoid re-rendering the whole rail.
    const setsWrap = card.querySelector('.sets-modern');
    if (setsWrap) {
      setsWrap.innerHTML = Array.from({ length: exerciseSlots(ex) },
        (_, si) => setRowHtml(ex, exIdx, si, true)).join('');
    }
    const badge = card.querySelector('.dense-line .badge');
    if (badge) badge.textContent = `${ex.sets.length}/${exerciseSlots(ex)}`;
    requestAnimationFrame(() => {
      const next = card.querySelector('.set-row.active .set-w');
      if (next && document.activeElement !== next) next.focus();
    });
    return;
  }

  // Exercise complete — it lingers in place (editable). We do NOT auto-advance:
  // the user selects the next exercise so they can tweak this one first. The
  // card stays where it is, so re-render without the reorder slide.
  lingeringExIdx = exIdx;
  state.active.activeExIdx = -1;
  save();
  render();
}

function finishWorkout() {
  const a = state.active;
  if (!a) return;
  // Editing a previously-logged session: replace it in place. No XP, streak
  // or celebration — the original workout already earned those.
  if (a.editOfDate != null) {
    finishSessionEdit(a);
    return;
  }
  persistAddedExerciseTargets(a);
  const exsWithSets = a.exercises.filter(e => e.sets.length > 0);
  const sessionExercises = a.exercises.filter(e => e.sets.length > 0 || e.skipped);
  if (!sessionExercises.length) {
    state.active = null;
    editingSet = null;
    lingeringExIdx = null;
    completedCollapsed = true;
    save();
    render();
    return;
  }

  const session = {
    date: Date.now(),
    programId: a.programId || state.activeProgramId || null,
    programName: a.programName || (state.program && state.program.name) || '',
    weekIndex: a.weekIndex,
    dayIndex: a.dayIndex,
    dayName: a.dayName,
    durationMs: Date.now() - a.startedAt,
    exercises: sessionExercises.map(e => ({
      name: e.name,
      sets: e.sets,
      skipped: !!e.skipped,
      skippedAt: e.skippedAt || null,
      removed: !!e.removed,
      targetSets: e.targetSets,
      targetReps: e.targetReps
    }))
  };
  state.sessions.push(session);

  // Whether every exercise was resolved (logged or explicitly skipped). Drives
  // the perfect-day XP bonus and the "Partial" badge — but a workout counts as
  // done for the day either way, logging only the completed exercises.
  const fullyComplete = a.exercises.every(exerciseIsResolved);
  session.fullyComplete = fullyComplete;

  let xpEarned = 0;
  let weekComplete = false;
  let programComplete = false;
  const prevLvl = levelFromXp(state.stats.xp);
  const loggedSetCount = setCount(exsWithSets);

  // XP per set
  exsWithSets.forEach(e => { xpEarned += e.sets.length * 10; });
  // Exercise complete bonus
  exsWithSets.forEach(e => {
    if (!e.skipped && exerciseIsComplete(e)) xpEarned += 25;
  });

  // Logging the workout marks its day done — for today and for the week —
  // whether or not every exercise was finished.
  if (!state.currentRun.completedDayIndices.includes(a.dayIndex)) {
    state.currentRun.completedDayIndices.push(a.dayIndex);
  }

  // Week complete? Weeks are calendar weeks now — the week number advances
  // with the date (syncCalendarRun), never here.
  if (state.currentRun.completedDayIndices.length >= state.program.template.length) {
    weekComplete = true;
    xpEarned += 500;

    // Final week done = program complete.
    if (currentWeekIndex() >= state.program.weeks - 1) {
      programComplete = true;
      xpEarned += 2500;
    }
  }

  // Streak + perfect-day bonus reward actually putting in work.
  if (loggedSetCount > 0) {
    const today = Date.now();
    const last = state.stats.lastDayCompleteDate;
    if (last) {
      const gap = daysBetween(last, today);
      if (gap === 0) {
        // same day, no change
      } else if (gap <= 2) {
        state.stats.streak += 1;
      } else {
        state.stats.streak = 1;
      }
    } else {
      state.stats.streak = 1;
    }
    state.stats.lastDayCompleteDate = today;

    // Perfect-day bonus only when every exercise was resolved.
    if (fullyComplete) xpEarned += 100;
  }

  state.stats.xp += xpEarned;
  const leveledUp = levelFromXp(state.stats.xp) > prevLvl;

  // Snapshot of which template days are done in the week we just worked.
  // For a normal day-complete this matches currentRun.completedDayIndices.
  // For a week-complete the run has already reset, so synthesize the full set.
  const completedThisWeek = weekComplete
    ? state.program.template.map((_, i) => i)
    : state.currentRun.completedDayIndices.slice();
  const templateDayNames = state.program.template.map(d => d.name || '');

  state.celebration = {
    type: 'workout',
    dayName: a.dayName,
    dayIndex: a.dayIndex,
    weekIndex: a.weekIndex,
    setCount: loggedSetCount,
    volume: totalVolume(exsWithSets),
    skippedCount: skippedCount(a.exercises),
    xpEarned,
    leveledUp,
    fullyComplete,
    weekComplete,
    programComplete,
    completedThisWeek,
    templateDayNames
  };
  if (programComplete) buzz([80, 60, 80, 60, 80, 60, 200]);
  else if (weekComplete) buzz([60, 80, 60, 80, 60]);
  else if (fullyComplete) buzz([30, 60, 30]);
  state.active = null;
  editingSet = null;
  expandedExIdx = null;
  lingeringExIdx = null;
  completedCollapsed = true;
  addingExercise = false;
  save();
  render();
}

/* ---------- Logged-session edit / delete (Program calendar) ---------- */
// Reopen a saved session in the Workout tab. Finishing replaces the original
// log (same date) instead of appending a new one.
function editLoggedSession(sessionIdx) {
  const s = state.sessions[sessionIdx];
  if (!s || state.active) return;
  editingSet = null;
  expandedExIdx = null;
  lingeringExIdx = null;
  completedCollapsed = true;
  addingExercise = false;
  state.active = {
    programId: s.programId || state.activeProgramId || null,
    programName: s.programName || (state.program && state.program.name) || '',
    weekIndex: s.weekIndex || 0,
    dayIndex: s.dayIndex || 0,
    dayName: s.dayName || 'Workout ' + ((s.dayIndex || 0) + 1),
    startedAt: s.date,
    editOfDate: s.date,
    activeExIdx: -1,
    exercises: s.exercises.map(e => {
      const targetSets = e.targetSets || e.sets.length || 1;
      return {
        name: e.name,
        targetSets,
        targetReps: e.targetReps || 0,
        sets: structuredClone(e.sets),
        skipped: !!e.skipped,
        removed: !!e.removed,
        extraSets: Math.max(0, e.sets.length - targetSets)
      };
    })
  };
  state.tab = 'workout';
  save();
  render();
}

// Swap the edited exercises back into the original session record.
function finishSessionEdit(a) {
  const idx = state.sessions.findIndex(s => s.date === a.editOfDate);
  const editedExercises = a.exercises.filter(e => e.sets.length > 0 || e.skipped);
  if (idx >= 0) {
    if (editedExercises.length) {
      const orig = state.sessions[idx];
      state.sessions[idx] = Object.assign({}, orig, {
        exercises: editedExercises.map(e => ({
          name: e.name,
          sets: e.sets,
          skipped: !!e.skipped,
          skippedAt: e.skippedAt || null,
          removed: !!e.removed,
          targetSets: e.targetSets,
          targetReps: e.targetReps
        })),
        fullyComplete: a.exercises.every(exerciseIsResolved)
      });
    } else {
      // Every set was deleted — the log is gone.
      state.sessions.splice(idx, 1);
    }
  }
  syncCalendarRun();
  state.active = null;
  editingSet = null;
  expandedExIdx = null;
  lingeringExIdx = null;
  completedCollapsed = true;
  addingExercise = false;
  state.tab = 'today';
  save();
  render();
}

function deleteLoggedSession(sessionIdx) {
  const s = state.sessions[sessionIdx];
  if (!s) return;
  const when = new Date(s.date).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
  showModal({
    title: 'Delete this log?',
    body: (s.dayName || 'This workout') + ' on ' + when + ' will be removed from the calendar. This cannot be undone.',
    confirmText: 'Delete',
    danger: true,
    onConfirm: () => {
      state.sessions.splice(sessionIdx, 1);
      syncCalendarRun();
      closeModal();
      save();
      render();
    }
  });
}
