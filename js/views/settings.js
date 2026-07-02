Views.program = function() {
  return `
    <h1>Settings</h1>
    ${statsSummaryHtml()}

    <h2>Programs</h2>
    <div class="card">
      ${programLibraryHtml()}
    </div>

    ${collapsibleSectionHtml('templates', 'Ready-made programs', settingsTemplatesOpen, `
      <div class="subtle" style="margin-bottom:12px;">Add a copy of a prebuilt program to your library.</div>
      ${programTemplateListHtml()}
    `)}

    ${collapsibleSectionHtml('library', 'Exercise Library', settingsLibraryOpen, exerciseLibraryHtml())}

    <h2>Data</h2>
    <div class="card">
      <button class="btn ghost" id="reset-program" style="color: var(--danger);">Reset Program &amp; History</button>
    </div>
  `;
};

// The one place (outside celebration) where XP / level / streak show up.
function statsSummaryHtml() {
  const s = state.stats || { xp: 0, streak: 0 };
  const lvl = levelFromXp(s.xp);
  return `<div class="subtle stats-line">Level ${lvl} &middot; ${s.xp.toLocaleString()} XP${s.streak ? ` &middot; &#128293; ${s.streak} day streak` : ''}</div>`;
}

// A section that renders as just a tappable header row until opened.
function collapsibleSectionHtml(key, title, open, bodyHtml) {
  return `
    <div class="card settings-section ${open ? 'open' : ''}">
      <button class="settings-toggle" data-toggle-settings="${key}" aria-expanded="${open}">
        <span>${title}</span>
        <span class="chevron" aria-hidden="true">${open ? '&#9662;' : '&#9656;'}</span>
      </button>
      ${open ? `<div class="settings-section-body">${bodyHtml}</div>` : ''}
    </div>
  `;
}

function programLibraryHtml() {
  const programs = activeProgramLibrary();
  return `
    <button class="btn secondary" id="add-program" style="margin-bottom:12px;">+ New Program</button>
    <div class="library-list">
      ${programs.length ? programs.map(programLibraryRowHtml).join('') : `<div class="empty" style="padding:24px 12px;">No saved programs yet.</div>`}
    </div>
  `;
}

function programLibraryRowHtml(program) {
  const isActive = program.id === state.activeProgramId;
  return `
    <div class="library-row" data-program-id="${esc(program.id)}">
      <div class="library-name">
        <div>${esc(program.name)}</div>
        <div class="library-meta">${program.weeks} week${program.weeks === 1 ? '' : 's'} · ${program.template.length} workout${program.template.length === 1 ? '' : 's'} each week</div>
      </div>
      ${isActive ? `<span class="badge success">Active</span>` : ''}
      <div class="library-actions">
        ${isActive ? '' : `<button class="btn secondary small" data-act="use-program">Use</button>`}
        <button class="btn secondary small" data-act="edit-program-library">Edit</button>
        <button class="btn ghost small" data-act="delete-program-library" style="color: var(--danger);">Delete</button>
      </div>
    </div>
  `;
}

function exerciseLibraryHtml() {
  const q = exerciseLibrarySearch.trim().toLowerCase();
  const exercises = activeExerciseLibrary().filter(e => !q || e.name.toLowerCase().includes(q));
  return `
    <label class="field">
      <span class="lbl">Search Exercises</span>
      <input type="text" id="exercise-library-search" value="${esc(exerciseLibrarySearch)}" placeholder="Search exercise library">
    </label>
    <div class="library-tools">
      <input type="text" id="new-exercise-name" placeholder="New exercise name">
      <button class="btn secondary small" id="add-library-exercise">Add</button>
    </div>
    <div class="subtle">${activeExerciseLibrary().length} exercise${activeExerciseLibrary().length === 1 ? '' : 's'} available</div>
    <div class="library-list">
      ${exercises.length ? exercises.map(exerciseLibraryRowHtml).join('') : `<div class="empty" style="padding:24px 12px;">No matching exercises.</div>`}
    </div>
  `;
}

function exerciseLibraryRowHtml(ex) {
  if (editingExerciseLibraryId === ex.id) {
    return `
      <div class="library-row editing" data-library-ex-id="${esc(ex.id)}">
        <input type="text" class="library-edit-name" value="${esc(ex.name)}">
        <button class="btn small" data-act="save-library-ex">Save</button>
        <button class="btn secondary small" data-act="cancel-library-ex">Cancel</button>
      </div>
    `;
  }
  return `
    <div class="library-row" data-library-ex-id="${esc(ex.id)}">
      <div class="library-name">${esc(ex.name)}</div>
      ${exerciseUsedInCurrentProgram(ex.name) ? `<span class="badge success">In program</span>` : ''}
      <div class="library-actions">
        <button class="btn secondary small" data-act="edit-library-ex">Edit</button>
        <button class="btn ghost small" data-act="remove-library-ex" style="color: var(--danger);">Remove</button>
      </div>
    </div>
  `;
}
