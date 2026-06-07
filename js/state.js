function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return migrate(Object.assign(structuredClone(DEFAULT_STATE), JSON.parse(raw)));
  } catch (e) { console.warn('load failed', e); }
  return structuredClone(DEFAULT_STATE);
}

function migrate(s) {
  s.exerciseLibrary = normalizeExerciseLibrary(s);
  s.programLibrary = normalizeProgramLibrary(s);
  if (!s.activeProgramId && s.programLibrary.length) {
    s.activeProgramId = s.programLibrary.find(p => !p.archived)?.id || null;
  }
  if (!s.program && s.activeProgramId) {
    const active = s.programLibrary.find(p => p.id === s.activeProgramId && !p.archived);
    if (active) s.program = programFromRecord(active);
  }
  if (!s.program) return s;
  // Old program shape: { name, days: [...] } → { name, weeks: 1, template: [...] }
  if (s.program.days && !s.program.template) {
    s.program = {
      name: s.program.name,
      weeks: 1,
      template: s.program.days
    };
  }
  // Normalize currentRun shape
  const cr = s.currentRun || {};
  const newCR = {
    startedAt: cr.startedAt || Date.now(),
    weekIndex: typeof cr.weekIndex === 'number' ? cr.weekIndex : 0,
    completedDayIndices: Array.isArray(cr.completedDayIndices) ? cr.completedDayIndices : []
  };
  // Migrate old completedDayCount → weekIndex/completedDayIndices
  if (typeof cr.completedDayCount === 'number' && !Array.isArray(cr.completedDayIndices)) {
    const dayCount = s.program.template.length;
    const fullWeeks = Math.floor(cr.completedDayCount / dayCount);
    const remainder = cr.completedDayCount % dayCount;
    newCR.weekIndex = fullWeeks;
    newCR.completedDayIndices = Array.from({ length: remainder }, (_, i) => i);
  }
  s.currentRun = newCR;
  s.programLibrary = normalizeProgramLibrary(s);
  if (!s.activeProgramId && s.programLibrary.length) {
    s.activeProgramId = s.programLibrary.find(p => !p.archived)?.id || null;
  }
  // Ensure sessions have weekIndex
  if (Array.isArray(s.sessions)) {
    s.sessions.forEach(sess => { if (sess.weekIndex == null) sess.weekIndex = 0; });
  }
  s.exerciseLibrary = normalizeExerciseLibrary(s);
  return s;
}

function programFromRecord(record) {
  return {
    name: record.name,
    weeks: record.weeks,
    template: structuredClone(record.template || [])
  };
}

function normalizeProgramLibrary(s) {
  const byId = new Map();
  const add = (program, existing = {}) => {
    if (!program) return;
    const record = makeProgramRecord(program, existing);
    byId.set(record.id, record);
  };

  if (Array.isArray(s.programLibrary)) {
    s.programLibrary.forEach(p => add(p, p));
  }
  if (s.program) {
    const existingActive = s.activeProgramId && byId.get(s.activeProgramId);
    add(s.program, existingActive || { id: s.activeProgramId || undefined });
  }
  return Array.from(byId.values())
    .filter(p => !p.archived)
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

function normalizeExerciseLibrary(s) {
  const byName = new Map();
  const add = (entry, opts = {}) => {
    const name = String(entry && entry.name || '').trim();
    if (!name) return;
    const key = name.toLowerCase();
    if (byName.has(key)) {
      const existing = byName.get(key);
      existing.builtIn = existing.builtIn || !!entry.builtIn;
      if (!opts.keepArchive) existing.archived = existing.archived && !!entry.archived;
      return;
    }
    byName.set(key, {
      id: entry.id || (entry.builtIn ? `builtin-${slugifyExerciseName(name)}` : `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
      name,
      builtIn: !!entry.builtIn,
      archived: !!entry.archived
    });
  };

  if (Array.isArray(s.exerciseLibrary)) s.exerciseLibrary.forEach(add);
  makeInitialExerciseLibrary().forEach(entry => add(entry, { keepArchive: true }));
  if (Array.isArray(s.programLibrary)) {
    s.programLibrary.forEach(p => (p.template || []).forEach(d => d.exercises.forEach(e => add(makeExerciseLibraryEntry(e.name, false), { keepArchive: true }))));
  }
  if (s.program && Array.isArray(s.program.template)) {
    s.program.template.forEach(d => d.exercises.forEach(e => add(makeExerciseLibraryEntry(e.name, false), { keepArchive: true })));
  }
  if (Array.isArray(s.sessions)) {
    s.sessions.forEach(sess => sess.exercises.forEach(e => add(makeExerciseLibraryEntry(e.name, false), { keepArchive: true })));
  }
  return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    // Verify it actually persisted (some browsers silently accept then drop)
    const check = localStorage.getItem(STORAGE_KEY);
    if (!check) throw new Error('write succeeded but read returned empty');
    return true;
  } catch (e) {
    console.error('save failed', e);
    if (!saveErrorShown) {
      saveErrorShown = true;
      showModal({
        title: 'Could not save your data',
        body: 'Your browser is blocking storage. Common causes: Private/Incognito mode, "Block All Cookies", or full storage. Your changes won\'t persist across reloads until this is fixed.\n\nError: ' + (e.message || String(e)),
        confirmText: 'OK',
        hideCancel: true,
        onConfirm: closeModal
      });
    }
    return false;
  }
}

function buzz(pattern) {
  // No-op on iOS Safari (Vibration API unsupported). Works on Android Chrome / many PWAs.
  try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) {}
}

function storageWorks() {
  try {
    const k = '__wt_test__';
    localStorage.setItem(k, '1');
    const ok = localStorage.getItem(k) === '1';
    localStorage.removeItem(k);
    return ok;
  } catch (e) {
    return false;
  }
}

function setState(patch) {
  Object.assign(state, patch);
  save();
  render();
}

let state = load();
let setupDraft = null;  // { name, weeks, days: [...] } while editing in setup screen
let editingSet = null;  // { exIdx, setIdx } when a logged set is being edited
let expandedExIdx = null;  // index of a completed exercise expanded for editing in the rail
let selectedWeekIndex = null; // UI-only selected week on Today
let expandedDayKey = null;    // UI-only expanded Today day, formatted as "week:day"
let exerciseLibrarySearch = '';
let editingExerciseLibraryId = null;
let modal = null;
