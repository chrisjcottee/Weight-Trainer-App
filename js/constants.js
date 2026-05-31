'use strict';

/* ---------- State ---------- */
const APP_VERSION = 'v20 · inline dense';

const EXERCISE_LIBRARY = [
  // Squat / quad
  'Back Squat', 'Front Squat', 'Goblet Squat', 'Hack Squat', 'Bulgarian Split Squat',
  'Leg Press', 'Lunge', 'Walking Lunge', 'Step-Up', 'Leg Extension',
  // Hinge / posterior chain
  'Deadlift', 'Romanian Deadlift', 'Sumo Deadlift', 'Stiff-Leg Deadlift',
  'Hip Thrust', 'Glute Bridge', 'Good Morning', 'Leg Curl', 'Kettlebell Swing',
  // Calves
  'Standing Calf Raise', 'Seated Calf Raise',
  // Push horizontal
  'Bench Press', 'Incline Bench Press', 'Decline Bench Press', 'Close-Grip Bench Press',
  'Dumbbell Bench Press', 'Incline Dumbbell Press', 'Dumbbell Fly', 'Cable Fly',
  'Dumbbell Pullover', 'Push-Up', 'Diamond Push-Up', 'Dip',
  // Pull horizontal
  'Bent-Over Row', 'Pendlay Row', 'T-Bar Row', 'Seated Cable Row', 'Dumbbell Row',
  'Inverted Row', 'Chest-Supported Row', 'Face Pull',
  // Pull vertical
  'Pull-Up', 'Chin-Up', 'Lat Pulldown', 'Straight-Arm Pulldown',
  // Shoulders
  'Overhead Press', 'Dumbbell Shoulder Press', 'Arnold Press', 'Push Press',
  'Lateral Raise', 'Cable Lateral Raise', 'Front Raise', 'Rear Delt Fly',
  'Upright Row', 'Shrug',
  // Biceps
  'Barbell Curl', 'EZ-Bar Curl', 'Dumbbell Curl', 'Hammer Curl',
  'Preacher Curl', 'Cable Curl', 'Concentration Curl', 'Incline Dumbbell Curl',
  // Triceps
  'Tricep Pushdown', 'Skull Crusher', 'Overhead Tricep Extension',
  'Tricep Dip', 'Tricep Kickback', 'Cable Overhead Extension',
  // Core
  'Plank', 'Side Plank', 'Hanging Leg Raise', 'Cable Crunch', 'Russian Twist',
  'Ab Wheel Rollout', 'Sit-Up', 'Crunch', 'Mountain Climber', 'Pallof Press',
  // Olympic / total body
  'Power Clean', 'Clean and Press', 'Snatch', 'Farmer’s Walk', 'Turkish Get-Up'
];
const STORAGE_KEY = 'wt-state-v2';
let saveErrorShown = false;
const DEFAULT_STATE = {
  program: null,        // { name, weeks: 8, template: [{ name, exercises: [{ name, sets, reps }] }] }
  programLibrary: [],   // [{ id, name, weeks, template, archived, createdAt, updatedAt }]
  activeProgramId: null,
  sessions: [],         // [{ date, weekIndex, dayIndex, dayName, durationMs, exercises: [{ name, sets: [{ weight, reps, ts }], skipped }] }]
  exerciseLibrary: makeInitialExerciseLibrary(),
  active: null,         // { weekIndex, dayIndex, dayName, startedAt, exercises: [...] }
  stats: { xp: 0, streak: 0, lastDayCompleteDate: null },
  currentRun: { startedAt: null, weekIndex: 0, completedDayIndices: [] },
  tab: 'today',
  celebration: null     // { type: 'workout', dayName, weekIndex, setCount, volume, xpEarned, leveledUp, fullyComplete, weekComplete, programComplete }
};

function slugifyExerciseName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'exercise';
}

function makeExerciseLibraryEntry(name, builtIn = false) {
  const clean = String(name || '').trim();
  return {
    id: builtIn ? `builtin-${slugifyExerciseName(clean)}` : `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: clean,
    builtIn,
    archived: false
  };
}

function makeInitialExerciseLibrary() {
  return EXERCISE_LIBRARY.map(name => makeExerciseLibraryEntry(name, true));
}

function makeProgramId(name) {
  return `program-${slugifyExerciseName(name)}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function makeProgramRecord(program, existing = {}) {
  const now = Date.now();
  return {
    id: existing.id || makeProgramId(program.name),
    name: String(program.name || '').trim() || 'My Program',
    weeks: Math.max(1, parseInt(program.weeks, 10) || 1),
    template: structuredClone(program.template || []),
    archived: !!existing.archived,
    createdAt: existing.createdAt || now,
    updatedAt: now
  };
}
