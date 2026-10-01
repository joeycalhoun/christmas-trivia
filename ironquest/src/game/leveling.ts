export const CHAR_MAX_LEVEL = 60;
export const PARAGON_XP = 20_000;
export const SKILL_MAX_LEVEL = 100;

export interface LevelInfo {
  level: number;
  /** XP earned into the current level. */
  into: number;
  /** XP required to finish the current level (0 when maxed). */
  needed: number;
  total: number;
  maxed: boolean;
  paragon: number;
}

export function charXpToNext(level: number): number {
  return Math.round((300 + 40 * Math.pow(level - 1, 1.6)) / 5) * 5;
}

export function skillXpToNext(level: number): number {
  return Math.round((60 + 4 * Math.pow(level, 1.4)) / 5) * 5;
}

function walk(xp: number, max: number, cost: (l: number) => number): { level: number; into: number; needed: number } {
  let level = 1;
  let rest = Math.max(0, Math.floor(xp));
  while (level < max && rest >= cost(level)) {
    rest -= cost(level);
    level++;
  }
  return { level, into: rest, needed: level < max ? cost(level) : 0 };
}

export function charLevel(xp: number): LevelInfo {
  const w = walk(xp, CHAR_MAX_LEVEL, charXpToNext);
  if (w.level < CHAR_MAX_LEVEL) return { ...w, total: xp, maxed: false, paragon: 0 };
  // Past the cap, XP keeps flowing into endless Paragon levels.
  const paragon = Math.floor(w.into / PARAGON_XP);
  return { level: CHAR_MAX_LEVEL, into: w.into % PARAGON_XP, needed: PARAGON_XP, total: xp, maxed: true, paragon };
}

export function skillLevel(xp: number): LevelInfo {
  const w = walk(xp, SKILL_MAX_LEVEL, skillXpToNext);
  return { ...w, total: xp, maxed: w.level >= SKILL_MAX_LEVEL, paragon: 0 };
}

export interface Rank {
  min: number;
  name: string;
}

export const CHAR_RANKS: Rank[] = [
  { min: 1, name: 'Recruit' },
  { min: 5, name: 'Squire' },
  { min: 10, name: 'Adventurer' },
  { min: 15, name: 'Veteran' },
  { min: 20, name: 'Knight' },
  { min: 25, name: 'Knight-Captain' },
  { min: 30, name: 'Champion' },
  { min: 35, name: 'Commander' },
  { min: 40, name: 'Warlord' },
  { min: 45, name: 'High Warlord' },
  { min: 50, name: 'Hero of the Realm' },
  { min: 55, name: 'Legend' },
  { min: 60, name: 'Ascended' },
];

export function rankFor(level: number): string {
  let name = CHAR_RANKS[0].name;
  for (const r of CHAR_RANKS) if (level >= r.min) name = r.name;
  return name;
}

export const SKILL_TIERS: Rank[] = [
  { min: 1, name: 'Apprentice' },
  { min: 25, name: 'Journeyman' },
  { min: 50, name: 'Expert' },
  { min: 75, name: 'Artisan' },
  { min: 100, name: 'Grandmaster' },
];

export function skillTier(level: number): string {
  let name = SKILL_TIERS[0].name;
  for (const r of SKILL_TIERS) if (level >= r.min) name = r.name;
  return name;
}

export interface Zone {
  min: number;
  max: number;
  name: string;
  blurb: string;
}

/** The "world map" — a long road from the couch to the summit, unlocked by character level. */
export const ZONES: Zone[] = [
  { min: 1, max: 5, name: 'The Couchlands', blurb: 'Where every hero begins. Soft, comfortable, and dangerous.' },
  { min: 6, max: 10, name: 'Snackwood Forest', blurb: 'Trees that grow chips. Learn to walk past them.' },
  { min: 11, max: 15, name: 'The Plateau of Excuses', blurb: 'Many travelers stall here. You will not.' },
  { min: 16, max: 20, name: 'Ironvein Mines', blurb: 'Heavy things are lifted. Heavier things are next.' },
  { min: 21, max: 25, name: 'Proteinshire', blurb: 'A pastoral land of chicken breasts and Greek yogurt.' },
  { min: 26, max: 30, name: 'The Cravings Marsh', blurb: 'Late-night temptations bubble up from the bog.' },
  { min: 31, max: 35, name: 'Bastion of Discipline', blurb: 'Here, habits become armor.' },
  { min: 36, max: 40, name: 'The Barbell Peaks', blurb: 'Thin air. Heavy plates. Big views.' },
  { min: 41, max: 45, name: 'Sanctum of Consistency', blurb: 'Monks who never miss a Monday.' },
  { min: 46, max: 50, name: 'The Shredlands', blurb: 'Hard-earned definition, forged over months.' },
  { min: 51, max: 55, name: 'Titanforge', blurb: 'Where strength becomes legend.' },
  { min: 56, max: 60, name: 'Summit of the Ascended', blurb: 'The endgame. Few reach it. You are built for it.' },
];

export function zoneFor(level: number): Zone {
  return ZONES.find((z) => level >= z.min && level <= z.max) ?? ZONES[ZONES.length - 1];
}
