/* ---------- Rest timer ----------
   Self-contained countdown shown between sets during a workout.
   Managed via direct DOM (appended to <body>) so it survives the
   view re-renders triggered by logging/finishing. */

const REST_KEY = 'wt-rest-default';
let restState = { remaining: 0, total: 0, intervalId: null, done: false };

function restDefaultSeconds() {
  const v = parseInt(localStorage.getItem(REST_KEY), 10);
  return (!isNaN(v) && v >= 15) ? v : 120;
}

function setRestDefault(sec) {
  const clamped = Math.max(15, Math.min(600, sec));
  try { localStorage.setItem(REST_KEY, String(clamped)); } catch (_) {}
}

function startRest(seconds) {
  const total = seconds || restDefaultSeconds();
  restState.total = total;
  restState.remaining = total;
  restState.done = false;
  if (restState.intervalId) clearInterval(restState.intervalId);
  restState.intervalId = setInterval(restTick, 1000);
  renderRestBar();
}

function restTick() {
  restState.remaining -= 1;
  if (restState.remaining <= 0) {
    restState.remaining = 0;
    restState.done = true;
    clearInterval(restState.intervalId);
    restState.intervalId = null;
    buzz([60, 80, 60]);
  }
  renderRestBar();
}

function adjustRest(delta) {
  if (!restBarVisible()) return;
  restState.remaining = Math.max(0, restState.remaining + delta);
  restState.total = Math.max(restState.total, restState.remaining, 1);
  if (restState.remaining > 0) {
    restState.done = false;
    if (!restState.intervalId) restState.intervalId = setInterval(restTick, 1000);
    // Remember the user's adjusted length as the new default.
    setRestDefault(restState.remaining);
  }
  renderRestBar();
}

function stopRest() {
  if (restState.intervalId) clearInterval(restState.intervalId);
  restState = { remaining: 0, total: 0, intervalId: null, done: false };
  removeRestBar();
}

/* The rest countdown renders inside the unified workout bar's context slot
   (see workout-bar.js); these are thin delegates so the timer logic above
   didn't have to change. */
function restBarVisible() {
  return !!document.querySelector('#workout-bar .wb-rest');
}

function removeRestBar() {
  if (typeof renderWorkoutBar === 'function') renderWorkoutBar();
}

function renderRestBar() {
  if (typeof renderWorkoutBar === 'function') renderWorkoutBar();
}
