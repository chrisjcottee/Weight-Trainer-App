Views.history = function() {
  if (!state.sessions.length) {
    return `
      <h1>History</h1>
      <div class="empty">
        <div class="ico">◷</div>
        <div>No workouts logged yet.</div>
        <div class="faint" style="margin-top:8px;">Complete a workout to see it here.</div>
      </div>
      ${historyDangerZoneHtml()}
    `;
  }
  const sorted = state.sessions.slice().sort((a, b) => b.date - a.date);
  return `
    <h1>History</h1>
    <p class="subtle">${state.sessions.length} workout${state.sessions.length === 1 ? '' : 's'} completed</p>
    <div style="margin-top:16px;">
    ${sorted.map((s, idx) => `
      <div class="session-item">
        <div class="session-head">
          <span class="ttl">${esc(s.dayName || 'Workout ' + (s.dayIndex + 1))}</span>
          <span class="subtle">${fmtDate(s.date)}</span>
        </div>
        <div class="subtle mono">Week ${(s.weekIndex ?? 0) + 1} · ${setCount(s.exercises)} sets · ${fmtNum(totalVolume(s.exercises))} kg total volume</div>
        <details>
          <summary>View details</summary>
          ${s.exercises.map(e => `
            <div class="ex-detail">
              <div class="row between">
                <span class="nm">${esc(e.name)}</span>
                <span class="sts">${sessionExerciseStatus(e)}</span>
              </div>
              <div class="sts" style="margin-top:4px;">
                ${sessionExerciseSetSummary(e)}
              </div>
            </div>
          `).join('')}
        </details>
      </div>
    `).join('')}
    </div>
    ${historyDangerZoneHtml()}
  `;
};

function historyDangerZoneHtml() {
  return `
    <h2>Danger zone</h2>
    <button class="btn ghost" id="reset-program" style="color: var(--danger);">Reset Program & History</button>
  `;
}

