import type { GameState, MealSlot, SkillKey } from './types';
import { computeTargets, calorieStatus, type CalorieStatus, type Targets } from './nutrition';
import { findExercise } from '../data/exercises';
import { addDays } from '../lib/dates';

export interface MealTotals {
  calories: number;
  protein: number;
  count: number;
}

export interface DayStats {
  date: string;
  calories: number;
  protein: number;
  entries: number;
  meals: Record<MealSlot, MealTotals>;
  bigProteinEntries: number;
  targets: Targets;
  calorieStatus: CalorieStatus;
  proteinHit: boolean;
  sealed: boolean;
  onTarget: boolean;
  weighIn: number | null;
  measured: boolean;
  steps: number;
  sets: number;
  volume: number;
  strength: boolean;
  cardioMinutes: number;
  prs: number;
  active: boolean;
  logged: boolean;
}

export type KeyLift = 'bench' | 'squat' | 'deadlift' | 'ohp';

export interface PR {
  date: string;
  exerciseId: string;
  weight: number;
  reps: number;
  e1rm: number;
}

export interface Stats {
  day(date: string): DayStats;
  activeDates: string[];
  weightOn(date: string): number;
  latestWeight: number;
  trendWeight: number;
  lowestTrend: number;
  lostLb: number;
  waistStart: number | null;
  waistLatest: number | null;
  waistLost: number;
  totals: {
    loggedDays: number;
    proteinDays: number;
    targetDays: number;
    sealedDays: number;
    workouts: number;
    sets: number;
    cardioMinutes: number;
    volume: number;
    prs: number;
    weighIns: number;
  };
  currentStreak: number;
  bestStreak: number;
  lifts: Record<KeyLift, number>;
  bestE1rm: Record<string, number>;
  prs: PR[];
  skillXp: Record<SkillKey, number>;
}

export const SET_XP_BASE = 10;
export const MIN_STRENGTH_SETS = 3;

export function e1rm(weight: number, reps: number): number {
  if (reps <= 0) return 0;
  return weight * (1 + Math.min(reps, 20) / 30);
}

function emptyMeals(): Record<MealSlot, MealTotals> {
  return {
    breakfast: { calories: 0, protein: 0, count: 0 },
    lunch: { calories: 0, protein: 0, count: 0 },
    dinner: { calories: 0, protein: 0, count: 0 },
    snack: { calories: 0, protein: 0, count: 0 },
  };
}

