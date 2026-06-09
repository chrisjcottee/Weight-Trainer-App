Views.workout = function() {
  const a = state.active;
  if (!a) return workoutEmptyHtml();
  const activeIdx = currentActiveIdx();
  const linger = validLingerIdx();
  const allResolved = a.exercises.every(exerciseIsResolved);

  const dots = a.exercises.map((e, i) => {
    const done = exerciseIsComplete(e);
    const skipped = !!e.skipped;
    const cur = i === activeIdx;
    return `<div class="dot ${done ? 'done' : ''} ${skipped ? 'skipped' : ''} ${cur ? 'current' : ''}" data-jump="${i}"></div>`;
  }).join('');

  // Outstanding (top) list — no heading. Order: lingering just-completed,
  // then the active exercise, then the remaining unresolved exercises.
  const order = [];
  if (linger != null) order.push(linger);
  if (activeIdx >= 0 && activeIdx !== linger) order.push(activeIdx);
  a.exercises.forEach((e, i) => {
    if (i === activeIdx || i === linger) return;
    if (!exerciseIsResolved(e)) order.push(i);
  });
  const topHtml = order.map(i => {
    if (i === linger) return lingerStepHtml(a.exercises[i], i);
    if (i === activeIdx) return activeStepHtml(a.exercises[i], i);
    return upNextStepHtml(a.exercises[i], i);
  }).join('');

  const topCard = topHtml ? `<div class="card"><div class="ex-rail">${topHtml}</div></div>` : '';
  const completedCard = completedSectionHtml(a, linger);

  return `
    <div class="workout-top">
      <div style="margin-bottom:13px;">
        <div class="section-label" style="margin-bottom:3px;">Week ${a.weekIndex + 1}</div>
        <h1 class="workout-day-title">${esc(a.dayName)}</h1>
      </div>
      <div class="dots">${dots}</div>
    </div>
    ${topCard}
    ${completedCard}
    <div class="workout-bottom">
      <div class="workout-bottom-inner">
        <button class="btn ${allResolved ? 'success' : ''}" id="finish-workout">${allResolved ? 'Finish Workout ✓' : 'Finish Workout'}</button>
      </div>
    </div>
  `;
};

function workoutEmptyHtml() {
  const complete = programIsComplete();
  const next = complete ? -1 : nextDayIndex();
  const day = (next >= 0 && state.program) ? state.program.template[next] : null;
  const upNext = day
    ? `<div class="faint" style="margin-top:8px;">Up next: ${esc(day.name || 'Workout ' + (next + 1))}</div>`
    : `<div class="faint" style="margin-top:8px;">${complete ? 'Program complete.' : 'Start one from Today.'}</div>`;
  return `
    <h1>Workout</h1>
    <div class="empty">
      <div class="ico">💪</div>
      <div>No active workout.</div>
      ${upNext}
      <button class="btn" data-tab="today" style="margin-top:18px; max-width:260px;">Go to Today</button>
    </div>
  `;
}

// The active (blue) exercise — expanded with the set logger. Blank rail circle.
function activeStepHtml(ex, i) {
  const name = esc(ex.name);
  const skipLabel = ex.sets.length ? 'Skip Rest' : 'Skip';
  return `
    <div class="ex-rail-step active" data-ex-idx="${i}">
      <div class="ex-rail-node"><span class="ex-rail-circle"></span></div>
      <div class="ex-rail-body">
        <div class="dense-line">
          <div style="min-width:0;">
            <div class="rail-eyebrow active">Active</div>
            <div class="ex-rail-name" style="font-size:17px;">${name}</div>
          </div>
          <div class="row" style="gap:6px;">
            <span class="badge">${ex.sets.length}/${exerciseSlots(ex)}</span>
            <button class="btn ghost small skip-ex-btn" data-act="skip-ex" data-ex-idx="${i}">${skipLabel}</button>
          </div>
        </div>
        <div class="ex-rail-meta" style="margin:2px 0 0;">Target ${ex.targetSets} × ${ex.targetReps}</div>
        <div class="sets-modern">
          ${Array.from({length: exerciseSlots(ex)}, (_, si) => setRowHtml(ex, i, si, true)).join('')}
        </div>
        ${addSetBtnHtml(i)}
      </div>
    </div>
  `;
}

// "+ Add set" — appends one more loggable set beyond the allocated target.
function addSetBtnHtml(exIdx) {
  return `<button type="button" class="add-set-btn" data-act="add-set" data-ex-idx="${exIdx}">+ Add set</button>`;
}

