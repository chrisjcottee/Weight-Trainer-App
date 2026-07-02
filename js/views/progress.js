/* ---------- Progress (opened from Today) ----------
   Per-exercise trend of top-set weight across sessions, with best/current
   PRs and an SVG chart. Session-by-session logs live on the Today
   calendar; this screen answers "am I getting stronger?". */

Views.progress = function() {
  const data = exerciseProgressData();
  const body = data.length
    ? `
      <div class="card">
        <div class="library-list">
          ${data.map(progressRowHtml).join('')}
        </div>
      </div>`
    : `
      <div class="empty">
        <div class="ico">📈</div>
        <div>No logged exercises yet.</div>
        <div class="faint" style="margin-top:8px;">Finish a workout and your progress will show up here.</div>
      </div>`;
  return `
    <button class="btn ghost small progress-back" data-tab="today">&#8249; Today</button>
    <h1>Progress</h1>
    ${body}
  `;
};

/* Per-exercise top-set weight across every session that logged it, oldest
   first, so we can show a trend + PRs. */
function exerciseProgressData() {
  const byName = new Map();
  state.sessions.slice().sort((a, b) => a.date - b.date).forEach(s => {
    s.exercises.forEach(e => {
      if (!e.sets || !e.sets.length) return;
      const top = e.sets.reduce((m, st) => ((st.weight || 0) > (m.weight || 0) ? st : m), e.sets[0]);
      let d = byName.get(e.name);
      if (!d) byName.set(e.name, d = { name: e.name, points: [] });
      d.points.push({ date: s.date, weight: top.weight || 0, reps: top.reps || 0 });
    });
  });
  return Array.from(byName.values()).map(d => Object.assign(d, {
    current: d.points[d.points.length - 1],
    best: d.points.reduce((m, p) => (p.weight > m.weight ? p : m), d.points[0])
  })).sort((a, b) => b.current.date - a.current.date || a.name.localeCompare(b.name));
}

function exerciseProgressSectionHtml() {
  const data = exerciseProgressData();
  if (!data.length) return '';
  return `
    <h2>Exercise progress</h2>
    <div class="card">
      <div class="library-list">
        ${data.map(progressRowHtml).join('')}
      </div>
    </div>
  `;
}

function progressRowHtml(d) {
  const expanded = expandedProgressName === d.name;
  return `
    <div class="library-row progress-row${expanded ? ' expanded' : ''}">
      <button class="progress-toggle" type="button" data-toggle-progress="${esc(d.name)}" aria-expanded="${expanded}">
        <div class="library-name">
          <div>${esc(d.name)}</div>
          <div class="library-meta">${d.points.length} session${d.points.length === 1 ? '' : 's'} · last ${fmtDate(d.current.date)}</div>
        </div>
        <div class="progress-nums mono">
          <span class="progress-current">${fmtNum(d.current.weight)} kg</span>
          <span class="progress-best">best ${fmtNum(d.best.weight)} kg</span>
        </div>
        <span class="pick-chev">${expanded ? '&#9662;' : '&#9656;'}</span>
      </button>
      ${expanded ? progressDetailHtml(d) : ''}
    </div>
  `;
}

function progressDetailHtml(d) {
  const chart = d.points.length > 1
    ? progressChartSvg(d)
    : `<div class="faint" style="padding:8px 0;">Log this exercise again to see a trend.</div>`;
  return `
    <div class="progress-detail">
      ${chart}
      <div class="progress-prs">
        <span>Best: ${fmtNum(d.best.weight)} kg × ${d.best.reps} · ${fmtDate(d.best.date)}</span>
        <span>Now: ${fmtNum(d.current.weight)} kg × ${d.current.reps}</span>
      </div>
    </div>
  `;
}

/* Hand-rolled SVG line chart of top-set weight over time. Fixed aspect
   (no preserveAspectRatio override) so the marker dots stay circular;
   CSS scales it to the card width. */
function progressChartSvg(d) {
  const W = 320, H = 120, padX = 12, padTop = 14, padBot = 20;
  const pts = d.points;
  const t0 = pts[0].date;
  const span = Math.max(1, pts[pts.length - 1].date - t0);
  const ws = pts.map(p => p.weight);
  let lo = Math.min(...ws), hi = Math.max(...ws);
  if (lo === hi) { lo -= 1; hi += 1; }
  const x = p => (padX + (p.date - t0) / span * (W - 2 * padX)).toFixed(1);
  const y = p => (padTop + (1 - (p.weight - lo) / (hi - lo)) * (H - padTop - padBot)).toFixed(1);
  const line = pts.map(p => `${x(p)},${y(p)}`).join(' ');
  const dots = pts.map(p =>
    `<circle cx="${x(p)}" cy="${y(p)}" r="3"${p === d.best ? ' class="pr"' : ''}></circle>`
  ).join('');
  return `
    <svg class="progress-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Top-set weight over time">
      <polyline points="${line}"></polyline>
      ${dots}
      <text class="axis" x="${padX}" y="${H - 6}">${fmtDate(pts[0].date)}</text>
      <text class="axis" x="${W - padX}" y="${H - 6}" text-anchor="end">${fmtDate(pts[pts.length - 1].date)}</text>
      <text class="axis" x="${W - padX}" y="11" text-anchor="end">${fmtNum(hi)} kg</text>
    </svg>
  `;
}
