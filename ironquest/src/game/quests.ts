import type { DayStats } from './stats';
import type { PackType } from './types';
import { hashString } from '../lib/rng';
import { fmt } from '../lib/format';

export type QuestCategory = 'protein' | 'discipline' | 'training' | 'general';

export interface QuestProgress {
  progress: number;
  goal: number;
  done: boolean;
  label: string;
}

export interface QuestDef<T> {
  key: string;
  title: string;
  icon: string;
  category: QuestCategory;
  xp: number;
  coins: number;
  packs?: PackType[];
  /** Requires the day to be sealed (all food logged) before it can complete. */
  needsSeal?: boolean;
  desc: (ctx: T) => string;
  eval: (ctx: T) => QuestProgress;
}

const count = (n: number, goal: number, unit = ''): QuestProgress => ({
  progress: Math.min(n, goal),
  goal,
  done: n >= goal,
  label: `${fmt(Math.min(n, goal))} / ${fmt(goal)}${unit}`,
});

// ---------------------------------------------------------------- Daily

export const CORE_DAILIES: QuestDef<DayStats>[] = [
  {
    key: 'protein',
    title: 'Protein Pact',
    icon: '🥩',
    category: 'protein',
    xp: 60,
    coins: 60,
    desc: (d) => `Eat at least ${d.targets.protein} g of protein.`,
    eval: (d) => count(d.protein, d.targets.protein, ' g'),
  },
  {
    key: 'calories',
    title: 'Hold the Line',
    icon: '🛡️',
    category: 'discipline',
    xp: 80,
    coins: 80,
    needsSeal: true,
    desc: (d) => `Finish the day between ${fmt(d.targets.calorieMin)}–${fmt(d.targets.calories)} kcal, then seal it.`,
    eval: (d) => ({
      progress: d.onTarget ? 1 : 0,
      goal: 1,
      done: d.onTarget,
      label:
        d.calorieStatus === 'over'
          ? `${fmt(d.calories)} kcal — ${fmt(d.calories - d.targets.calories)} over`
          : d.calorieStatus === 'low'
            ? `${fmt(d.calories)} kcal — below the healthy minimum`
            : d.calorieStatus === 'empty'
              ? 'Nothing logged yet'
              : `${fmt(d.calories)} kcal — in the zone${d.sealed ? '' : ' (seal to lock in)'}`,
    }),
  },
  {
    key: 'log3',
    title: "Scribe's Duty",
    icon: '📜',
    category: 'discipline',
    xp: 30,
    coins: 30,
    desc: () => 'Log 3 or more foods today.',
    eval: (d) => count(d.entries, 3),
  },
  {
    key: 'active',
    title: 'Answer the Call',
    icon: '⚔️',
    category: 'training',
    xp: 50,
    coins: 50,
    desc: () => 'Lift (3+ sets), do 20+ min of cardio, or walk 7,000+ steps.',
    eval: (d) => {
      const best = Math.max(d.sets / 3, d.cardioMinutes / 20, d.steps / 7000);
      return {
        progress: Math.min(1, best),
        goal: 1,
        done: d.active,
        label: d.active
          ? 'Complete'
          : `${d.sets} sets · ${d.cardioMinutes} min cardio · ${fmt(d.steps)} steps`,
      };
    },
  },
];

