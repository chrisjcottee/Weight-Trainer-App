/* ---------- Rest timer ----------
   Self-contained countdown shown between sets during a workout.
   Managed via direct DOM (appended to <body>) so it survives the
   view re-renders triggered by logging/finishing. */

const REST_KEY = 'wt-rest-default';
const REST_LIVE_KEY = 'wt-rest-live';
let restState = { remaining: 0, total: 0, endAt: 0, intervalId: null, done: false };

/* Persist the running countdown so a reload / app relaunch mid-rest can
   resume it (see resumeRestFromStorage, called on boot). */
function persistRestLive() {
  try { localStorage.setItem(REST_LIVE_KEY, JSON.stringify({ endAt: restState.endAt, total: restState.total })); } catch (_) {}
}
function clearRestLive() {
  try { localStorage.removeItem(REST_LIVE_KEY); } catch (_) {}
}

function restDefaultSeconds() {
  const v = parseInt(localStorage.getItem(REST_KEY), 10);
  return (!isNaN(v) && v >= 15) ? v : 120;
}

function setRestDefault(sec) {
  const clamped = Math.max(15, Math.min(600, sec));
  try { localStorage.setItem(REST_KEY, String(clamped)); } catch (_) {}
}

function restTimeLabel(sec) {
  return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
}

function startRest(seconds) {
  const total = seconds || restDefaultSeconds();
  restState.total = total;
  restState.remaining = total;
  restState.endAt = Date.now() + total * 1000;
  restState.done = false;
  if (restState.intervalId) clearInterval(restState.intervalId);
  restState.intervalId = setInterval(restTick, 1000);
  persistRestLive();
  renderRestBar();
}

/* Remaining time is derived from an absolute end timestamp rather than
   counted down per tick, so the timer stays accurate even when the
   browser throttles/suspends intervals (screen locked, tab in
   background). */
function restRemainingSeconds() {
  return Math.max(0, Math.ceil((restState.endAt - Date.now()) / 1000));
}

function restTick() {
  restState.remaining = restRemainingSeconds();
  if (restState.remaining <= 0 && !restState.done) {
    restState.done = true;
    clearInterval(restState.intervalId);
    restState.intervalId = null;
    clearRestLive(); // a finished timer must not resurrect on reload
    buzz([60, 80, 60]);
  }
  renderRestBar();
}

function adjustRest(delta) {
  if (!restBarVisible()) return;
  restState.remaining = Math.max(0, restRemainingSeconds() + delta);
  restState.endAt = Date.now() + restState.remaining * 1000;
  restState.total = Math.max(restState.total, restState.remaining, 1);
  if (restState.remaining > 0) {
    restState.done = false;
    if (!restState.intervalId) restState.intervalId = setInterval(restTick, 1000);
    // Remember the user's adjusted length as the new default.
    setRestDefault(restState.remaining);
    persistRestLive();
  }
  renderRestBar();
}

function stopRest() {
  if (restState.intervalId) clearInterval(restState.intervalId);
  restState = { remaining: 0, total: 0, endAt: 0, intervalId: null, done: false };
  clearRestLive();
  removeRestBar();
}

/* On boot, restore a countdown that was running when the app was last
   closed — but only if a workout is still active and the rest hasn't
   already elapsed. Otherwise clear the stale key. */
function resumeRestFromStorage() {
  if (!state.active) { clearRestLive(); return; }
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(REST_LIVE_KEY)); } catch (_) {}
  if (!saved || !saved.endAt || saved.endAt <= Date.now()) { clearRestLive(); return; }
  restState.endAt = saved.endAt;
  restState.total = saved.total || restDefaultSeconds();
  restState.remaining = restRemainingSeconds();
  restState.done = false;
  if (restState.intervalId) clearInterval(restState.intervalId);
  restState.intervalId = setInterval(restTick, 1000);
  renderRestBar();
}

/* Re-sync the moment the app becomes visible again so the bar updates
   instantly instead of waiting for the next (possibly throttled) tick. */
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && restBarVisible() && !restState.done) restTick();
});

function restBarVisible() {
  return !!document.getElementById('rest-bar');
}

function removeRestBar() {
  const bar = document.getElementById('rest-bar');
  if (bar) bar.remove();
}

function renderRestBar() {
  let bar = document.getElementById('rest-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'rest-bar';
    document.body.appendChild(bar);
  }
  const pct = restState.total ? Math.max(0, restState.remaining / restState.total) * 100 : 0;
  const mm = Math.floor(restState.remaining / 60);
  const ss = String(restState.remaining % 60).padStart(2, '0');
  bar.className = restState.done ? 'rest-bar done' : 'rest-bar';
  bar.innerHTML = `
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
  `;
}
