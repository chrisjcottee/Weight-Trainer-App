Views.today = function() {
  const lvl = levelFromXp(state.stats.xp);
  const program = state.program;
  const totalWeeks = program.weeks;
  const selectedWeek = ensureTodaySelection();

  return `
    <div class="today-header">
      <h1>Today</h1>
      <button class="btn ghost small" id="edit-program">Edit program</button>
    </div>

    ${programIsComplete() ? programCompleteBannerHtml(program) : ''}
    ${programStatusHtml(program, selectedWeek, totalWeeks, lvl)}

    ${selectedWeekDayStepperHtml(selectedWeek)}
  `;
};

function programStatusHtml(program, selectedWeek, totalWeeks, lvl) {
  const dayCount = program.template.length;
  return `
    <div class="card program-status">
      <div class="program-status-top">
        <div>
          <div class="program-name">${esc(program.name)}</div>
          <div class="program-meta">${totalWeeks} weeks &middot; ${dayCount} days per week</div>
        </div>
        <div class="metric-chips">
          <span class="metric-chip">🔥 ${state.stats.streak}</span>
          <span class="metric-chip">Lv ${lvl}</span>
          <span class="metric-chip">${state.stats.xp} XP</span>
        </div>
      </div>
      ${weekStepperHtml(selectedWeek)}
    </div>
  `;
}

function weekStepperHtml(selectedWeek) {
  const currentWeek = state.currentRun.weekIndex || 0;
  const totalWeeks = state.program.weeks;
  const complete = programIsComplete();
  return `
    <div class="week-stepper" aria-label="Program weeks">
      ${Array.from({length: totalWeeks}, (_, i) => {
        const done = complete || i < currentWeek;
        const active = !complete && i === currentWeek;
        const selected = i === selectedWeek;
        const classes = [
          done ? 'completed' : '',
          active ? 'active' : '',
          selected ? 'selected' : '',
          (!done && !active) ? 'upcoming' : ''
        ].filter(Boolean).join(' ');
        const status = done ? 'completed' : active ? 'active' : 'planned';
        return `
          <button class="week-step ${classes}" data-select-week="${i}" aria-label="Week ${i + 1}, ${status}">
            <span class="week-step-circle">${done ? '&#10003;' : i + 1}</span>
            <span class="week-step-label">W${i + 1}</span>
          </button>
        `;
      }).join('')}
    </div>
  `;
}

function legacyDayCardHtml(day, i, isJustCompleted = false) {
  const done = dayIsDoneThisWeek(i);
  const isNext = !done && nextDayIndex() === i;
  const isExpanded = false;
  const session = done ? sessionForDayThisWeek(i) : null;
  const exCount = day.exercises.length;
  const setCount = day.exercises.reduce((n, e) => n + e.sets, 0);

  const exList = `
    <div class="exercise-preview-list">
      ${day.exercises.map(e => `
        <div class="exercise-preview-row">
          <span class="target">${e.sets}×${e.reps}</span>
          <span>${esc(e.name)}</span>
        </div>
      `).join('')}
    </div>
  `;

  if (done) {
    const skipped = session ? skippedCount(session.exercises) : 0;
    const summary = sessionSummaryText(session);
    return `
      <div class="day-row compact done ${isExpanded ? 'expanded' : ''} ${isJustCompleted ? 'just-completed' : ''}" data-expand-day="${i}">
        <div class="day-row-head">
          <div class="day-check small">✓</div>
          <div class="day-row-main">
            ${isJustCompleted ? `<div class="subtle">Just completed</div>` : ''}
            <div class="name">${esc(day.name)}</div>
            <div class="meta">${session ? 'Done ' + fmtDate(session.date) + ' · ' + summary : 'Done'}</div>
          </div>
          ${skipped ? `<span class="badge warn">${skipped} skipped</span>` : `<span class="badge success">Done</span>`}
          <span class="chevron" aria-hidden="true">${isExpanded ? '▾' : '▸'}</span>
        </div>
        ${isExpanded ? completedSessionDetailHtml(session) : ''}
      </div>
    `;
  }

  if (isNext) {
    return `
      <div class="card card-next">
        <div class="row between" style="margin-bottom:6px;">
          <div>
            <div class="subtle">Next up</div>
            <h3>${esc(day.name)}</h3>
          </div>
          <span class="badge">${exCount} ex · ${setCount} sets</span>
        </div>
        ${exList}
        <button class="btn" data-start-day="${i}">Start ${esc(day.name)}</button>
      </div>
    `;
  }

  // Other undone: compact, tap to expand exercises
  return `
    <div class="day-row compact ${isExpanded ? 'expanded' : ''}" data-expand-day="${i}">
      <div class="day-row-head">
        <div class="day-row-main">
          <div class="name">${esc(day.name)}</div>
          <div class="meta">${exCount} ex · ${setCount} sets</div>
        </div>
        <span class="chevron" aria-hidden="true">${isExpanded ? '▾' : '▸'}</span>
        <button class="btn secondary small" data-start-day="${i}">Start</button>
      </div>
      ${isExpanded ? `<div class="day-row-detail">${exList}</div>` : ''}
    </div>
  `;
}