// An outstanding exercise that isn't active yet — tap to make it active. Blank circle.
function upNextStepHtml(ex, i) {
  const name = esc(ex.name);
  const started = ex.sets.length > 0;
  const badge = started
    ? `<span class="badge">${ex.sets.length}/${exerciseSlots(ex)}</span>`
    : `<span class="badge muted">${ex.targetSets} × ${ex.targetReps}</span>`;
  const summary = started
    ? `${ex.sets.map(s => `${fmtNum(s.weight)}×${s.reps}`).join(' · ')} · tap to resume`
    : 'Tap to start';
  return `
    <div class="ex-rail-step upcoming dense-collapsed" data-ex-idx="${i}">
      <div class="ex-rail-node"><span class="ex-rail-circle"></span></div>
      <div class="ex-rail-body selectable" data-select-active="${i}">
        <div class="dense-line">
          <div class="ex-rail-name">${name}</div>
          ${badge}
        </div>
        <div class="dense-summary">${summary}</div>
      </div>
    </div>
  `;
}

// A just-completed exercise lingering in place — stays editable until the next
// action files it into the Completed section.
function lingerStepHtml(ex, i) {
  const name = esc(ex.name);
  return `
    <div class="ex-rail-step completed expanded linger" data-ex-idx="${i}">
      <div class="ex-rail-node"><span class="ex-rail-circle">✓</span></div>
      <div class="ex-rail-body">
        <div class="dense-line">
          <div style="min-width:0;">
            <div class="rail-eyebrow done">Completed</div>
            <div class="ex-rail-name">${name}</div>
          </div>
          <span class="badge success">${ex.sets.length}/${exerciseSlots(ex)} ✓</span>
        </div>
        <div class="ex-rail-meta" style="margin:2px 0 0;">Nice work — edit, add a set, or pick the next exercise</div>
        <div class="sets-modern">
          ${ex.sets.map((s, si) => setRowHtml(ex, i, si, false)).join('')}
        </div>
        ${addSetBtnHtml(i)}
      </div>
    </div>
  `;
}

// Collapsed "Completed (N)" section. N counts truly-completed exercises;
// skipped exercises live here too but are noted separately, not counted.
function completedSectionHtml(a, linger) {
  const idxs = a.exercises
    .map((e, i) => i)
    .filter(i => i !== linger && exerciseIsResolved(a.exercises[i]));
  if (!idxs.length) return '';
  const completedCount = idxs.filter(i => exerciseIsComplete(a.exercises[i]) && !a.exercises[i].skipped).length;
  const skippedN = idxs.filter(i => a.exercises[i].skipped).length;
  const note = skippedN ? `<span class="completed-skip-note">${skippedN} skipped</span>` : '';
  const body = completedCollapsed ? '' : `
    <div class="ex-rail completed-list">
      ${idxs.map(i => completedRowHtml(a.exercises[i], i)).join('')}
    </div>`;
  return `
    <div class="card completed-card">
      <button class="completed-header" data-toggle-completed type="button" aria-expanded="${!completedCollapsed}">
        <span class="completed-title">Completed <span class="completed-count">${completedCount}</span></span>
        <span class="row" style="gap:10px;">${note}<span class="completed-chevron ${completedCollapsed ? '' : 'open'}" aria-hidden="true">⌄</span></span>
      </button>
      ${body}
    </div>
  `;
}

// A row inside the Completed section — tap to expand and edit its logged sets.
function completedRowHtml(ex, i) {
  const skipped = !!ex.skipped;
  const name = esc(ex.name);
  const circle = skipped ? '–' : '✓';
  const badge = skipped
    ? `<span class="badge warn">${ex.sets.length ? 'Skipped rest' : 'Skipped'}</span>`
    : `<span class="badge success">${ex.sets.length}/${exerciseSlots(ex)} ✓</span>`;
  const editable = ex.sets.length > 0;
  const expanded = editable && i === expandedExIdx;

  if (expanded) {
    return `
      <div class="ex-rail-step ${skipped ? 'skipped' : 'completed'} expanded" data-ex-idx="${i}">
        <div class="ex-rail-node"><span class="ex-rail-circle">${circle}</span></div>
        <div class="ex-rail-body">
          <div class="dense-line edit-toggle" data-toggle-done="${i}">
            <div class="ex-rail-name">${name}</div>
            ${badge}
          </div>
          <div class="ex-rail-meta" style="margin:2px 0 0;">Tap a set to edit · swipe a set to delete · tap the title to close</div>
          <div class="sets-modern">
            ${ex.sets.map((s, si) => setRowHtml(ex, i, si, false)).join('')}
          </div>
          ${addSetBtnHtml(i)}
        </div>
      </div>
    `;
  }

  const summary = skipped
    ? (ex.sets.length ? `${esc(sessionExerciseSetSummary(ex))} · skipped rest` : 'Skipped this session')
    : ex.sets.map(s => `${fmtNum(s.weight)}×${s.reps}`).join(' · ');
  const editAttr = editable ? ` data-toggle-done="${i}"` : '';
  return `
    <div class="ex-rail-step ${skipped ? 'skipped' : 'completed'} dense-collapsed" data-ex-idx="${i}">
      <div class="ex-rail-node"><span class="ex-rail-circle">${circle}</span></div>
      <div class="ex-rail-body${editable ? ' editable' : ''}"${editAttr}>
        <div class="dense-line">
          <div class="ex-rail-name">${name}</div>
          ${badge}
        </div>
        <div class="dense-summary">${summary}${editable ? ' · tap to edit' : ''}</div>
      </div>
    </div>
  `;
}

