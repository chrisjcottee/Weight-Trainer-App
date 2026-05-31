Views.celebration = function() {
  const c = state.celebration;
  if (c.type !== 'workout') return '';

  let headline, icon, iconBg, sub;
  if (c.programComplete) {
    headline = 'Program Complete!';
    icon = '🏆';
    iconBg = 'var(--accent)';
    sub = `You finished all ${state.program.weeks} weeks of ${esc(state.program.name)}.`;
  } else if (c.weekComplete) {
    headline = `Week ${c.weekIndex + 1} Done!`;
    icon = '🎉';
    iconBg = 'var(--accent)';
    sub = `All ${state.program.template.length} workouts complete · ${workoutSummaryText(c.setCount, c.volume, c.skippedCount)}`;
  } else if (c.fullyComplete) {
    headline = `${esc(c.dayName)} Done!`;
    icon = '✓';
    iconBg = 'var(--success)';
    sub = `Week ${c.weekIndex + 1} · ${workoutSummaryText(c.setCount, c.volume, c.skippedCount)}`;
  } else {
    headline = 'Workout Saved';
    icon = '◐';
    iconBg = 'var(--warn)';
    sub = `${workoutSummaryText(c.setCount, c.volume, c.skippedCount)} · workout not yet complete`;
  }

  const timeline = (c.fullyComplete && !c.programComplete) ? weekTimelineHtml(c) : '';

  return `
    <div class="celebrate">
      <div class="big" style="background:${iconBg};">${icon}</div>
      <h1>${headline}</h1>
      <p class="sub">${sub}</p>
      ${timeline}
      <div class="reward-row">
        <div class="reward"><span class="label">XP Earned</span>+${c.xpEarned}</div>
        ${c.fullyComplete ? `<div class="reward"><span class="label">Streak</span>🔥 ${state.stats.streak}</div>` : ''}
      </div>
      ${c.leveledUp ? `<div class="reward" style="display:inline-block; margin:8px auto 20px; background: var(--accent); color: white;"><span class="label" style="color:rgba(255,255,255,0.8);">Level Up!</span>Level ${levelFromXp(state.stats.xp)}</div>` : ''}
      <button class="btn" id="celebrate-continue" style="max-width:280px; margin:24px auto 0;">${c.programComplete ? 'See Program' : 'Continue'}</button>
    </div>
  `;
};

function weekTimelineHtml(c) {
  const names = c.templateDayNames || [];
  if (!names.length) return '';
  const done = new Set(c.completedThisWeek || []);
  const doneCount = done.size;
  const total = names.length;

  // Cascade animation on week-complete; otherwise only the just-done node pops.
  const animate = (i) => {
    if (c.weekComplete && done.has(i)) return `animation-delay: ${i * 90}ms;`;
    if (!c.weekComplete && i === c.dayIndex) return '';
    return null;
  };

  const nodes = names.map((name, i) => {
    const isDone = done.has(i);
    const animStyle = animate(i);
    const isAnimated = animStyle !== null;
    const cls = ['week-tl-node', isDone ? 'done' : '', isAnimated ? 'animate-in' : ''].filter(Boolean).join(' ');
    return `<div class="${cls}"${animStyle ? ` style="${animStyle}"` : ''}>${isDone ? '✓' : (i + 1)}</div>`;
  });

  // Lines fill when both adjacent nodes are done.
  const row = [];
  nodes.forEach((node, i) => {
    row.push(node);
    if (i < nodes.length - 1) {
      const filled = done.has(i) && done.has(i + 1);
      row.push(`<div class="week-tl-line${filled ? ' filled' : ''}"></div>`);
    }
  });

  const labels = names.map((name, i) => {
    const isDone = done.has(i);
    const label = (name || '').trim() || `Workout ${i + 1}`;
    return `<div class="week-tl-name${isDone ? ' done' : ''}">${esc(label)}</div>`;
  }).join('');

  return `
    <div class="week-timeline${c.weekComplete ? ' week-complete' : ''}">
      <div class="week-tl-row">${row.join('')}</div>
      <div class="week-tl-labels">${labels}</div>
      <div class="week-tl-caption">Week ${c.weekIndex + 1} · ${doneCount} of ${total} done</div>
    </div>
  `;
}

