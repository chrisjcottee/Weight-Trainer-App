# Weight Training Tracker

`weight-tracker/` contains a single-page PWA for following a structured weight-training program.

- **Build your program** once: add workouts (Push, Pull, Legs, …) with exercises, target sets, reps, and weight.
- **Today** shows the next scheduled workout with a single *Start Workout* button.
- During a workout, each set is one row: enter weight & reps → tap ✓ → next set is focused. Previous session values are shown as a one-tap "copy" chip.
- Exercises auto-mark complete when all sets are logged; the workout auto-completes when all exercises are done; the program completes when every workout is done.
- **Gamification**: XP per set/exercise/workout/program, level (Lv ⌊√(XP/100)⌋), and a streak that counts consecutive completed workout days.
- **History** tab keeps every workout. **Program** tab lets you view or edit the plan.
- Data is stored in browser `localStorage`. Works offline once installed (service worker caches the app shell).

### Run locally

Open `weight-tracker/index.html` in any browser.

### Code layout

- `index.html` contains the app shell, tab bar, stylesheet link, and script loading order.
- `styles.css` contains the app styling.
- `js/` contains the no-build JavaScript modules, grouped by state, helpers, program/workout logic, events, and views.

### Install on your phone

1. Enable GitHub Pages: repo **Settings → Pages →** *Deploy from a branch* → **master**, **/(root)**.
2. Visit `https://<your-user>.github.io/java-course/weight-tracker/` on your phone.
3. **iOS Safari:** Share → *Add to Home Screen*. **Android Chrome:** menu → *Install app* (or *Add to Home Screen*).
4. Launch from the home screen icon — runs full-screen, works offline.
