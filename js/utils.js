/* ---------- Helpers ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmtNum = n => {
  if (n == null || isNaN(n)) return '–';
  const r = Math.round(n * 10) / 10;
  return r % 1 === 0 ? String(r) : r.toFixed(1);
};
const fmtDate = ts => {
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();
  if (sameDay) return 'Today';
  if (isYesterday) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
};
const daysBetween = (a, b) => {
  const d1 = new Date(new Date(a).toDateString());
  const d2 = new Date(new Date(b).toDateString());
  return Math.round((d2 - d1) / 86400000);
};

function totalVolume(exercises) {
  let v = 0;
  exercises.forEach(e => e.sets.forEach(s => v += (s.weight || 0) * (s.reps || 0)));
  return v;
}
function setCount(exercises) {
  return exercises.reduce((n, e) => n + e.sets.length, 0);
}
function exerciseSlots(ex) {
  // Target sets plus the user's mid-workout adjustment (extraSets, which may be
  // negative if they deleted planned sets). Never fewer than the logged sets,
  // and never below one.
  return Math.max(1, ex.sets.length, ex.targetSets + (ex.extraSets || 0));
}
function exerciseIsComplete(ex) {
  return ex.sets.length >= exerciseSlots(ex);
}
function exerciseIsResolved(ex) {
  return exerciseIsComplete(ex) || !!ex.skipped;
}
function skippedCount(exercises) {
  return exercises.filter(e => e.skipped).length;
}
function workoutSummaryText(setCountVal, volume, skippedCountVal) {
  const parts = [`${setCountVal} sets`, `${fmtNum(volume)} kg`];
  if (skippedCountVal) parts.push(`${skippedCountVal} skipped`);
  return parts.join(' · ');
}
function levelFromXp(xp) {
  return Math.floor(Math.sqrt(xp / 100));
}
function xpForLevel(lvl) {
  return lvl * lvl * 100;
}

function findLastSet(exerciseName, setIndex) {
  for (let i = state.sessions.length - 1; i >= 0; i--) {
    const ex = state.sessions[i].exercises.find(e => e.name === exerciseName);
    if (ex && ex.sets[setIndex]) return ex.sets[setIndex];
  }
  return null;
}

// The equivalent set (same index) from the most recent past workout in which
// this exercise was fully completed — the baseline for progression badges.
function lastCompletedSet(exerciseName, setIndex) {
  for (let i = state.sessions.length - 1; i >= 0; i--) {
    const ex = state.sessions[i].exercises.find(e => e.name === exerciseName);
    if (!ex || ex.skipped) continue;
    const target = ex.targetSets || 0;
    if (ex.sets.length > 0 && ex.sets.length >= target && ex.sets[setIndex]) {
      return ex.sets[setIndex];
    }
  }
  return null;
}

// Weight/reps gained on a logged set versus the equivalent set last time this
// exercise was completed. Returns null when there's no completed baseline.
function setProgress(ex, setIndex, logged) {
  if (!logged) return null;
  const ref = lastCompletedSet(ex.name, setIndex);
  if (!ref) return null;
  return { weight: logged.weight - ref.weight, reps: logged.reps - ref.reps };
}

function weightPrefillFor(ex, si) {
  // Set 2+: take the weight from the previous set in this workout
  if (si > 0 && ex.sets[si - 1]) return ex.sets[si - 1].weight;
  // Set 1: take the weight from the most recent matching set in history (if any)
  const last = findLastSet(ex.name, 0);
  return last ? last.weight : '';
}

function sessionExerciseStatus(ex) {
  const sets = ex.sets.length;
  if (ex.skipped) {
    return sets
      ? `${sets} set${sets === 1 ? '' : 's'} · skipped rest`
      : 'Skipped';
  }
  return `${sets} set${sets === 1 ? '' : 's'}`;
}

function sessionExerciseSetSummary(ex) {
  if (!ex.sets.length) return ex.skipped ? 'No sets logged' : '';
  return ex.sets.map(st => `${fmtNum(st.weight)}kg × ${st.reps}`).join(' · ');
}

function repsPrefillFor(ex, si) {
  // Set 2+: take the reps from the previous set in this workout
  if (si > 0 && ex.sets[si - 1]) return ex.sets[si - 1].reps;
  // Set 1: use the program's target reps
  return ex.targetReps;
}

function currentWeekIndex() {
  if (!state.program) return 0;
  return Math.min(state.currentRun.weekIndex || 0, Math.max(0, state.program.weeks - 1));
}

function clampWeekIndex(weekIndex) {
  if (!state.program) return 0;
  const max = Math.max(0, state.program.weeks - 1);
  const n = parseInt(weekIndex, 10);
  if (isNaN(n)) return currentWeekIndex();
  return Math.max(0, Math.min(max, n));
}

function dayKey(weekIndex, dayIndex) {
  return `${weekIndex}:${dayIndex}`;
}

function sessionBelongsToActiveProgram(session) {
  if (!session) return false;
  if (!state.activeProgramId) return true;
  return !session.programId || session.programId === state.activeProgramId;
}

function activeProgramSessions() {
  return state.sessions.filter(sessionBelongsToActiveProgram);
}

function sessionsForWeek(weekIndex) {
  return activeProgramSessions().filter(s => s.weekIndex === weekIndex);
}

function sessionForDay(weekIndex, dayIndex) {
  return activeProgramSessions().slice().reverse().find(s =>
    s.weekIndex === weekIndex && s.dayIndex === dayIndex
  );
}

function dayIsDoneInWeek(weekIndex, dayIndex) {
  if (!state.program) return false;
  if ((state.currentRun.weekIndex || 0) > weekIndex) return true;
  if ((state.currentRun.weekIndex || 0) === weekIndex) {
    return state.currentRun.completedDayIndices.includes(dayIndex);
  }
  return false;
}

function dayIsDoneThisWeek(dayIndex) {
  return dayIsDoneInWeek(state.currentRun.weekIndex || 0, dayIndex);
}

function nextDayIndex() {
  if (!state.program || programIsComplete()) return -1;
  for (let i = 0; i < state.program.template.length; i++) {
    if (!dayIsDoneThisWeek(i)) return i;
  }
  return -1;
}

function weekIsComplete() {
  return state.program && state.currentRun.completedDayIndices.length >= state.program.template.length;
}

function programIsComplete() {
  return state.program && (state.currentRun.weekIndex || 0) >= state.program.weeks;
}

function sessionForDayThisWeek(dayIndex) {
  return sessionForDay(state.currentRun.weekIndex || 0, dayIndex);
}

function latestSessionThisWeek() {
  return activeProgramSessions().slice().reverse().find(s =>
    s.weekIndex === (state.currentRun.weekIndex || 0) &&
    state.currentRun.completedDayIndices.includes(s.dayIndex)
  );
}

function completedDayCountForWeek(weekIndex) {
  if (!state.program) return 0;
  if ((state.currentRun.weekIndex || 0) > weekIndex) return state.program.template.length;
  if ((state.currentRun.weekIndex || 0) === weekIndex) return state.currentRun.completedDayIndices.length;
  return 0;
}

function activeDayIndexForWeek(weekIndex) {
  if (programIsComplete()) return -1;
  if ((state.currentRun.weekIndex || 0) !== weekIndex) return -1;
  return nextDayIndex();
}

function defaultExpandedDayKey(weekIndex) {
  if (!state.program || !state.program.template.length) return null;
  const activeIdx = activeDayIndexForWeek(weekIndex);
  if (activeIdx >= 0) return dayKey(weekIndex, activeIdx);
  for (let i = 0; i < state.program.template.length; i++) {
    if (dayIsDoneInWeek(weekIndex, i)) return dayKey(weekIndex, i);
  }
  return dayKey(weekIndex, 0);
}

function ensureTodaySelection() {
  if (!state.program) {
    selectedWeekIndex = null;
    expandedDayKey = null;
    return 0;
  }
  selectedWeekIndex = clampWeekIndex(selectedWeekIndex == null ? currentWeekIndex() : selectedWeekIndex);
  if (!expandedDayKey || !expandedDayKey.startsWith(`${selectedWeekIndex}:`)) {
    expandedDayKey = defaultExpandedDayKey(selectedWeekIndex);
  }
  return selectedWeekIndex;
}

function sessionSummaryText(session) {
  if (!session) return 'Done';
  return workoutSummaryText(
    setCount(session.exercises),
    totalVolume(session.exercises),
    skippedCount(session.exercises)
  );
}

/* ---------- Calendar weeks (Mon–Sun) ----------
   The program is anchored to real calendar weeks: week 1 is the Mon–Sun
   window containing currentRun.startedAt, and the "current week" advances
   with the date — not with workout completion. Required workouts can be done
   in any order within the week; completion is derived from logged sessions'
   dates rather than tracked separately. */
