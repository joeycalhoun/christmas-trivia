import type { DayStats } from './stats';
import { addDays, weekDays, weekStart } from '../lib/dates';

export interface Boss {
  name: string;
  icon: string;
  taunt: string;
}

export const BOSSES: Boss[] = [
  { name: 'Lord Lethargy, the Couch Tyrant', icon: '🛋️', taunt: 'Sit. Stay. Forever.' },
  { name: 'The Snack Goblin King', icon: '👺', taunt: 'Just one more handful…' },
  { name: 'Sugarfang the Wyrm', icon: '🐉', taunt: 'Your cravings feed me.' },
  { name: 'The Midnight Muncher', icon: '🌙', taunt: 'The fridge light calls to you.' },
  { name: 'The Grease Golem', icon: '🍟', taunt: 'Supersize your doom.' },
  { name: 'Procrastinus, Lich of Tomorrow', icon: '💀', taunt: 'Start Monday. Always Monday.' },
  { name: 'The Soda Kraken', icon: '🐙', taunt: 'Drown in 39 grams of sugar.' },
  { name: 'Baron Von Buffet', icon: '🍽️', taunt: 'All you can eat. All you will eat.' },
  { name: 'The Sloth Titan', icon: '🦥', taunt: 'Why walk when you can scroll?' },
  { name: 'The Excuse Hydra', icon: '🐍', taunt: 'Cut one excuse, two grow back.' },
  { name: 'The Cheat-Day Chimera', icon: '🦁', taunt: 'One cheat day becomes a cheat week.' },
  { name: 'The Doomscroll Specter', icon: '👻', taunt: 'Your workout can wait. Look at this video.' },
];

export const RAID_BASE_HP = 10_000;

export const DAMAGE_RULES = [
  { key: 'protein', label: 'Protein target hit', per: 1000 },
  { key: 'target', label: 'Day sealed on target', per: 1200 },
  { key: 'sealed', label: 'Day sealed (honest ledger)', per: 200 },
  { key: 'strength', label: 'Strength session', per: 600 },
  { key: 'sets', label: 'Working sets', per: 25 },
  { key: 'cardio', label: 'Cardio minutes', per: 15 },
  { key: 'steps', label: 'Steps (per 1k)', per: 50 },
  { key: 'weigh', label: 'Weigh-ins', per: 200 },
  { key: 'measure', label: 'Waist measurements', per: 150 },
  { key: 'pr', label: 'Personal records', per: 300 },
] as const;

export type DamageKey = (typeof DAMAGE_RULES)[number]['key'];

export function dayDamage(d: DayStats): Record<DamageKey, number> {
  return {
    protein: d.proteinHit ? 1000 : 0,
    target: d.onTarget ? 1200 : 0,
    sealed: d.sealed && d.logged ? 200 : 0,
    strength: d.strength ? 600 : 0,
    sets: Math.min(d.sets, 30) * 25,
    cardio: Math.min(d.cardioMinutes, 120) * 15,
    steps: Math.floor(Math.min(d.steps, 20_000) / 1000) * 50,
    weigh: d.weighIn !== null ? 200 : 0,
    measure: d.measured ? 150 : 0,
    pr: Math.min(d.prs, 5) * 300,
  };
}

export interface RaidWeek {
  weekStart: string;
  index: number; // weeks since the hero was created
  boss: Boss;
  tier: number; // previous kills; drives HP scaling
  hp: number;
  damage: number;
  breakdown: Record<DamageKey, number>;
  defeated: boolean;
}

export function bossHp(kills: number): number {
  return Math.round(RAID_BASE_HP * Math.min(2, 1 + 0.05 * kills));
}

/** Every raid week from the hero's first week through the current one. Bosses scale with your kill count. */
export function computeRaids(day: (date: string) => DayStats, createdAt: string, today: string): RaidWeek[] {
  const first = weekStart(createdAt);
  const last = weekStart(today);
  const weeks: RaidWeek[] = [];
  let kills = 0;
  let index = 0;
  for (let ws = first; ws <= last; ws = addDays(ws, 7), index++) {
    const breakdown = Object.fromEntries(DAMAGE_RULES.map((r) => [r.key, 0])) as Record<DamageKey, number>;
    for (const date of weekDays(ws)) {
      if (date > today) break;
      const dd = dayDamage(day(date));
      for (const k of Object.keys(dd) as DamageKey[]) breakdown[k] += dd[k];
    }
    const damage = Object.values(breakdown).reduce((s, n) => s + n, 0);
    const hp = bossHp(kills);
    const defeated = damage >= hp;
    weeks.push({ weekStart: ws, index, boss: BOSSES[index % BOSSES.length], tier: kills, hp, damage, breakdown, defeated });
    if (defeated) kills++;
  }
  return weeks;
}
