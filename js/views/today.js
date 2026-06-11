/* ---------- Program tab ----------
   Calendar-anchored program tracker. Weeks are real Mon–Sun weeks; the
   required workouts can be completed in any order within the week. Each
   completed session is logged against its calendar day; tapping a day shows
   what was logged (editable) or, for today, what is still due. */

Views.today = function() {
  const program = state.program;
  syncCalendarRun();
  if (selectedDateTs == null) selectedDateTs = dayStartTs(Date.now());
  const currentWeek = currentWeekIndex();

  return `
    <div class="today-header">
      <div>
        <h1>Program</h1>
        <div class="program-sub">${esc(program.name)}</div>
      </div>
    </div>

    ${programIsComplete() ? programCompleteBannerHtml(program) : ''}
    ${weekStepperHtml(currentWeek)}
    ${calendarCardHtml(currentWeek)}
    ${selectedDayDetailHtml(currentWeek)}
  `;
};

/* Week stepper — one circle per program week; a week is checked once all of
   its required workouts were completed inside that calendar week. */
function weekStepperHtml(currentWeek) {
  const totalWeeks = state.program.weeks;
  const requiredPerWeek = state.program.template.length;
  const complete = programIsComplete();
  return `
    <div class="week-stepper" aria-label="Program weeks">
      ${Array.from({length: totalWeeks}, (_, i) => {
        const done = completedDayIdxsInCalendarWeek(i).length >= requiredPerWeek;
        const active = !complete && i === currentWeek;
        const classes = [
          done ? 'completed' : '',
          active ? 'active' : '',
          (!done && !active) ? 'upcoming' : ''
        ].filter(Boolean).join(' ');
        return `
          <button class="week-step ${classes}" data-select-week="${i}" aria-label="Week ${i + 1}${done ? ', completed' : active ? ', current' : ''}">
            <span class="week-step-circle">${done ? '&#10003;' : i + 1}</span>
            <span class="week-step-label">Week ${i + 1}</span>
          </button>
        `;
      }).join('')}
    </div>
  `;
}

/* Calendar card — collapsed shows the current week's row; expanded shows the
   whole program in the same format. */
function calendarCardHtml(currentWeek) {
  const program = state.program;
  const dows = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const legend = `
    <div class="cal-legend">
      ${program.template.map((d, i) => `
        <span class="key"><span class="swatch day-c${i % 6}"></span>${esc(d.name || 'Workout ' + (i + 1))}</span>
      `).join('')}
    </div>`;

  const dowRow = `
    <div class="cal-row">
      <span></span>
      ${dows.map(d => `<div class="cal-dow">${d}</div>`).join('')}
    </div>`;

  const weeks = calendarExpanded
    ? Array.from({length: program.weeks}, (_, w) => w)
    : [Math.min(currentWeek, program.weeks - 1)];

  return `
    <div class="card cal-card">
      <div class="row between" style="align-items:flex-start;">
        <div class="program-name">Calendar</div>
        ${legend}
      </div>
      <div class="cal-rows">
        ${dowRow}
        ${weeks.map(w => calendarWeekRowHtml(w, currentWeek)).join('')}
      </div>
      <button class="expand-btn" id="toggle-calendar" type="button">
        ${calendarExpanded ? 'This week only <span class="chev">&#9650;</span>' : 'Full program <span class="chev">&#9660;</span>'}
      </button>
    </div>
  `;
}

function calendarWeekRowHtml(w, currentWeek) {
  const base = new Date(weekStartTs(w));
  const isActiveRow = w === currentWeek && !programIsComplete();
  const cells = Array.from({length: 7}, (_, i) => {
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i);
    return calendarCellHtml(d.getTime());
  }).join('');
  return `
    <div class="cal-row ${isActiveRow ? 'active' : ''}">
      <div class="cal-wk-label">W${w + 1}</div>
      ${cells}
    </div>`;
}

function calendarCellHtml(ts) {
  const todayTs = dayStartTs(Date.now());
  const future = ts > todayTs;
  const sessions = sessionsOnDate(ts);
  const last = sessions.length ? sessions[sessions.length - 1] : null;
  const colorCls = last ? ' logged day-c' + ((last.dayIndex || 0) % 6) : '';
  const cls = [
    'cal-cell',
    colorCls,
    ts === todayTs ? 'today' : '',
    (ts === selectedDateTs && ts !== todayTs) ? 'selected' : '',
    future ? 'future' : ''
  ].filter(Boolean).join(' ');
  const tap = future ? '' : ` data-select-date="${ts}"`;
  return `<div class="${cls}"${tap}><span class="cd">${new Date(ts).getDate()}</span></div>`;
}