const WEEK_MS = 7 * 86400000;

function dayStartTs(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function mondayOfTs(ts) {
  const d = new Date(dayStartTs(ts));
  return d.getTime() - ((d.getDay() + 6) % 7) * 86400000;
}

function programStartMonday() {
  return mondayOfTs(state.currentRun.startedAt || Date.now());
}

// Which program week (0-based) a timestamp falls in. May be < 0 or >= weeks.
function calendarWeekOfTs(ts) {
  return Math.floor((mondayOfTs(ts) - programStartMonday()) / WEEK_MS);
}

function weekStartTs(weekIndex) {
  return programStartMonday() + weekIndex * WEEK_MS;
}

function sameLocalDay(a, b) {
  return dayStartTs(a) === dayStartTs(b);
}

// Whether a saved session resolved every exercise. Newer sessions carry the
// flag; older ones fall back to a best-effort check against targets.
function sessionIsComplete(s) {
  if (!s) return false;
  if (s.fullyComplete != null) return !!s.fullyComplete;
  return s.exercises.every(e => e.skipped || e.sets.length >= (e.targetSets || 0));
}

function sessionsOnDate(ts) {
  return activeProgramSessions().filter(s => sameLocalDay(s.date, ts));
}

// Template-day indices completed (fully) in a calendar week, from sessions.
function completedDayIdxsInCalendarWeek(weekIndex) {
  if (!state.program) return [];
  const start = weekStartTs(weekIndex);
  const end = start + WEEK_MS;
  const idxs = new Set();
  activeProgramSessions().forEach(s => {
    if (s.date >= start && s.date < end && s.dayIndex != null && sessionIsComplete(s)) {
      idxs.add(s.dayIndex);
    }
  });
  return Array.from(idxs).filter(i => i < state.program.template.length);
}

// Keep currentRun in line with the calendar. weekIndex may equal program.weeks
// (or more) once the final week has passed — that's what completes the program.
function syncCalendarRun() {
  if (!state.program) return;
  if (!state.currentRun.startedAt) state.currentRun.startedAt = Date.now();
  const wk = Math.max(0, calendarWeekOfTs(Date.now()));
  state.currentRun.weekIndex = wk;
  state.currentRun.completedDayIndices =
    completedDayIdxsInCalendarWeek(Math.min(wk, state.program.weeks - 1));
}
