Views.setup = function() {
  if (!setupDraft) {
    setupDraft = state.program
      ? { id: state.activeProgramId, name: state.program.name, weeks: state.program.weeks, days: structuredClone(state.program.template), makeActive: true }
      : { id: null, name: 'My Program', weeks: 8, days: [makeDay()], makeActive: true };
  }
  const isNew = !setupDraft.id;
  const suggestions = exerciseNameSuggestions();
  return `
    <datalist id="exercise-options">
      ${suggestions.map(n => `<option value="${esc(n)}">`).join('')}
    </datalist>

    <h1>${isNew ? 'Create Program' : 'Edit Program'}</h1>
    <p class="subtle">${isNew ? 'Build a reusable program for your library. You can make it active now, or switch programs later from your Library.' : 'Changes update this saved program going forward.'}</p>

    <div style="margin-top:20px;">
      <label class="field">
        <span class="lbl">Program Name</span>
        <input type="text" id="prog-name" value="${esc(setupDraft.name)}" placeholder="e.g. 8-week Push/Pull/Legs">
      </label>
      <label class="field" style="max-width:200px;">
        <span class="lbl">Number of Weeks</span>
        <div class="stepper big" data-stepper-target="weeks">
          <button class="step-btn" data-step="-1" type="button">−</button>
          <span class="step-val" id="prog-weeks-val">${setupDraft.weeks}</span>
          <button class="step-btn" data-step="1" type="button">+</button>
        </div>
      </label>
    </div>

    <h2>Workouts each week</h2>
    <p class="subtle" style="margin-top:-8px;">These workouts repeat every week. You can do them in any order.</p>
    <div id="days">
      ${setupDraft.days.map((d, i) => dayEditorHtml(d, i)).join('')}
    </div>

    <button class="btn secondary" id="add-day" style="margin-top:8px;">+ Add Workout</button>

    <div style="height:24px"></div>

    <button class="btn" id="save-program">${isNew ? 'Create Program' : 'Save Program'}</button>
    ${(state.program || state.programLibrary.length) ? `<button class="btn ghost" id="cancel-setup" style="margin-top:8px;">Cancel</button>` : ''}
  `;
};

function makeDay() {
  return { name: '', exercises: [makeEx()] };
}
function makeEx() {
  return { name: '', sets: 3, reps: 8 };
}

function dayEditorHtml(day, i) {
  return `
    <div class="day-editor" data-day="${i}">
      <div class="row between" style="margin-bottom:12px;">
        <input type="text" class="day-name" value="${esc(day.name)}" placeholder="Workout ${i + 1} name (e.g. Push)" style="font-weight:600;">
        ${setupDraft.days.length > 1 ? `<button class="btn icon" data-act="rm-day" title="Remove workout">×</button>` : ''}
      </div>
      <div class="exercises">
        ${day.exercises.map((e, j) => exEditorHtml(e, j)).join('')}
      </div>
      <button class="btn ghost small" data-act="add-ex" style="margin-top:8px;">+ Add Exercise</button>
    </div>
  `;
}

function exEditorHtml(ex, j) {
  return `
    <div class="ex-editor" data-ex="${j}">
      <div class="ex-editor-top">
        <input type="text" class="exname" list="exercise-options" data-f="name" value="${esc(ex.name)}" placeholder="Exercise name">
        <button class="remove" data-act="rm-ex" title="Remove">×</button>
      </div>
      <div class="ex-editor-bottom">
        <div class="stepper-group">
          <span class="stepper-label">Sets</span>
          <div class="stepper" data-f="sets">
            <button class="step-btn" data-step="-1" type="button">−</button>
            <span class="step-val">${ex.sets}</span>
            <button class="step-btn" data-step="1" type="button">+</button>
          </div>
        </div>
        <div class="stepper-group">
          <span class="stepper-label">Reps</span>
          <div class="stepper" data-f="reps">
            <button class="step-btn" data-step="-1" type="button">−</button>
            <span class="step-val">${ex.reps}</span>
            <button class="step-btn" data-step="1" type="button">+</button>
          </div>
        </div>
      </div>
    </div>
  `;
};

function exerciseNameSuggestions() {
  return activeExerciseLibrary().map(e => e.name);
}

function activeProgramLibrary() {
  state.programLibrary = normalizeProgramLibrary(state);
  return state.programLibrary
    .filter(p => !p.archived)
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

function findProgramRecord(id) {
  state.programLibrary = normalizeProgramLibrary(state);
  return state.programLibrary.find(p => p.id === id && !p.archived);
}

function setActiveProgram(id, opts = {}) {
  const record = findProgramRecord(id);
  if (!record) return false;
  const sameProgram = state.activeProgramId === id;
  state.activeProgramId = id;
  state.program = programFromRecord(record);
  state.active = null;
  state.celebration = null;
  selectedWeekIndex = null;
  expandedDayKey = null;
  if (!sameProgram || opts.resetProgress) {
    state.currentRun = { startedAt: Date.now(), weekIndex: 0, completedDayIndices: [] };
  } else {
    state.currentRun.weekIndex = Math.min(state.currentRun.weekIndex, state.program.weeks);
    state.currentRun.completedDayIndices = state.currentRun.completedDayIndices.filter(i => i < state.program.template.length);
  }
  return true;
}

function prebuiltPrograms() {
  return Array.isArray(PREBUILT_PROGRAMS) ? PREBUILT_PROGRAMS : [];
}

function findPrebuiltProgram(id) {
  return prebuiltPrograms().find(p => p.id === id) || null;
}

// Clone a prebuilt template into the user's library as a fresh editable
// program, then make it the active program starting from Week 1.
function useTemplateProgram(id) {
  const tpl = findPrebuiltProgram(id);
  if (!tpl) return false;
  state.programLibrary = normalizeProgramLibrary(state);
  const program = { name: tpl.name, weeks: tpl.weeks, template: structuredClone(tpl.template) };
  const record = makeProgramRecord(program);
  state.programLibrary.unshift(record);
  record.template.forEach(d => d.exercises.forEach(e => ensureExerciseInLibrary(e.name)));
  setActiveProgram(record.id, { resetProgress: true });
  return true;
}

function activeExerciseLibrary() {
  state.exerciseLibrary = normalizeExerciseLibrary(state);
  return state.exerciseLibrary
    .filter(e => !e.archived)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function ensureExerciseInLibrary(name) {
  const clean = String(name || '').trim();
  if (!clean) return null;
  state.exerciseLibrary = normalizeExerciseLibrary(state);
  const existing = state.exerciseLibrary.find(e => e.name.toLowerCase() === clean.toLowerCase());
  if (existing) {
    existing.archived = false;
    return existing;
  }
  const entry = makeExerciseLibraryEntry(clean, false);
  state.exerciseLibrary.push(entry);
  state.exerciseLibrary.sort((a, b) => a.name.localeCompare(b.name));
  return entry;
}

function exerciseUsedInCurrentProgram(name) {
  if (!state.program) return false;
  const key = String(name || '').trim().toLowerCase();
  return state.program.template.some(d => d.exercises.some(e => e.name.toLowerCase() === key));
}

function updateProgramExerciseName(oldName, newName) {
  const oldKey = String(oldName || '').trim().toLowerCase();
  const updateTemplate = (template) => template.forEach(d => {
    d.exercises.forEach(e => {
      if (e.name.toLowerCase() === oldKey) e.name = newName;
    });
  });
  if (state.program) updateTemplate(state.program.template);
  if (Array.isArray(state.programLibrary)) {
    state.programLibrary.forEach(p => updateTemplate(p.template || []));
  }
}