/* Detail under the calendar — always reflects the selected day. */
function selectedDayDetailHtml(currentWeek) {
  const ts = selectedDateTs;
  const isToday = sameLocalDay(ts, Date.now());
  const sessions = sessionsOnDate(ts);
  const dateLabel = new Date(ts).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
  const label = isToday ? 'Today &middot; ' + esc(dateLabel) : esc(dateLabel);

  let html = `<div class="section-label cal-day-label">${label}</div>`;

  sessions.forEach(s => {
    html += loggedSessionCardHtml(s, state.sessions.indexOf(s));
  });

  if (isToday && !programIsComplete()) {
    if (state.active) {
      html += `
        <div class="card pick-card">
          <div class="pick-head">
            <span class="pick-dot day-c${(state.active.dayIndex || 0) % 6}"></span>
            <div class="pick-main">
              <div class="pick-name">${esc(state.active.dayName)}</div>
              <div class="pick-meta">Workout in progress</div>
            </div>
            <button class="btn small" data-tab="workout">Continue</button>
          </div>
        </div>`;
    } else {
      const due = state.program.template
        .map((d, i) => ({ d, i }))
        .filter(({ i }) => !state.currentRun.completedDayIndices.includes(i));
      if (due.length) {
        due.forEach(({ d, i }) => { html += pickCardHtml(d, i); });
        html += `<div class="faint cal-hint">Any order &mdash; finishing a workout logs it to today. Tap a card to see its exercises.</div>`;
      } else if (!sessions.length) {
        html += weekCompleteCardHtml();
      } else {
        html += weekCompleteCardHtml();
      }
    }
  } else if (!sessions.length && !isToday) {
    html += `<div class="card compact"><div class="subtle">Nothing logged on this day.</div></div>`;
  } else if (!sessions.length && isToday && programIsComplete()) {
    html += `<div class="card compact"><div class="subtle">Program finished &mdash; start it again or pick a new one in Settings.</div></div>`;
  }

  return html;
}

function weekCompleteCardHtml() {
  return `
    <div class="card">
      <div class="program-name">Week complete &#10003;</div>
      <div class="program-meta">All ${state.program.template.length} workouts logged this week. Next week unlocks Monday.</div>
    </div>`;
}

/* A workout still due this week — tap to preview exercises, Start to begin. */
function pickCardHtml(day, i) {
  const expanded = expandedPickIdx === i;
  const exCount = day.exercises.length;
  const setTotal = day.exercises.reduce((n, e) => n + e.sets, 0);
  return `
    <div class="card pick-card" data-toggle-pick="${i}">
      <div class="pick-head">
        <span class="pick-dot day-c${i % 6}"></span>
        <div class="pick-main">
          <div class="pick-name">${esc(day.name || 'Workout ' + (i + 1))}</div>
          <div class="pick-meta">${exCount} exercise${exCount === 1 ? '' : 's'} &middot; ${setTotal} sets</div>
        </div>
        <button class="btn small" data-start-day="${i}">Start</button>
        <span class="pick-chev">${expanded ? '&#9662;' : '&#9656;'}</span>
      </div>
      ${expanded ? `
        <div class="pick-ex">
          ${day.exercises.map(e => `
            <div class="pick-ex-row"><span class="nm">${esc(e.name)}</span><span class="tgt">${e.sets} &times; ${e.reps}</span></div>
          `).join('')}
        </div>` : ''}
    </div>
  `;
}

/* A logged session on the selected day — editable / deletable. */
function loggedSessionCardHtml(session, sessionIdx) {
  const dayIdx = (session.dayIndex || 0) % 6;
  const partial = !sessionIsComplete(session);
  const busy = !!state.active;
  return `
    <div class="card logged-day-card">
      <div class="logged-session">
        <span class="pick-dot day-c${dayIdx}"></span>
        <div class="log-main">
          <div class="log-name">${esc(session.dayName || 'Workout ' + ((session.dayIndex || 0) + 1))}</div>
          <div class="log-meta">${sessionSummaryText(session)}</div>
        </div>
        ${partial ? '<span class="badge warn">Partial</span>' : '<span class="badge success">Logged</span>'}
      </div>
      ${busy ? '' : `
      <div class="dd-actions">
        <button class="btn secondary small" data-edit-session="${sessionIdx}">Edit log</button>
        <button class="btn ghost-danger small" data-delete-session="${sessionIdx}">Delete</button>
      </div>`}
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