/** Derive every number the game runs on from the raw logs. Pure; safe to recompute on every change. */
export function computeStats(state: GameState, today: string): Stats {
  const profile = state.profile!;

  // --- Body weight timeline
  const weighIns = [...state.weighIns].sort((a, b) => a.date.localeCompare(b.date));
  const weighByDate = new Map(weighIns.map((w) => [w.date, w.weight]));
  const weightOn = (date: string): number => {
    let w = profile.startWeight;
    for (const wi of weighIns) {
      if (wi.date > date) break;
      w = wi.weight;
    }
    return w;
  };
  const latestWeight = weighIns.length ? weighIns[weighIns.length - 1].weight : profile.startWeight;
  // A rolling average of the last 7 weigh-ins smooths out water-weight noise.
  let lowestTrend = profile.startWeight;
  let trendWeight = profile.startWeight;
  for (let i = 0; i < weighIns.length; i++) {
    const win = weighIns.slice(Math.max(0, i - 6), i + 1);
    const avg = win.reduce((s, w) => s + w.weight, 0) / win.length;
    trendWeight = avg;
    if (avg < lowestTrend) lowestTrend = avg;
  }
  const lostLb = Math.max(0, profile.startWeight - lowestTrend);

  // --- Waist: first measurement vs. the best 3-measurement average since.
  const waists = [...(state.measurements ?? [])].sort((a, b) => a.date.localeCompare(b.date));
  const waistStart = waists.length ? waists[0].waist : null;
  const waistLatest = waists.length ? waists[waists.length - 1].waist : null;
  let waistLost = 0;
  for (let i = 1; i < waists.length; i++) {
    const win = waists.slice(Math.max(1, i - 2), i + 1);
    const avg = win.reduce((s, w) => s + w.waist, 0) / win.length;
    waistLost = Math.max(waistLost, waistStart! - avg);
  }

  const waistDates = new Set(waists.map((m) => m.date));

  const targetCache = new Map<number, Targets>();
  const targetsFor = (date: string) => {
    const w = weightOn(date);
    let t = targetCache.get(w);
    if (!t) {
      t = computeTargets(profile, w);
      targetCache.set(w, t);
    }
    return t;
  };

  // --- Food
  const foodByDate = new Map<string, { calories: number; protein: number; entries: number; meals: Record<MealSlot, MealTotals>; big: number }>();
  for (const f of state.foods) {
    let d = foodByDate.get(f.date);
    if (!d) {
      d = { calories: 0, protein: 0, entries: 0, meals: emptyMeals(), big: 0 };
      foodByDate.set(f.date, d);
    }
    d.calories += f.calories;
    d.protein += f.protein;
    d.entries++;
    d.meals[f.meal].calories += f.calories;
    d.meals[f.meal].protein += f.protein;
    d.meals[f.meal].count++;
    if (f.protein >= 25) d.big++;
  }

  // --- Training (chronological so PRs compare only against the past)
  const sessionDates = Object.keys(state.sessions).sort();
  const bestE1rm: Record<string, number> = {};
  const lifts: Record<KeyLift, number> = { bench: 0, squat: 0, deadlift: 0, ohp: 0 };
  const prs: PR[] = [];
  const trainByDate = new Map<string, { sets: number; volume: number; cardio: number; prs: number; ironXp: number }>();
  for (const date of sessionDates) {
    const s = state.sessions[date];
    const bw = weightOn(date);
    let sets = 0;
    let volume = 0;
    let ironXp = 0;
    let prCount = 0;
    for (const ex of s.exercises) {
      const def = findExercise(ex.exerciseId, state.customExercises);
      let sessionBest = 0;
      let bestSet: { weight: number; reps: number } | null = null;
      for (const set of ex.sets) {
        if (!(set.reps > 0)) continue;
        const w = Math.max(0, set.weight || 0);
        const effective = def?.bodyweight ? w + bw * 0.6 : w;
        const vol = effective * set.reps;
        sets++;
        volume += vol;
        ironXp += SET_XP_BASE + Math.min(20, vol / 100);
        const metric = def?.bodyweight ? e1rm(w + 100, set.reps) : e1rm(w, set.reps);
        if (metric > sessionBest) {
          sessionBest = metric;
          bestSet = { weight: w, reps: set.reps };
        }
        if (def?.key && w > lifts[def.key]) lifts[def.key] = w;
      }
      if (bestSet) {
        const prev = bestE1rm[ex.exerciseId];
        if (prev !== undefined && sessionBest > prev + 0.01) {
          prCount++;
          prs.push({ date, exerciseId: ex.exerciseId, weight: bestSet.weight, reps: bestSet.reps, e1rm: sessionBest });
        }
        if (prev === undefined || sessionBest > prev) bestE1rm[ex.exerciseId] = sessionBest;
      }
    }
    const cardio = s.cardio.reduce((sum, c) => sum + Math.max(0, c.minutes || 0), 0);
    if (sets >= MIN_STRENGTH_SETS) ironXp += 50;
    ironXp += prCount * 75;
    trainByDate.set(date, { sets, volume, cardio, prs: prCount, ironXp });
  }

  const dayCache = new Map<string, DayStats>();
  const day = (date: string): DayStats => {
    const cached = dayCache.get(date);
    if (cached) return cached;
    const f = foodByDate.get(date);
    const t = trainByDate.get(date);
    const targets = targetsFor(date);
    const calories = Math.round(f?.calories ?? 0);
    const protein = Math.round(f?.protein ?? 0);
    const status = calorieStatus(calories, targets);
    const sealed = !!state.sealed[date];
    const steps = state.steps[date] ?? 0;
    const sets = t?.sets ?? 0;
    const cardioMinutes = t?.cardio ?? 0;
    const strength = sets >= MIN_STRENGTH_SETS;
    const d: DayStats = {
      date,
      calories,
      protein,
      entries: f?.entries ?? 0,
      meals: f?.meals ?? emptyMeals(),
      bigProteinEntries: f?.big ?? 0,
      targets,
      calorieStatus: status,
      proteinHit: protein >= targets.protein,
      sealed,
      onTarget: sealed && status === 'on',
      weighIn: weighByDate.get(date) ?? null,
      measured: waistDates.has(date),
      steps,
      sets,
      volume: Math.round(t?.volume ?? 0),
      strength,
      cardioMinutes,
      prs: t?.prs ?? 0,
      active: strength || cardioMinutes >= 20 || steps >= 7000,
      logged: (f?.entries ?? 0) > 0,
    };
    dayCache.set(date, d);
    return d;
  };

  const dateSet = new Set<string>([
    ...foodByDate.keys(),
    ...trainByDate.keys(),
    ...weighByDate.keys(),
    ...waistDates,
    ...Object.keys(state.steps),
    ...Object.keys(state.sealed),
  ]);
  const activeDates = [...dateSet].sort();

  const totals = {
    loggedDays: 0,
    proteinDays: 0,
    targetDays: 0,
    sealedDays: 0,
    workouts: 0,
    sets: 0,
    cardioMinutes: 0,
    volume: 0,
    prs: prs.length,
    weighIns: weighIns.length,
  };
  const skillXp: Record<SkillKey, number> = { iron: 0, endurance: 0, provision: 0, discipline: 0 };

  for (const date of activeDates) {
    const d = day(date);
    if (d.logged) totals.loggedDays++;
    if (d.proteinHit) totals.proteinDays++;
    if (d.onTarget) totals.targetDays++;
    if (d.sealed) totals.sealedDays++;
    if (d.strength) totals.workouts++;
    totals.sets += d.sets;
    totals.cardioMinutes += d.cardioMinutes;
    totals.volume += d.volume;

    skillXp.iron += trainByDate.get(date)?.ironXp ?? 0;
    skillXp.endurance += Math.min(d.cardioMinutes, 120) * 5 + Math.floor(Math.min(d.steps, 25_000) / 200);
    skillXp.provision += Math.min(d.protein, d.targets.protein * 1.25) + (d.proteinHit ? 50 : 0);
    if (d.entries >= 1) skillXp.discipline += 10;
    if (d.entries >= 3) skillXp.discipline += 15;
    if (d.sealed && d.logged) skillXp.discipline += 40;
    if (d.onTarget) skillXp.discipline += 110;
    if (d.weighIn !== null) skillXp.discipline += 20;
    if (d.measured) skillXp.discipline += 15;
  }
  for (const k of Object.keys(skillXp) as SkillKey[]) skillXp[k] = Math.round(skillXp[k]);

  // --- Logging streaks
  const loggedSet = new Set([...foodByDate.keys()]);
  let bestStreak = 0;
  let run = 0;
  let prev: string | null = null;
  for (const date of [...loggedSet].sort()) {
    run = prev && addDays(prev, 1) === date ? run + 1 : 1;
    bestStreak = Math.max(bestStreak, run);
    prev = date;
  }
  let currentStreak = 0;
  let cursor = loggedSet.has(today) ? today : addDays(today, -1);
  while (loggedSet.has(cursor)) {
    currentStreak++;
    cursor = addDays(cursor, -1);
  }

  return {
    day,
    activeDates,
    weightOn,
    latestWeight,
    trendWeight,
    lowestTrend,
    lostLb,
    waistStart,
    waistLatest,
    waistLost,
    totals,
    currentStreak,
    bestStreak,
    lifts,
    bestE1rm,
    prs,
    skillXp,
  };
}
