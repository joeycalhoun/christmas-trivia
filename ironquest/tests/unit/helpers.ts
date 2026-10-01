import { emptyState, type GameState, type Profile } from '../../src/game/types';

export const PROFILE: Profile = {
  heroName: 'Tester',
  heroClass: 'warrior',
  sex: 'male',
  age: 32,
  heightIn: 70,
  startWeight: 220,
  goalWeight: 185,
  activity: 'light',
  pace: 'steady',
  createdAt: '2026-09-28', // a Monday
};

export function freshState(over: Partial<GameState> = {}): GameState {
  return { ...emptyState(), profile: { ...PROFILE }, ...over };
}

let n = 0;
export function food(date: string, calories: number, protein: number, meal: 'breakfast' | 'lunch' | 'dinner' | 'snack' = 'lunch') {
  return { id: `f${n++}`, date, meal, name: 'x', calories, protein, loggedAt: 0 };
}

export function lift(exerciseId: string, sets: [number, number][]) {
  return { id: `e${n++}`, exerciseId, sets: sets.map(([weight, reps]) => ({ weight, reps })) };
}
