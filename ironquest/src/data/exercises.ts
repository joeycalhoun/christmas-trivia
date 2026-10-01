export type MuscleGroup = 'chest' | 'back' | 'legs' | 'shoulders' | 'arms' | 'core' | 'full';

export interface Exercise {
  id: string;
  name: string;
  group: MuscleGroup;
  /** Bodyweight movements: weight field is *added* load, volume uses a share of bodyweight. */
  bodyweight?: boolean;
  /** Key lift tracked for strength milestones. */
  key?: 'bench' | 'squat' | 'deadlift' | 'ohp';
}

export const EXERCISES: Exercise[] = [
  { id: 'bench', name: 'Barbell Bench Press', group: 'chest', key: 'bench' },
  { id: 'incline_bench', name: 'Incline Barbell Bench', group: 'chest' },
  { id: 'db_bench', name: 'Dumbbell Bench Press', group: 'chest' },
  { id: 'incline_db', name: 'Incline Dumbbell Press', group: 'chest' },
  { id: 'chest_fly', name: 'Cable / Machine Fly', group: 'chest' },
  { id: 'chest_press', name: 'Machine Chest Press', group: 'chest' },
  { id: 'pushup', name: 'Push-up', group: 'chest', bodyweight: true },
  { id: 'dip', name: 'Dip', group: 'chest', bodyweight: true },

  { id: 'deadlift', name: 'Deadlift', group: 'back', key: 'deadlift' },
  { id: 'rdl', name: 'Romanian Deadlift', group: 'legs' },
  { id: 'barbell_row', name: 'Barbell Row', group: 'back' },
  { id: 'db_row', name: 'Dumbbell Row', group: 'back' },
  { id: 'cable_row', name: 'Seated Cable Row', group: 'back' },
  { id: 'lat_pulldown', name: 'Lat Pulldown', group: 'back' },
  { id: 'pullup', name: 'Pull-up / Chin-up', group: 'back', bodyweight: true },
  { id: 'tbar_row', name: 'T-Bar Row', group: 'back' },
  { id: 'face_pull', name: 'Face Pull', group: 'shoulders' },

  { id: 'squat', name: 'Barbell Back Squat', group: 'legs', key: 'squat' },
  { id: 'front_squat', name: 'Front Squat', group: 'legs' },
  { id: 'leg_press', name: 'Leg Press', group: 'legs' },
  { id: 'goblet_squat', name: 'Goblet Squat', group: 'legs' },
  { id: 'lunge', name: 'Lunge / Split Squat', group: 'legs' },
  { id: 'leg_curl', name: 'Leg Curl', group: 'legs' },
  { id: 'leg_ext', name: 'Leg Extension', group: 'legs' },
  { id: 'hip_thrust', name: 'Hip Thrust', group: 'legs' },
  { id: 'calf_raise', name: 'Calf Raise', group: 'legs' },

  { id: 'ohp', name: 'Overhead Press', group: 'shoulders', key: 'ohp' },
  { id: 'db_shoulder', name: 'Dumbbell Shoulder Press', group: 'shoulders' },
  { id: 'lateral_raise', name: 'Lateral Raise', group: 'shoulders' },
  { id: 'rear_delt', name: 'Rear Delt Fly', group: 'shoulders' },
  { id: 'shrug', name: 'Shrug', group: 'back' },

  { id: 'curl', name: 'Barbell / Dumbbell Curl', group: 'arms' },
  { id: 'hammer_curl', name: 'Hammer Curl', group: 'arms' },
  { id: 'tricep_pushdown', name: 'Tricep Pushdown', group: 'arms' },
  { id: 'skullcrusher', name: 'Skullcrusher', group: 'arms' },
  { id: 'cgbp', name: 'Close-Grip Bench', group: 'arms' },

  { id: 'plank', name: 'Plank (reps = seconds)', group: 'core', bodyweight: true },
  { id: 'hanging_leg_raise', name: 'Hanging Leg Raise', group: 'core', bodyweight: true },
  { id: 'cable_crunch', name: 'Cable Crunch', group: 'core' },
  { id: 'ab_wheel', name: 'Ab Wheel', group: 'core', bodyweight: true },

  { id: 'kb_swing', name: 'Kettlebell Swing', group: 'full' },
  { id: 'clean', name: 'Power Clean', group: 'full' },
  { id: 'farmer_carry', name: "Farmer's Carry (reps = steps)", group: 'full' },
  { id: 'burpee', name: 'Burpee', group: 'full', bodyweight: true },
];

export const EXERCISE_BY_ID: Record<string, Exercise> = Object.fromEntries(EXERCISES.map((e) => [e.id, e]));

import type { CustomExercise } from '../game/types';

export function findExercise(id: string, custom: CustomExercise[] = []): Exercise | undefined {
  const own = EXERCISE_BY_ID[id];
  if (own) return own;
  const c = custom.find((x) => x.id === id);
  return c ? { id: c.id, name: c.name, group: 'full', bodyweight: c.bodyweight } : undefined;
}

export function exerciseName(id: string, custom: CustomExercise[] = []): string {
  return findExercise(id, custom)?.name ?? id;
}

export const CARDIO_TYPES = [
  'Walking',
  'Incline treadmill',
  'Running',
  'Cycling',
  'Elliptical',
  'Stair climber',
  'Rowing',
  'Swimming',
  'Hiking',
  'Sports',
  'HIIT',
  'Other',
];