export const BONUS_DAILIES: QuestDef<DayStats>[] = [
  {
    key: 'early_fuel',
    title: 'Early Fuel',
    icon: '🍳',
    category: 'protein',
    xp: 70,
    coins: 80,
    desc: () => 'Get 30 g+ of protein at breakfast.',
    eval: (d) => count(d.meals.breakfast.protein, 30, ' g'),
  },
  {
    key: 'iron_rations',
    title: 'Iron Rations',
    icon: '🍗',
    category: 'protein',
    xp: 70,
    coins: 80,
    desc: () => 'Log 3 separate foods with 25 g+ protein each.',
    eval: (d) => count(d.bigProteinEntries, 3),
  },
  {
    key: 'weigh',
    title: 'Face the Scale',
    icon: '⚖️',
    category: 'discipline',
    xp: 70,
    coins: 80,
    desc: () => 'Log your body weight today.',
    eval: (d) => count(d.weighIn !== null ? 1 : 0, 1),
  },
  {
    key: 'wanderer',
    title: 'The Wanderer',
    icon: '🚶',
    category: 'training',
    xp: 70,
    coins: 80,
    desc: () => 'Walk 8,000 steps.',
    eval: (d) => count(d.steps, 8000),
  },
  {
    key: 'endurance',
    title: 'Trial of Endurance',
    icon: '🫀',
    category: 'training',
    xp: 70,
    coins: 80,
    desc: () => 'Do 30 minutes of cardio.',
    eval: (d) => count(d.cardioMinutes, 30, ' min'),
  },
  {
    key: 'heavy',
    title: 'Heavy Lifting',
    icon: '🏋️',
    category: 'training',
    xp: 70,
    coins: 80,
    desc: () => 'Log 12 working sets.',
    eval: (d) => count(d.sets, 12),
  },
  {
    key: 'precision',
    title: 'Precision Strike',
    icon: '🎯',
    category: 'discipline',
    xp: 70,
    coins: 80,
    needsSeal: true,
    desc: (d) => `Seal the day within 150 kcal under your target (${fmt(d.targets.calories - 150)}–${fmt(d.targets.calories)}).`,
    eval: (d) => {
      const ok = d.sealed && d.calories <= d.targets.calories && d.calories >= d.targets.calories - 150 && d.calorieStatus === 'on';
      return { progress: ok ? 1 : 0, goal: 1, done: ok, label: `${fmt(d.calories)} kcal` };
    },
  },
  {
    key: 'full_ledger',
    title: 'Full Ledger',
    icon: '📖',
    category: 'discipline',
    xp: 70,
    coins: 80,
    desc: () => 'Log breakfast, lunch, and dinner.',
    eval: (d) => count(['breakfast', 'lunch', 'dinner'].filter((m) => d.meals[m as 'lunch'].count > 0).length, 3),
  },
];

export const DAILY_SWEEP = { key: 'sweep', title: 'Daily Sweep', icon: '🌟', xp: 100, coins: 200, packs: [] as PackType[] };

export function bonusDailyFor(date: string): QuestDef<DayStats> {
  return BONUS_DAILIES[hashString(`bonus:${date}`) % BONUS_DAILIES.length];
}

export function dailiesFor(date: string): QuestDef<DayStats>[] {
  return [...CORE_DAILIES, bonusDailyFor(date)];
}

// ---------------------------------------------------------------- Weekly

export interface WeekCtx {
  days: DayStats[]; // Mon..Sun
}

const sumDays = (w: WeekCtx, f: (d: DayStats) => boolean) => w.days.filter(f).length;

export const WEEKLIES: QuestDef<WeekCtx>[] = [
  {
    key: 'protein5',
    title: 'Protein Pilgrimage',
    icon: '🥩',
    category: 'protein',
    xp: 300,
    coins: 400,
    packs: ['silver'],
    desc: () => 'Hit your protein target on 5 days this week.',
    eval: (w) => count(sumDays(w, (d) => d.proteinHit), 5, ' days'),
  },
  {
    key: 'target5',
    title: 'Wall of Discipline',
    icon: '🛡️',
    category: 'discipline',
    xp: 300,
    coins: 400,
    packs: ['silver'],
    desc: () => 'Seal 5 days inside your calorie window.',
    eval: (w) => count(sumDays(w, (d) => d.onTarget), 5, ' days'),
  },
  {
    key: 'lift3',
    title: 'Three Iron Rites',
    icon: '🏋️',
    category: 'training',
    xp: 250,
    coins: 350,
    desc: () => 'Complete 3 strength sessions (3+ sets each).',
    eval: (w) => count(sumDays(w, (d) => d.strength), 3, ' sessions'),
  },
  {
    key: 'cardio90',
    title: 'Long Road',
    icon: '🫀',
    category: 'training',
    xp: 200,
    coins: 300,
    desc: () => 'Accumulate 90 minutes of cardio.',
    eval: (w) => count(w.days.reduce((s, d) => s + d.cardioMinutes, 0), 90, ' min'),
  },
  {
    key: 'log7',
    title: 'Unbroken Ledger',
    icon: '📜',
    category: 'discipline',
    xp: 200,
    coins: 300,
    desc: () => 'Log food every day this week.',
    eval: (w) => count(sumDays(w, (d) => d.logged), 7, ' days'),
  },
  {
    key: 'weigh3',
    title: 'Know Thyself',
    icon: '⚖️',
    category: 'discipline',
    xp: 100,
    coins: 150,
    desc: () => 'Weigh in on 3 different days.',
    eval: (w) => count(sumDays(w, (d) => d.weighIn !== null), 3, ' days'),
  },
];

export const WEEKLY_SWEEP = { key: 'sweep', title: 'Weekly Conqueror', icon: '👑', xp: 400, coins: 500, packs: ['gold'] as PackType[] };