const TRASH_SVG = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v6M14 11v6"/></svg>';

function setDeleteBtnHtml(exIdx, si) {
  return `<button type="button" class="set-delete" data-act="delete-set" data-del-set="${exIdx},${si}" aria-label="Delete set" tabindex="-1">${TRASH_SVG}</button>`;
}

function setRowHtml(ex, exIdx, si, isCurrentEx) {
  const logged = ex.sets[si];
  const isEditing = !!logged && editingSet && editingSet.exIdx === exIdx && editingSet.setIdx === si;
  const isActive = isCurrentEx && !logged && si === ex.sets.length;
  const isPending = !logged && !isActive;

  // Editing is a transient state and is not swipeable.
  if (isEditing) {
    return `
      <div class="set-row editing" data-set-idx="${si}">
        <span class="lbl">${si + 1}</span>
        <input type="tel" inputmode="decimal" class="set-w" value="${logged.weight}" autocomplete="off" maxlength="6">
        ${repsStepperHtml(logged.reps)}
        <div class="edit-actions">
          <button class="log-btn" data-act="save-edit" title="Save">✓</button>
          <button class="cancel-btn" data-act="cancel-edit" title="Cancel">×</button>
        </div>
      </div>
    `;
  }

  // Every other row swipes left to reveal a trash button. Deleting a logged
  // set removes it; deleting an unlogged (active/upcoming) slot trims the
  // exercise's set count.
  if (logged) {
    // Celebrate beating the same set from the last completed session.
    const prog = setProgress(ex, si, logged);
    const wPr = prog && prog.weight > 0 ? ` <span class="set-pr">+${fmtNum(prog.weight)}</span>` : '';
    const rPr = prog && prog.reps > 0 ? ` <span class="set-pr">+${prog.reps}</span>` : '';
    return `
      <div class="set-row logged swipe-wrap" data-set-idx="${si}">
        ${setDeleteBtnHtml(exIdx, si)}
        <div class="set-row-face" data-edit-set="${exIdx},${si}">
          <span class="lbl">${si + 1}</span>
          <span class="val">${fmtNum(logged.weight)} kg${wPr}</span>
          <span class="val">× ${logged.reps}${rPr}</span>
          <span class="set-check" aria-hidden="true">✓</span>
        </div>
      </div>
    `;
  }

  if (isPending) {
    return `
      <div class="set-row pending swipe-wrap" data-set-idx="${si}">
        ${setDeleteBtnHtml(exIdx, si)}
        <div class="set-row-face">
          <span class="lbl">${si + 1}</span>
          <span class="val">– kg</span>
          <span class="val">× –</span>
          <span></span>
        </div>
      </div>
    `;
  }

  // Active row — prefilled where possible
  const wPrefill = weightPrefillFor(ex, si);
  const rPrefill = repsPrefillFor(ex, si);
  const wHasValue = wPrefill !== '' && !isNaN(parseFloat(wPrefill));
  const last = findLastSet(ex.name, si);
  return `
    <div class="set-row active swipe-wrap" data-set-idx="${si}">
      ${setDeleteBtnHtml(exIdx, si)}
      <div class="set-row-face">
        <span class="lbl">${si + 1}</span>
        <input type="tel" inputmode="decimal" class="set-w" value="${wHasValue ? wPrefill : ''}" placeholder="kg" autocomplete="off" maxlength="6">
        ${repsStepperHtml(rPrefill)}
        <button class="log-btn"${wHasValue ? '' : ' disabled'}>✓</button>
        ${last ? `<button type="button" class="last-chip" data-fill-last data-w="${last.weight}" data-r="${last.reps}">Last: ${fmtNum(last.weight)} kg × ${last.reps} · tap to use</button>` : ''}
      </div>
    </div>
  `;
}

function repsStepperHtml(value) {
  return `
    <div class="reps-stepper">
      <button class="step-btn" data-step="-1" type="button">−</button>
      <span class="step-val">${value}</span>
      <button class="step-btn" data-step="1" type="button">+</button>
      <input type="hidden" class="set-r" value="${value}">
    </div>
  `;
}