function completedSessionDetailHtml(session) {
  if (!session) {
    return `<div class="day-row-detail"><div class="faint">No session details saved for this day.</div></div>`;
  }
  return `
    <div class="day-row-detail">
      ${session.exercises.map(e => `
        <div class="session-ex-row ${e.skipped ? 'skipped' : ''}">
          <div class="row between">
            <span class="nm">${esc(e.name)}</span>
            <span class="sts">${sessionExerciseStatus(e)}</span>
          </div>
          <div class="session-set-summary">${sessionExerciseSetSummary(e)}</div>
        </div>
      `).join('')}
    </div>
  `;
}

function programCompleteBannerHtml(program) {
  return `
    <div class="card complete-banner">
      <div>
        <div class="complete-title">Program complete</div>
        <div class="complete-copy">You finished all ${program.weeks} weeks of ${esc(program.name)}. Review any week below.</div>
      </div>
      <button class="btn secondary small" id="restart-program">Start again</button>
    </div>
  `;
}

function selectedWeekDayStepperHtml(weekIndex) {
  const days = state.program.template;
  const complete = completedDayCountForWeek(weekIndex);
  const status = programIsComplete() || weekIndex < (state.currentRun.weekIndex || 0)
    ? 'Complete'
    : weekIndex === (state.currentRun.weekIndex || 0)
      ? 'In progress'
      : 'Planned';
  return `
    <div class="card day-stepper-card">
      <div class="week-detail-head">
        <div>
          <div class="section-label">Week ${weekIndex + 1}</div>
          <h2>${status}</h2>
        </div>
        <span class="badge ${status === 'Complete' ? 'success' : ''}">${complete}/${days.length} days</span>
      </div>
      <div class="day-stepper">
        ${days.map((day, i) => dayStepHtml(day, weekIndex, i)).join('')}
      </div>
    </div>
  `;
}

function dayStepHtml(day, weekIndex, dayIndex) {
  const key = dayKey(weekIndex, dayIndex);
  const done = dayIsDoneInWeek(weekIndex, dayIndex);
  const active = !done && activeDayIndexForWeek(weekIndex) === dayIndex;
  const expanded = expandedDayKey === key;
  const session = sessionForDay(weekIndex, dayIndex);
  const skipped = session ? skippedCount(session.exercises) : 0;
  const exCount = day.exercises.length;
  const setCount = day.exercises.reduce((n, e) => n + e.sets, 0);
  const canStart = active && !state.active;
  const statusText = done
    ? (session ? `Done ${fmtDate(session.date)} &middot; ${sessionSummaryText(session)}` : 'Done')
    : active
      ? 'Active day'
      : `${exCount} exercises &middot; ${setCount} sets`;
  const badge = done
    ? (skipped ? `<span class="badge warn">${skipped} skipped</span>` : `<span class="badge success">Done</span>`)
    : active
      ? `<span class="badge success">Active</span>`
      : `<span class="badge">Planned</span>`;

  return `
    <div class="day-step ${done ? 'completed' : ''} ${active ? 'active' : ''} ${expanded ? 'expanded' : ''}">
      <div class="day-step-rail">
        <button class="day-step-circle" data-expand-day-key="${key}" aria-label="Toggle Day ${dayIndex + 1}">
          ${done ? '&#10003;' : dayIndex + 1}
        </button>
      </div>
      <div class="day-step-body">
        <button class="day-step-summary" data-expand-day-key="${key}">
          <div class="day-step-copy">
            <div class="day-step-eyebrow">Day ${dayIndex + 1}</div>
            <div class="day-step-name">${esc(day.name)}</div>
            <div class="day-step-meta">${statusText}</div>
          </div>
          ${badge}
          <span class="chevron" aria-hidden="true">${expanded ? '&#9662;' : '&#9656;'}</span>
        </button>
        ${expanded ? dayStepDetailHtml(day, weekIndex, dayIndex, session, canStart) : ''}
      </div>
    </div>
  `;
}

