'use strict';

/* ---------- State ---------- */
const APP_VERSION = 'v26';

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

/* Prebuilt program templates. Read-only catalog: selecting one clones an
   editable copy into the user's library, leaving these pristine. */
const mkEx = (name, sets, reps) => ({ name, sets, reps });
const PREBUILT_PROGRAMS = [
  {
    id: 'prebuilt-beginner-full-body',
    name: 'Beginner Full Body',
    description: '3 days/week · full-body basics to build a foundation',
    weeks: 8,
    template: [
      { name: 'Full Body A', exercises: [
        mkEx('Goblet Squat', 3, 10), mkEx('Dumbbell Bench Press', 3, 10),
        mkEx('Seated Cable Row', 3, 10), mkEx('Dumbbell Shoulder Press', 3, 10),
        mkEx('Plank', 3, 30)
      ]},
      { name: 'Full Body B', exercises: [
        mkEx('Leg Press', 3, 12), mkEx('Lat Pulldown', 3, 10),
        mkEx('Incline Dumbbell Press', 3, 10), mkEx('Romanian Deadlift', 3, 10),
        mkEx('Sit-Up', 3, 15)
      ]},
      { name: 'Full Body C', exercises: [
        mkEx('Back Squat', 3, 8), mkEx('Bench Press', 3, 8),
        mkEx('Bent-Over Row', 3, 8), mkEx('Lateral Raise', 3, 12),
        mkEx('Crunch', 3, 15)
      ]}
    ]
  },
  {
    id: 'prebuilt-full-body-3day',
    name: 'Full Body 3-Day',
    description: '3 days/week · compound-focused, A/B/C rotation',
    weeks: 8,
    template: [
      { name: 'Full Body A', exercises: [
        mkEx('Back Squat', 3, 8), mkEx('Bench Press', 3, 8),
        mkEx('Bent-Over Row', 3, 8), mkEx('Overhead Press', 3, 10),
        mkEx('Plank', 3, 45)
      ]},
      { name: 'Full Body B', exercises: [
        mkEx('Deadlift', 3, 5), mkEx('Incline Bench Press', 3, 8),
        mkEx('Lat Pulldown', 3, 10), mkEx('Dumbbell Shoulder Press', 3, 10),
        mkEx('Hanging Leg Raise', 3, 12)
      ]},
      { name: 'Full Body C', exercises: [
        mkEx('Front Squat', 3, 8), mkEx('Dumbbell Bench Press', 3, 10),
        mkEx('Seated Cable Row', 3, 10), mkEx('Lateral Raise', 3, 12),
        mkEx('Cable Crunch', 3, 15)
      ]}
    ]
  },
  {
    id: 'prebuilt-upper-lower-4day',
    name: 'Upper/Lower 4-Day',
    description: '4 days/week · upper and lower split, two sessions each',
    weeks: 8,
    template: [
      { name: 'Upper A', exercises: [
        mkEx('Bench Press', 4, 6), mkEx('Bent-Over Row', 4, 6),
        mkEx('Overhead Press', 3, 8), mkEx('Lat Pulldown', 3, 10),
        mkEx('Barbell Curl', 3, 10), mkEx('Tricep Pushdown', 3, 12)
      ]},
      { name: 'Lower A', exercises: [
        mkEx('Back Squat', 4, 6), mkEx('Romanian Deadlift', 3, 8),
        mkEx('Leg Press', 3, 10), mkEx('Leg Curl', 3, 12),
        mkEx('Standing Calf Raise', 4, 12)
      ]},
      { name: 'Upper B', exercises: [
        mkEx('Incline Bench Press', 4, 8), mkEx('Pull-Up', 4, 8),
        mkEx('Dumbbell Shoulder Press', 3, 10), mkEx('Seated Cable Row', 3, 10),
        mkEx('Hammer Curl', 3, 12), mkEx('Skull Crusher', 3, 12)
      ]},
      { name: 'Lower B', exercises: [
        mkEx('Deadlift', 4, 5), mkEx('Front Squat', 3, 8),
        mkEx('Bulgarian Split Squat', 3, 10), mkEx('Leg Extension', 3, 12),
        mkEx('Seated Calf Raise', 4, 15)
      ]}
    ]
  },
  {
    id: 'prebuilt-ppl-6day',
    name: 'Push/Pull/Legs 6-Day',
    description: '6 days/week · high-volume push, pull and legs rotation',
    weeks: 8,
    template: [
      { name: 'Push A', exercises: [
        mkEx('Bench Press', 4, 6), mkEx('Overhead Press', 3, 8),
        mkEx('Incline Dumbbell Press', 3, 10), mkEx('Lateral Raise', 3, 15),
        mkEx('Tricep Pushdown', 3, 12), mkEx('Overhead Tricep Extension', 3, 12)
      ]},
      { name: 'Pull A', exercises: [
        mkEx('Deadlift', 3, 5), mkEx('Pull-Up', 4, 8),
        mkEx('Bent-Over Row', 4, 8), mkEx('Face Pull', 3, 15),
        mkEx('Barbell Curl', 3, 10), mkEx('Hammer Curl', 3, 12)
      ]},
      { name: 'Legs A', exercises: [
        mkEx('Back Squat', 4, 6), mkEx('Romanian Deadlift', 3, 8),
        mkEx('Leg Press', 3, 12), mkEx('Leg Curl', 3, 12),
        mkEx('Standing Calf Raise', 4, 15)
      ]},
      { name: 'Push B', exercises: [
        mkEx('Incline Bench Press', 4, 8), mkEx('Dumbbell Shoulder Press', 3, 10),
        mkEx('Cable Fly', 3, 12), mkEx('Cable Lateral Raise', 3, 15),
        mkEx('Close-Grip Bench Press', 3, 10), mkEx('Tricep Pushdown', 3, 15)
      ]},
      { name: 'Pull B', exercises: [
        mkEx('Pendlay Row', 4, 6), mkEx('Lat Pulldown', 3, 10),
        mkEx('Chest-Supported Row', 3, 10), mkEx('Rear Delt Fly', 3, 15),
        mkEx('Preacher Curl', 3, 12), mkEx('Cable Curl', 3, 15)
      ]},
      { name: 'Legs B', exercises: [
        mkEx('Front Squat', 4, 8), mkEx('Bulgarian Split Squat', 3, 10),
        mkEx('Leg Extension', 3, 15), mkEx('Leg Curl', 3, 15),
        mkEx('Seated Calf Raise', 4, 20), mkEx('Hanging Leg Raise', 3, 12)
      ]}
    ]
  }
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
