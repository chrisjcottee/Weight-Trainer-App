/* ---------- Workout actions ---------- */
function startWorkout(dayIndex) {
  if (programIsComplete()) return;
  if (dayIsDoneThisWeek(dayIndex)) return;
  if (dayIndex !== nextDayIndex()) return;
  const day = state.program.template[dayIndex];
  if (!day) return;
  editingSet = null;
  selectedWeekIndex = state.currentRun.weekIndex || 0;
  expandedDayKey = dayKey(selectedWeekIndex, dayIndex);
  state.active = {
    programId: state.activeProgramId || null,
    programName: state.program.name,
    weekIndex: state.currentRun.weekIndex,
    dayIndex,
    dayName: day.name || ('Workout ' + (dayIndex + 1)),
    startedAt: Date.now(),
    exercises: day.exercises.map(e => ({
      name: e.name,
      targetSets: e.sets,
      targetReps: e.reps,
      sets: [],
      skipped: false
    }))
  };
  save();
  render();
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
    ex.skipped = true;
    ex.skippedAt = Date.now();
    editingSet = null;
    closeModal();
    save();
    render();
    requestAnimationFrame(() => {
      const nextCard = document.querySelector('.ex-card:not(.done):not(.skipped):not(.pending)');
      if (nextCard) nextCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
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
        setState({});
      }
    });
    return;
  }

  // Partial — give the choice between Save & End and Discard
  showModal({
    title: 'Save your progress?',
    body: 'You haven\'t resolved every exercise. Save this as a partial workout, or discard it?',
    confirmText: 'Save Partial',
    onConfirm: () => {
      finishWorkout({ partial: true });
      closeModal();
    },
    extraAction: {
      label: 'Discard workout',
      danger: true,
      onClick: () => {
        state.active = null;
        editingSet = null;
        closeModal();
        setState({});
      }
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
  const card = row.closest('.ex-card');
  const exIdx = +card.dataset.exIdx;
  const ex = state.active.exercises[exIdx];
  ex.sets.push({ weight: w, reps: r, ts: Date.now() });
  const exJustCompleted = ex.sets.length === ex.targetSets;
  buzz(exJustCompleted ? [20, 40, 20] : 12);
  save();
  render();
  // After render, focus the next active input if there is one
  requestAnimationFrame(() => {
    const next = document.querySelector('.set-row.active .set-w');
    if (next && document.activeElement !== next) {
      // Auto-focus only on same-exercise advance, to avoid hijacking when an exercise finishes
      const stillSameEx = ex.sets.length < ex.targetSets;
      if (stillSameEx) next.focus();
      else {
        const nextCard = document.querySelector('.ex-card:not(.done):not(.pending)');
        if (nextCard) nextCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  });
}

function finishWorkout(opts = {}) {
  const a = state.active;
  if (!a) return;
  const exsWithSets = a.exercises.filter(e => e.sets.length > 0);
  const sessionExercises = a.exercises.filter(e => e.sets.length > 0 || e.skipped);
  if (!sessionExercises.length) {
    state.active = null;
    editingSet = null;
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
      targetSets: e.targetSets,
      targetReps: e.targetReps
    }))
  };
  state.sessions.push(session);

  // Determine if the day has been resolved: every exercise logged or explicitly skipped.
  const fullyComplete = !opts.partial &&
    a.exercises.every(exerciseIsResolved);

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

  if (fullyComplete) {
    if (loggedSetCount > 0) xpEarned += 100;

    // Streak (per workout day)
    const today = Date.now();
    if (loggedSetCount > 0) {
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
    }

    // Mark this day done this week (if not already)
    if (!state.currentRun.completedDayIndices.includes(a.dayIndex)) {
      state.currentRun.completedDayIndices.push(a.dayIndex);
    }

    // Week complete?
    if (state.currentRun.completedDayIndices.length >= state.program.template.length) {
      weekComplete = true;
      xpEarned += 500;
      state.currentRun.weekIndex += 1;
      state.currentRun.completedDayIndices = [];

      // Program complete?
      if (programIsComplete()) {
        programComplete = true;
        xpEarned += 2500;
      }
    }
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
  save();
  render();
}

