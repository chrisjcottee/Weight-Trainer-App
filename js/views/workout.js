Views.workout = function() {
  const a = state.active;
  const currentExIdx = a.exercises.findIndex(e => !exerciseIsResolved(e));
  const allDone = currentExIdx === -1;

  const dots = a.exercises.map((e, i) => {
    const done = exerciseIsComplete(e);
    const skipped = !!e.skipped;
    const cur = i === currentExIdx;
    return `<div class="dot ${done ? 'done' : ''} ${skipped ? 'skipped' : ''} ${cur ? 'current' : ''}" data-jump="${i}"></div>`;
  }).join('');

  const steps = a.exercises.map((e, i) => exerciseRailStepHtml(e, i, currentExIdx)).join('');

  return `
    <div class="workout-top">
      <div style="margin-bottom:13px;">
        <div class="section-label" style="margin-bottom:3px;">Week ${a.weekIndex + 1}</div>
        <h1 class="workout-day-title">${esc(a.dayName)}</h1>
      </div>
      <div class="dots">${dots}</div>
    </div>
    <div class="card">
      <div class="ex-rail">${steps}</div>
    </div>
    <div class="workout-bottom">
      <div class="workout-bottom-inner">
        <button class="btn ${allDone ? 'success' : ''}" id="finish-workout">${allDone ? 'Finish Workout ✓' : 'Finish Workout'}</button>
      </div>
    </div>
  `;
};

function exerciseRailStepHtml(ex, i, currentExIdx) {
  const complete = exerciseIsComplete(ex);
  const skipped = !!ex.skipped;
  const done = complete || skipped;
  const isCurrent = !done && i === currentExIdx;
  const name = esc(ex.name);

  if (done) {
    const cls = ['ex-rail-step', skipped ? 'skipped' : 'completed', 'dense-collapsed'].join(' ');
    const circle = skipped ? '–' : '✓';
    const badge = skipped
      ? `<span class="badge warn">${ex.sets.length ? 'Skipped rest' : 'Skipped'}</span>`
      : `<span class="badge success">${ex.sets.length}/${ex.targetSets} ✓</span>`;
    const summary = skipped
      ? (ex.sets.length ? `${esc(sessionExerciseSetSummary(ex))} · skipped rest` : 'Skipped this session')
      : ex.sets.map(s => `${fmtNum(s.weight)}×${s.reps}`).join(' · ');
    return `
      <div class="${cls}" data-ex-idx="${i}">
        <div class="ex-rail-node"><span class="ex-rail-circle">${circle}</span></div>
        <div class="ex-rail-body">
          <div class="dense-line">
            <div class="ex-rail-name">${name}</div>
            ${badge}
          </div>
          <div class="dense-summary">${summary}</div>
        </div>
      </div>
    `;
  }

  if (isCurrent) {
    const skipLabel = ex.sets.length ? 'Skip Rest' : 'Skip';
    return `
      <div class="ex-rail-step active" data-ex-idx="${i}">
        <div class="ex-rail-node"><span class="ex-rail-circle">${i + 1}</span></div>
        <div class="ex-rail-body">
          <div class="dense-line">
            <div style="min-width:0;">
              <div class="rail-eyebrow active">In progress</div>
              <div class="ex-rail-name" style="font-size:17px;">${name}</div>
            </div>
            <div class="row" style="gap:6px;">
              <span class="badge">${ex.sets.length}/${ex.targetSets}</span>
              <button class="btn ghost small skip-ex-btn" data-act="skip-ex" data-ex-idx="${i}">${skipLabel}</button>
            </div>
          </div>
          <div class="ex-rail-meta" style="margin:2px 0 0;">Target ${ex.targetSets} × ${ex.targetReps}</div>
          <div class="sets-modern">
            ${Array.from({length: ex.targetSets}, (_, si) => setRowHtml(ex, i, si, true)).join('')}
          </div>
        </div>
      </div>
    `;
  }

  // Pending — collapsed
  return `
    <div class="ex-rail-step upcoming dense-collapsed" data-ex-idx="${i}">
      <div class="ex-rail-node"><span class="ex-rail-circle">${i + 1}</span></div>
      <div class="ex-rail-body">
        <div class="dense-line">
          <div class="ex-rail-name">${name}</div>
          <span class="badge muted">${ex.targetSets} × ${ex.targetReps}</span>
        </div>
      </div>
    </div>
  `;
}

function setRowHtml(ex, exIdx, si, isCurrentEx) {
  const logged = ex.sets[si];
  const isEditing = !!logged && editingSet && editingSet.exIdx === exIdx && editingSet.setIdx === si;
  const isActive = isCurrentEx && !logged && si === ex.sets.length;
  const isPending = !logged && !isActive;

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

  if (logged) {
    return `
      <div class="set-row logged" data-edit-set="${exIdx},${si}">
        <span class="lbl">${si + 1}</span>
        <span class="val">${fmtNum(logged.weight)} kg</span>
        <span class="val">× ${logged.reps}</span>
        <span class="set-check" aria-hidden="true">✓</span>
      </div>
    `;
  }

  if (isPending) {
    return `
      <div class="set-row pending">
        <span class="lbl">${si + 1}</span>
        <span class="val">– kg</span>
        <span class="val">× –</span>
        <span></span>
      </div>
    `;
  }

  // Active row — prefilled where possible
  const wPrefill = weightPrefillFor(ex, si);
  const rPrefill = repsPrefillFor(ex, si);
  const wHasValue = wPrefill !== '' && !isNaN(parseFloat(wPrefill));
  const last = findLastSet(ex.name, si);
  return `
    <div class="set-row active" data-set-idx="${si}">
      <span class="lbl">${si + 1}</span>
      <input type="tel" inputmode="decimal" class="set-w" value="${wHasValue ? wPrefill : ''}" placeholder="kg" autocomplete="off" maxlength="6">
      ${repsStepperHtml(rPrefill)}
      <button class="log-btn"${wHasValue ? '' : ' disabled'}>✓</button>
      ${last ? `<button type="button" class="last-chip" data-fill-last data-w="${last.weight}" data-r="${last.reps}">Last: ${fmtNum(last.weight)} kg × ${last.reps} · tap to use</button>` : ''}
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