function dayStepDetailHtml(day, weekIndex, dayIndex, session, canStart) {
  return `
    <div class="day-step-detail">
      ${exerciseStepperHtml(day, weekIndex, dayIndex, session)}
      ${canStart ? `<button class="btn" data-start-day="${dayIndex}">Start ${esc(day.name)}</button>` : ''}
    </div>
  `;
}

function matchingSessionExercise(session, planned, index, used) {
  if (!session || !Array.isArray(session.exercises)) return null;
  const sameIndex = session.exercises[index];
  if (sameIndex && !used.has(index) && sameIndex.name === planned.name) {
    used.add(index);
    return sameIndex;
  }
  const matchIndex = session.exercises.findIndex((e, i) => !used.has(i) && e.name === planned.name);
  if (matchIndex >= 0) {
    used.add(matchIndex);
    return session.exercises[matchIndex];
  }
  return null;
}

function exerciseStepperHtml(day, weekIndex, dayIndex, session) {
  const activeWorkout = state.active &&
    state.active.weekIndex === weekIndex &&
    state.active.dayIndex === dayIndex
      ? state.active
      : null;
  const firstOpen = activeWorkout
    ? activeWorkout.exercises.findIndex(e => !exerciseIsResolved(e))
    : -1;
  const usedSessionExercises = new Set();

  return `
    <div class="exercise-stepper">
      ${day.exercises.map((planned, i) => {
        const activeEx = activeWorkout ? activeWorkout.exercises[i] : null;
        const sessionEx = activeEx ? null : matchingSessionExercise(session, planned, i, usedSessionExercises);
        const source = activeEx || sessionEx || planned;
        const targetSets = source.targetSets || planned.sets;
        const targetReps = source.targetReps || planned.reps;
        let status = 'blank';
        if (activeEx) {
          if (activeEx.skipped) status = 'skipped';
          else if (exerciseIsComplete(activeEx)) status = 'completed';
          else if (i === firstOpen) status = 'active';
        } else if (sessionEx) {
          const sessionSets = Array.isArray(sessionEx.sets) ? sessionEx.sets.length : 0;
          const sessionTarget = sessionEx.targetSets || planned.sets;
          status = sessionEx.skipped ? 'skipped' : sessionSets >= sessionTarget ? 'completed' : 'blank';
        }
        const loggedSummary = sessionEx
          ? sessionExerciseSetSummary(sessionEx) || sessionExerciseStatus(sessionEx)
          : activeEx && activeEx.sets.length
            ? `${activeEx.sets.length} of ${targetSets} sets logged`
            : '';
        return `
          <div class="exercise-step ${status}">
            <span class="exercise-step-dot">${status === 'completed' || status === 'skipped' ? '&#10003;' : ''}</span>
            <div class="exercise-step-main">
              <div class="exercise-step-name">${esc(planned.name)}</div>
              <div class="exercise-step-meta">${targetSets}&times;${targetReps}${loggedSummary ? ` &middot; ${esc(loggedSummary)}` : ''}</div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function programCompleteView() {
  return `
    <div class="celebrate">
      <div class="big">🏆</div>
      <h1>Program Complete!</h1>
      <p class="sub">You finished all ${state.program.weeks} weeks of ${esc(state.program.name)}.</p>
      <div class="stats" style="max-width:320px; margin:24px auto;">
        <div class="stat"><div class="v">${state.stats.xp}</div><div class="k">Total XP</div></div>
        <div class="stat"><div class="v">Lv ${levelFromXp(state.stats.xp)}</div><div class="k">Level</div></div>
        <div class="stat"><div class="v">${state.sessions.length}</div><div class="k">Workouts</div></div>
      </div>
      <button class="btn" id="restart-program">Start Program Again</button>
      <button class="btn ghost" id="edit-program" style="margin-top:8px;">Edit Program</button>
    </div>
  `;
}

