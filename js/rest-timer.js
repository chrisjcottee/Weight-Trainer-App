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
