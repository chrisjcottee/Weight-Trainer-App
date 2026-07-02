/* ---------- Unified workout bottom bar ----------
   One fixed bar above the tab bar during a workout, replacing the old
   stacked Finish bar + rest bar. Mounted on <body> so it survives view
   re-renders. Two slots:
     [Finish] [context]
   Context priority: rest countdown while resting; otherwise a one-tap
   quick-log of the active set's "last time" values — the most common
   action lives in the thumb zone instead of up in the exercise card. */

function renderWorkoutBar() {
  const active = state.active && !state.celebration && !state.editing &&
    state.tab === 'workout';
  let bar = document.getElementById('workout-bar');
  if (!active) {
    if (bar) bar.remove();
    return;
  }
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'workout-bar';
    document.body.appendChild(bar);
  }

  const a = state.active;
  const allResolved = a.exercises.every(exerciseIsResolved);
  const resting = restState.total > 0;
  const quick = !resting ? quickLogInfo() : null;
  const compactFinish = resting || quick;

  const finishBtn = `
    <button class="btn ${allResolved ? 'success' : ''} ${compactFinish ? 'wb-finish-compact' : ''}" id="finish-workout">
      ${compactFinish ? (allResolved ? 'Finish ✓' : 'Finish') : (allResolved ? 'Finish Workout ✓' : 'Finish Workout')}
    </button>`;

  let context = '';
  if (resting) {
    const pct = restState.total ? Math.max(0, restState.remaining / restState.total) * 100 : 0;
    const mm = Math.floor(restState.remaining / 60);
    const ss = String(restState.remaining % 60).padStart(2, '0');
    context = `
      <div class="wb-rest ${restState.done ? 'done' : ''}">
        <div class="rest-fill" style="width:${pct}%"></div>
        <div class="rest-inner">
          <button class="rest-btn" data-rest="-15" type="button" aria-label="Subtract 15 seconds">−15</button>
          <div class="rest-mid">
            <span class="rest-label">${restState.done ? 'Rest done' : 'Rest'}</span>
            <span class="rest-time">${mm}:${ss}</span>
          </div>
          <button class="rest-btn" data-rest="15" type="button" aria-label="Add 15 seconds">+15</button>
          <button class="rest-btn skip" data-rest="skip" type="button">${restState.done ? 'Done' : 'Skip'}</button>
        </div>
      </div>`;
  } else if (quick) {
    context = `
      <button class="wb-quick-log" data-quick-log type="button">
        ${fmtNum(quick.weight)} kg × ${quick.reps} <span class="wb-quick-check">✓</span>
      </button>`;
  }

  bar.innerHTML = `<div class="wb-inner">${finishBtn}${context}</div>`;
}

// The active exercise's next set, if its "last time" values are known —
// what the one-tap quick-log button would log.
function quickLogInfo() {
  const a = state.active;
  if (!a) return null;
  const exIdx = currentActiveIdx();
  if (exIdx < 0) return null;
  const ex = a.exercises[exIdx];
  if (ex.sets.length >= exerciseSlots(ex)) return null;
  const last = findLastSet(ex.name, ex.sets.length);
  return last ? { weight: last.weight, reps: last.reps } : null;
}
