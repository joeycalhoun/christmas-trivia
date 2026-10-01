import type { ActivityLevel, Pace, Profile } from './types';
import { round5 } from '../lib/format';

export const ACTIVITY_FACTORS: Record<ActivityLevel, { factor: number; label: string; hint: string }> = {
  sedentary: { factor: 1.2, label: 'Sedentary', hint: 'Desk job, little walking' },
  light: { factor: 1.375, label: 'Lightly active', hint: 'Light exercise 1–3 days/week' },
  moderate: { factor: 1.55, label: 'Moderately active', hint: 'Training 3–5 days/week' },
  active: { factor: 1.725, label: 'Very active', hint: 'Hard training 6–7 days/week' },
  very_active: { factor: 1.9, label: 'Athlete', hint: 'Physical job + daily training' },
};

export const PACES: Record<Pace, { deficit: number; label: string; hint: string }> = {
  gentle: { deficit: 250, label: 'Gentle', hint: '~0.5 lb/week — easiest to sustain' },
  steady: { deficit: 500, label: 'Steady', hint: '~1 lb/week — the sweet spot for most' },
  aggressive: { deficit: 750, label: 'Aggressive', hint: '~1.5 lb/week — harder, more hunger' },
};

export interface Targets {
  bmr: number;
  tdee: number;
  calories: number; // upper bound of the daily "on target" window
  calorieMin: number; // lower bound — eating less than this isn't healthy and doesn't count
  protein: number; // grams
  floor: number;
}

const LB_TO_KG = 0.45359237;
const IN_TO_CM = 2.54;

export function bmr(p: Pick<Profile, 'sex' | 'age' | 'heightIn'>, weightLb: number): number {
  const kg = weightLb * LB_TO_KG;
  const cm = p.heightIn * IN_TO_CM;
  return 10 * kg + 6.25 * cm - 5 * p.age + (p.sex === 'male' ? 5 : -161);
}

/**
 * Daily targets for a given body weight. Calories: Mifflin-St Jeor TDEE minus the chosen deficit,
 * capped at a 25% deficit and never below a safe floor. Protein: ~0.9 g per lb of goal weight,
 * clamped to a sensible band relative to current weight.
 */
export function computeTargets(p: Profile, weightLb: number): Targets {
  const b = bmr(p, weightLb);
  const tdee = b * ACTIVITY_FACTORS[p.activity].factor;
  const floor = p.sex === 'male' ? 1500 : 1200;
  const deficit = Math.min(PACES[p.pace].deficit, tdee * 0.25);
  let calories = round5(Math.max(floor, tdee - deficit));
  if (p.calorieOverride && p.calorieOverride > 0) calories = Math.round(p.calorieOverride);
  const calorieMin = Math.min(calories, round5(Math.max(floor * 0.9, calories * 0.8)));

  const goal = Math.min(p.goalWeight || weightLb, weightLb);
  let protein = round5(Math.min(Math.max(goal * 0.9, weightLb * 0.6), weightLb * 1.0));
  protein = Math.max(protein, 80);
  if (p.proteinOverride && p.proteinOverride > 0) protein = Math.round(p.proteinOverride);

  return { bmr: Math.round(b), tdee: Math.round(tdee), calories, calorieMin, protein, floor };
}

export type CalorieStatus = 'empty' | 'low' | 'on' | 'over';

export function calorieStatus(calories: number, t: Targets): CalorieStatus {
  if (calories <= 0) return 'empty';
  if (calories < t.calorieMin) return 'low';
  if (calories <= t.calories) return 'on';
  return 'over';
}
