import type { Stats } from './stats';
import type { PackType } from './types';
import { fmt } from '../lib/format';

export interface AchievementCtx {
  stats: Stats;
  goalLoss: number; // lb between start and goal weight
  raidKills: number;
  uniqueCards: number;
  totalCards: number;
  packsOpened: number;
  completedSets: number;
}

export interface Tier {
  n: number;
  name: string;
  title?: string; // cosmetic title unlocked at this tier
}

export interface Track {
  key: string;
  name: string;
  icon: string;
  group: 'Body' | 'Nutrition' | 'Training' | 'Strength' | 'Glory';
  unit: string;
  metric: (c: AchievementCtx) => number;
  tiers: Tier[];
  describe: (n: number) => string;
}

export const TRACKS: Track[] = [
  {
    key: 'loss',
    name: 'Shedding the Armor',
    icon: '📉',
    group: 'Body',
    unit: 'lb',
    metric: (c) => Math.floor(c.stats.lostLb * 10) / 10,
    describe: (n) => `Lose ${n} lb (7-weigh-in trend)`,
    tiers: [
      { n: 1, name: 'First Pound' },
      { n: 3, name: 'Momentum' },
      { n: 5, name: 'Five Down' },
      { n: 10, name: 'Double Digits', title: 'the Lighter' },
      { n: 15, name: 'Fifteen Fallen' },
      { n: 20, name: 'Score of Pounds' },
      { n: 25, name: 'Quarter Century', title: 'the Transformed' },
      { n: 30, name: 'Thirty Slain' },
      { n: 40, name: 'Forty Felled' },
      { n: 50, name: 'Half Hundred', title: 'the Reforged' },
      { n: 75, name: 'Seventy-Five' },
      { n: 100, name: 'The Century', title: 'the Unrecognizable' },
    ],
  },
  {
    key: 'goal',
    name: 'Goal Weight',
    icon: '🏁',
    group: 'Body',
    unit: '%',
    metric: (c) => (c.goalLoss > 0 ? Math.floor(Math.min(100, (c.stats.lostLb / c.goalLoss) * 100)) : 0),
    describe: (n) => `Reach ${n}% of the way to your goal weight`,
    tiers: [
      { n: 10, name: 'The Journey Begins' },
      { n: 25, name: 'Quarter Way' },
      { n: 50, name: 'Halfway There', title: 'the Halfway Hero' },
      { n: 75, name: 'Home Stretch' },
      { n: 100, name: 'Goal Achieved', title: 'the Victorious' },
    ],
  },
  {
    key: 'waist',
    name: 'Belt Notches',
    icon: '📏',
    group: 'Body',
    unit: 'in',
    metric: (c) => Math.floor(c.stats.waistLost * 10) / 10,
    describe: (n) => `Lose ${n} inch${n === 1 ? '' : 'es'} off your waist`,
    tiers: [
      { n: 0.5, name: 'Half an Inch' },
      { n: 1, name: 'One Notch' },
      { n: 2, name: 'Two Notches' },
      { n: 3, name: 'New Belt', title: 'the Tapered' },
      { n: 4, name: 'Four Inches' },
      { n: 6, name: 'Six Inches', title: 'the Chiseled' },
      { n: 8, name: 'Eight Inches' },
    ],
  },
  {
    key: 'protein_days',
    name: 'Protein Devotion',
    icon: '🥩',
    group: 'Nutrition',
    unit: 'days',
    metric: (c) => c.stats.totals.proteinDays,
    describe: (n) => `Hit your protein target on ${n} days`,
    tiers: [
      { n: 1, name: 'First Feast' },
      { n: 7, name: 'Week of Gains' },
      { n: 14, name: 'Fortnight Fed' },
      { n: 30, name: 'Protein Baron', title: 'Protein Baron' },
      { n: 60, name: 'Protein Duke' },
      { n: 100, name: 'Protein Archduke', title: 'the Well-Fed' },
      { n: 200, name: 'Protein Emperor' },
      { n: 365, name: 'Year of Protein', title: 'Protein Emperor' },
    ],
  },
  {
    key: 'target_days',
    name: 'Hold the Line',
    icon: '🛡️',
    group: 'Nutrition',
    unit: 'days',
    metric: (c) => c.stats.totals.targetDays,
    describe: (n) => `Seal ${n} days inside your calorie window`,
    tiers: [
      { n: 1, name: 'First Stand' },
      { n: 7, name: 'Shieldwall' },
      { n: 14, name: 'Bulwark' },
      { n: 30, name: 'The Disciplined', title: 'the Disciplined' },
      { n: 60, name: 'Iron Will' },
      { n: 100, name: 'Unbreakable', title: 'the Unbreakable' },
      { n: 200, name: 'Living Fortress' },
      { n: 365, name: 'Year of Discipline', title: 'Master of Restraint' },
    ],
  },
  {
    key: 'streak',
    name: 'Unbroken Chain',
    icon: '🔥',
    group: 'Nutrition',
    unit: 'days',
    metric: (c) => c.stats.bestStreak,
    describe: (n) => `Log food ${n} days in a row`,
    tiers: [
      { n: 3, name: 'Kindling' },
      { n: 7, name: 'Week Aflame' },
      { n: 14, name: 'Steady Blaze' },
      { n: 21, name: 'Habit Forged' },
      { n: 30, name: 'The Relentless', title: 'the Relentless' },
      { n: 60, name: 'Wildfire' },
      { n: 100, name: 'Eternal Flame', title: 'the Undying Flame' },
      { n: 180, name: 'Half-Year Inferno' },
      { n: 365, name: 'The Sun Itself' },
    ],
  },
  {
    key: 'weighins',
    name: 'Scale Watcher',
    icon: '⚖️',
    group: 'Body',
    unit: 'weigh-ins',
    metric: (c) => c.stats.totals.weighIns,
    describe: (n) => `Log ${n} weigh-ins`,
    tiers: [
      { n: 1, name: 'Baseline' },
      { n: 10, name: 'Data Driven' },
      { n: 30, name: 'Trend Spotter' },
      { n: 100, name: 'The Cartographer' },
    ],
  },
  {
    key: 'workouts',
    name: 'Iron Rites',
    icon: '🏋️',
    group: 'Training',
    unit: 'sessions',
    metric: (c) => c.stats.totals.workouts,
    describe: (n) => `Complete ${n} strength sessions`,
    tiers: [
      { n: 1, name: 'First Rep' },
      { n: 5, name: 'Getting Started' },
      { n: 10, name: 'Gym Regular' },
      { n: 25, name: 'Iron Initiate' },
      { n: 50, name: 'Ironclad', title: 'Ironclad' },
      { n: 100, name: 'Centurion', title: 'the Centurion' },
      { n: 150, name: 'Iron Veteran' },
      { n: 250, name: 'Iron Legend' },
      { n: 500, name: 'Iron Immortal', title: 'Iron Immortal' },
    ],
  },
  {
    key: 'prs',
    name: 'Record Breaker',
    icon: '🏆',
    group: 'Strength',
    unit: 'PRs',
    metric: (c) => c.stats.totals.prs,
    describe: (n) => `Set ${n} personal records`,
    tiers: [
      { n: 1, name: 'New Best' },
      { n: 5, name: 'On the Rise' },
      { n: 10, name: 'PR Hunter' },
      { n: 25, name: 'Record Smasher', title: 'the Record Breaker' },
      { n: 50, name: 'Limitless' },
      { n: 100, name: 'Beyond Limits' },
    ],
  },
  {
    key: 'volume',
    name: 'Mountain Mover',
    icon: '⛰️',
    group: 'Training',
    unit: 'lb',
    metric: (c) => c.stats.totals.volume,
    describe: (n) => `Move ${fmt(n)} lb of total volume`,
    tiers: [
      { n: 10_000, name: 'Pebble Pusher' },
      { n: 50_000, name: 'Boulder Roller' },
      { n: 100_000, name: 'Hill Hauler' },
      { n: 250_000, name: 'Cliff Carrier' },
      { n: 500_000, name: 'Mountain Mover', title: 'Mountain Mover' },
      { n: 1_000_000, name: 'Millionaire' },
      { n: 2_500_000, name: 'Titan' },
      { n: 5_000_000, name: 'World Lifter', title: 'the World Lifter' },
    ],
  },
  {
    key: 'cardio',
    name: 'Long Road',
    icon: '🫀',
    group: 'Training',
    unit: 'min',
    metric: (c) => c.stats.totals.cardioMinutes,
    describe: (n) => `Accumulate ${fmt(n)} minutes of cardio`,
    tiers: [
      { n: 60, name: 'First Hour' },
      { n: 300, name: 'Wayfarer' },
      { n: 600, name: 'Road Warrior' },
      { n: 1500, name: 'Pathfinder', title: 'the Pathfinder' },
      { n: 3000, name: 'Marathoner' },
      { n: 6000, name: 'Tireless', title: 'the Tireless' },
    ],
  },
  {
    key: 'bench',
    name: 'Bench Press',
    icon: '🪑',
    group: 'Strength',
    unit: 'lb',
    metric: (c) => c.stats.lifts.bench,
    describe: (n) => `Bench press ${n} lb for a rep`,
    tiers: [
      { n: 95, name: 'Bar + 25s' },
      { n: 135, name: 'One Plate' },
      { n: 185, name: 'Plate and a Half' },
      { n: 225, name: 'Two Plates', title: 'Two-Plate' },
      { n: 275, name: 'Two and a Half' },
      { n: 315, name: 'Three Plates', title: 'Three-Plate' },
    ],
  },
  {
    key: 'squat',
    name: 'Squat',
    icon: '🦵',
    group: 'Strength',
    unit: 'lb',
    metric: (c) => c.stats.lifts.squat,
    describe: (n) => `Squat ${n} lb for a rep`,
    tiers: [
      { n: 135, name: 'One Plate' },
      { n: 185, name: 'Plate and a Half' },
      { n: 225, name: 'Two Plates' },
      { n: 275, name: 'Two and a Half' },
      { n: 315, name: 'Three Plates', title: 'Quadzilla' },
      { n: 365, name: 'Three and a Half' },
      { n: 405, name: 'Four Plates', title: 'Four-Plate Squatter' },
    ],
  },
  {
    key: 'deadlift',
    name: 'Deadlift',
    icon: '🔩',
    group: 'Strength',
    unit: 'lb',
    metric: (c) => c.stats.lifts.deadlift,
    describe: (n) => `Deadlift ${n} lb for a rep`,
    tiers: [
      { n: 135, name: 'One Plate' },
      { n: 225, name: 'Two Plates' },
      { n: 275, name: 'Two and a Half' },
      { n: 315, name: 'Three Plates' },
      { n: 365, name: 'Three and a Half' },
      { n: 405, name: 'Four Plates', title: 'Four-Plate' },
      { n: 495, name: 'Five Plates', title: 'the Earthshaker' },
    ],
  },
  {
    key: 'ohp',
    name: 'Overhead Press',
    icon: '🙌',
    group: 'Strength',
    unit: 'lb',
    metric: (c) => c.stats.lifts.ohp,
    describe: (n) => `Overhead press ${n} lb for a rep`,
    tiers: [
      { n: 65, name: 'Bar + 10s' },
      { n: 95, name: 'Bar + 25s' },
      { n: 115, name: 'Bar + 35s' },
      { n: 135, name: 'One Plate', title: 'Sky Presser' },
      { n: 155, name: 'Plate + 10s' },
      { n: 185, name: 'Plate and a Half' },
    ],
  },
  {
    key: 'raids',
    name: 'Raid Leader',
    icon: '🐉',
    group: 'Glory',
    unit: 'bosses',
    metric: (c) => c.raidKills,
    describe: (n) => `Defeat ${n} weekly raid bosses`,
    tiers: [
      { n: 1, name: 'First Blood' },
      { n: 3, name: 'Monster Hunter' },
      { n: 5, name: 'Boss Slayer' },
      { n: 10, name: 'Raid Leader', title: 'Raid Leader' },
      { n: 25, name: 'Dragonslayer', title: 'Dragonslayer' },
      { n: 52, name: 'A Year of Victories', title: 'the Undefeated' },
    ],
  },
  {
    key: 'collection',
    name: 'Collector',
    icon: '🃏',
    group: 'Glory',
    unit: 'cards',
    metric: (c) => c.uniqueCards,
    describe: (n) => `Collect ${n} unique cards`,
    tiers: [
      { n: 10, name: 'Starter Binder' },
      { n: 25, name: 'Card Enthusiast' },
      { n: 50, name: 'Curator' },
      { n: 75, name: 'Archivist' },
      { n: 100, name: 'Hoarder' },
      { n: 120, name: 'Complete Collection', title: 'the Collector' },
    ],
  },
  {
    key: 'sets',
    name: 'Set Master',
    icon: '📚',
    group: 'Glory',
    unit: 'sets',
    metric: (c) => c.completedSets,
    describe: (n) => `Complete ${n} card set${n === 1 ? '' : 's'}`,
    tiers: [
      { n: 1, name: 'Set Complete' },
      { n: 5, name: 'Half the Realm' },
      { n: 10, name: 'Every Banner', title: 'Lord of Banners' },
    ],
  },
];

export interface TierReward {
  xp: number;
  coins: number;
  packs: PackType[];
  points: number;
}

/** Rewards scale with how deep into a track a tier sits. */
export function tierReward(tierIndex: number, tierCount: number): TierReward {
  const depth = tierCount <= 1 ? 1 : tierIndex / (tierCount - 1);
  const xp = Math.round((100 + 150 * tierIndex) / 10) * 10;
  const coins = Math.round((100 + 150 * tierIndex) / 10) * 10;
  const packs: PackType[] = depth >= 0.99 ? ['elite'] : depth >= 0.6 ? ['gold'] : depth >= 0.3 ? ['silver'] : [];
  const points = 10 + tierIndex * 5;
  return { xp, coins, packs, points };
}

export const TITLE_ACHIEVEMENTS = TRACKS.flatMap((t) =>
  t.tiers.map((tier, i) => ({ id: `ach:${t.key}:${tier.n}`, title: tier.title, track: t, tier, index: i })).filter((x) => !!x.title),
);
