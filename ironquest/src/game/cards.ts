import type { PackType, Rarity } from './types';
import { mulberry32 } from '../lib/rng';

export type PerkType = 'xp' | 'coins' | 'protein' | 'discipline' | 'training' | 'raid';

export interface Perk {
  type: PerkType;
  value: number; // percent
}

export interface CardSet {
  id: string;
  name: string;
  emblem: string;
  lore: string;
}

export interface Card {
  id: string;
  name: string;
  set: string;
  rarity: Rarity;
  heroClass: string;
  icon: string;
  ovr: number;
  perk: Perk | null;
}

export const RARITIES: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

export const RARITY_INFO: Record<Rarity, { label: string; color: string; ovr: [number, number]; perk: number; dupeEssence: number; craftCost: number }> = {
  common: { label: 'Common', color: '#9ca3af', ovr: [60, 69], perk: 0, dupeEssence: 5, craftCost: 25 },
  uncommon: { label: 'Uncommon', color: '#34d399', ovr: [70, 77], perk: 2, dupeEssence: 15, craftCost: 75 },
  rare: { label: 'Rare', color: '#60a5fa', ovr: [78, 84], perk: 4, dupeEssence: 40, craftCost: 200 },
  epic: { label: 'Epic', color: '#c084fc', ovr: [85, 91], perk: 7, dupeEssence: 100, craftCost: 500 },
  legendary: { label: 'Legendary', color: '#fbbf24', ovr: [92, 99], perk: 12, dupeEssence: 250, craftCost: 1500 },
};

export const PERK_LABEL: Record<PerkType, string> = {
  xp: 'XP from all rewards',
  coins: 'Coins from all rewards',
  protein: 'Coins from protein quests',
  discipline: 'Coins from calorie & logging quests',
  training: 'Coins from training quests',
  raid: 'Coins from raid loot',
};

export const SETS: CardSet[] = [
  { id: 'hearth', name: 'Hearthguard', emblem: '🏠', lore: 'Village defenders who start every morning with a hearty breakfast.' },
  { id: 'ember', name: 'Emberforge Legion', emblem: '🔥', lore: 'Smiths and soldiers who forge their bodies like steel.' },
  { id: 'verdant', name: 'Verdant Wardens', emblem: '🌿', lore: 'Forest rangers fueled by greens and long marches.' },
  { id: 'tide', name: 'Tidecallers', emblem: '🌊', lore: 'Sea raiders who swim, row, and never skip cardio.' },
  { id: 'storm', name: 'Stormpeak Clans', emblem: '⛰️', lore: 'Mountain folk who deadlift boulders for sport.' },
  { id: 'sun', name: 'Sunspire Order', emblem: '☀️', lore: 'Paladins sworn to the Oath of the Daily Log.' },
  { id: 'shadow', name: 'Shadowfen Rogues', emblem: '🌙', lore: 'Thieves who stole the Midnight Muncher’s snacks.' },
  { id: 'frost', name: 'Frostmarch Titans', emblem: '❄️', lore: 'Ancient giants of discipline, cold and unbreakable.' },
  { id: 'gear', name: 'Ironclad Brotherhood', emblem: '⚙️', lore: 'Clockwork knights who never skip leg day.' },
  { id: 'star', name: 'Starfall Mystics', emblem: '🌠', lore: 'Seers who read destiny in their macros.' },
];

const CLASSES: { name: string; icon: string }[] = [
  { name: 'Warrior', icon: '⚔️' },
  { name: 'Paladin', icon: '🛡️' },
  { name: 'Ranger', icon: '🏹' },
  { name: 'Mage', icon: '🔮' },
  { name: 'Monk', icon: '🥋' },
  { name: 'Rogue', icon: '🗡️' },
  { name: 'Druid', icon: '🌿' },
  { name: 'Berserker', icon: '🪓' },
  { name: 'Cleric', icon: '✨' },
  { name: 'Knight', icon: '🐎' },
];

const FIRST = [
  'Brakka', 'Thessa', 'Garrick', 'Ilya', 'Doran', 'Mirela', 'Kael', 'Ysolde', 'Torvin', 'Asha', 'Bram', 'Seren',
  'Halvar', 'Nyx', 'Corwin', 'Freya', 'Oskar', 'Liora', 'Ragnar', 'Elowen', 'Fenris', 'Kira', 'Magnus', 'Talia',
  'Ulric', 'Vesna', 'Bjorn', 'Sable', 'Cassius', 'Rowan', 'Dagny', 'Theron', 'Isolde', 'Varn', 'Mira', 'Grom',
  'Anwen', 'Jareth', 'Sigrun', 'Eamon', 'Zara', 'Hector', 'Wren', 'Orrin', 'Petra', 'Lucan', 'Yara', 'Dax',
  'Rhea', 'Soren', 'Ingrid', 'Aldric', 'Nadia', 'Kellan', 'Brynn', 'Tobias', 'Odessa', 'Ivar', 'Marisol', 'Cormac',
];

const LAST = [
  'Stonefist', 'Ironhide', 'Ashborn', 'Brightshield', 'Grimward', 'Swiftarrow', 'Oakheart', 'Stormcaller', 'Frostbeard',
  'Dawnstrider', 'Emberclaw', 'Tidebreaker', 'Hammerfall', 'Nightbloom', 'Steelgaze', 'Wolfsbane', 'Thunderbelly',
  'Goldmane', 'Ravenshade', 'Bouldershoulder', 'Lightfoot', 'Deadlift', 'Ironpour', 'Saltwind', 'Mossback', 'Flintjaw',
  'Sunforge', 'Moonwhisper', 'Copperclad', 'Hollowbrook', 'Skullsplitter', 'Starwatch', 'Kettlebell', 'Bronzebrow',
  'Grainward', 'Proteinheart', 'Squatmore', 'Benchlord', 'Wildmane', 'Coldsteel', 'Firebrand', 'Greystone', 'Highpeak',
  'Longstride', 'Quickblade', 'Redforge', 'Silverleaf', 'Trueheart', 'Valewalker', 'Warbanner',
];

const RARITY_LAYOUT: Rarity[] = [
  'common', 'common', 'common', 'common', 'common',
  'uncommon', 'uncommon', 'uncommon',
  'rare', 'rare',
  'epic',
  'legendary',
];

const PERK_TYPES: PerkType[] = ['xp', 'coins', 'protein', 'discipline', 'training', 'raid'];

function buildCatalog(): Card[] {
  const rng = mulberry32(20261001);
  const used = new Set<string>();
  const pick = <T,>(arr: T[]) => arr[Math.floor(rng() * arr.length)];
  const cards: Card[] = [];
  SETS.forEach((set) => {
    RARITY_LAYOUT.forEach((rarity, i) => {
      let name = '';
      do name = `${pick(FIRST)} ${pick(LAST)}`;
      while (used.has(name));
      used.add(name);
      const cls = pick(CLASSES);
      const [lo, hi] = RARITY_INFO[rarity].ovr;
      const ovr = lo + Math.floor(rng() * (hi - lo + 1));
      const perk: Perk | null = rarity === 'common' ? null : { type: pick(PERK_TYPES), value: RARITY_INFO[rarity].perk };
      cards.push({ id: `${set.id}_${String(i + 1).padStart(2, '0')}`, name, set: set.id, rarity, heroClass: cls.name, icon: cls.icon, ovr, perk });
    });
  });
  return cards;
}

export const CARDS: Card[] = buildCatalog();
export const CARD_BY_ID: Record<string, Card> = Object.fromEntries(CARDS.map((c) => [c.id, c]));
export const CARDS_BY_RARITY: Record<Rarity, Card[]> = {
  common: CARDS.filter((c) => c.rarity === 'common'),
  uncommon: CARDS.filter((c) => c.rarity === 'uncommon'),
  rare: CARDS.filter((c) => c.rarity === 'rare'),
  epic: CARDS.filter((c) => c.rarity === 'epic'),
  legendary: CARDS.filter((c) => c.rarity === 'legendary'),
};

export interface SquadBonus {
  ovr: number;
  xpPct: number;
  coinPct: number;
  categoryPct: Record<'protein' | 'discipline' | 'training' | 'raid', number>;
  chemistry: { set: string; count: number } | null;
  lines: string[];
}

export const SQUAD_SIZE = 5;

/** Team rating + perks + set chemistry → multipliers applied to every reward you claim. */
export function squadBonus(squad: (string | null)[]): SquadBonus {
  const cards = squad.map((id) => (id ? CARD_BY_ID[id] : null)).filter((c): c is Card => !!c);
  const ovr = Math.round(cards.reduce((s, c) => s + c.ovr, 0) / SQUAD_SIZE);
  let xpPct = Math.max(0, ovr - 60) * 0.5;
  let coinPct = 0;
  const categoryPct = { protein: 0, discipline: 0, training: 0, raid: 0 };
  const lines: string[] = [];
  if (xpPct > 0) lines.push(`Team rating ${ovr}: +${xpPct}% XP`);
  for (const c of cards) {
    if (!c.perk) continue;
    if (c.perk.type === 'xp') xpPct += c.perk.value;
    else if (c.perk.type === 'coins') coinPct += c.perk.value;
    else categoryPct[c.perk.type] += c.perk.value;
  }
  const counts: Record<string, number> = {};
  for (const c of cards) counts[c.set] = (counts[c.set] ?? 0) + 1;
  let chemistry: SquadBonus['chemistry'] = null;
  for (const [set, count] of Object.entries(counts)) {
    if (count >= 3 && (!chemistry || count > chemistry.count)) chemistry = { set, count };
  }
  if (chemistry) {
    const name = SETS.find((s) => s.id === chemistry!.set)?.name;
    if (chemistry.count >= 5) {
      coinPct += 10;
      xpPct += 5;
      lines.push(`Full ${name} chemistry: +10% coins, +5% XP`);
    } else {
      coinPct += 5;
      lines.push(`${name} chemistry (${chemistry.count}): +5% coins`);
    }
  }
  xpPct = Math.min(60, xpPct);
  coinPct = Math.min(60, coinPct);
  return { ovr, xpPct, coinPct, categoryPct, chemistry, lines };
}

export const PACKS: Record<PackType, { label: string; cost: number; cards: number; odds: Record<Rarity, number>; guarantee: Rarity; color: string; blurb: string }> = {
  bronze: {
    label: 'Bronze Pack', cost: 750, cards: 3, color: '#b45309', guarantee: 'common',
    odds: { common: 70, uncommon: 22, rare: 6.5, epic: 1.3, legendary: 0.2 },
    blurb: '3 cards. Mostly commons — great for filling sets.',
  },
  silver: {
    label: 'Silver Pack', cost: 2000, cards: 4, color: '#94a3b8', guarantee: 'uncommon',
    odds: { common: 50, uncommon: 32, rare: 13, epic: 4, legendary: 1 },
    blurb: '4 cards. At least one Uncommon or better.',
  },
  gold: {
    label: 'Gold Pack', cost: 5000, cards: 5, color: '#eab308', guarantee: 'rare',
    odds: { common: 30, uncommon: 35, rare: 23, epic: 9, legendary: 3 },
    blurb: '5 cards. At least one Rare or better.',
  },
  elite: {
    label: 'Elite Pack', cost: 12000, cards: 5, color: '#a855f7', guarantee: 'epic',
    odds: { common: 10, uncommon: 30, rare: 35, epic: 18, legendary: 7 },
    blurb: '5 cards. At least one Epic or better. Legendary hunting grounds.',
  },
};

export const PITY_LIMIT = 40;

/** One number to compare squads: overall XP% + coin% plus half credit for category-specific coin perks. */
export function squadScore(b: SquadBonus): number {
  const cat = b.categoryPct.protein + b.categoryPct.discipline + b.categoryPct.training + b.categoryPct.raid;
  return b.xpPct + b.coinPct + cat * 0.5;
}

/** Greedy build + swap passes. Not exhaustive, but finds chemistry and perk stacks well in practice. */
export function bestSquad(owned: string[]): (string | null)[] {
  const pool = owned.filter((id) => CARD_BY_ID[id]);
  const squad: (string | null)[] = [null, null, null, null, null];
  const score = (s: (string | null)[]) => squadScore(squadBonus(s)) + s.filter(Boolean).length * 0.001;
  for (let slot = 0; slot < SQUAD_SIZE; slot++) {
    let best: string | null = null;
    let bestScore = -Infinity;
    for (const id of pool) {
      if (squad.includes(id)) continue;
      squad[slot] = id;
      const sc = score(squad);
      if (sc > bestScore) {
        bestScore = sc;
        best = id;
      }
    }
    squad[slot] = best;
  }
  for (let pass = 0; pass < 4; pass++) {
    let improved = false;
    for (let slot = 0; slot < SQUAD_SIZE; slot++) {
      const current = score(squad);
      const keep = squad[slot];
      let bestId = keep;
      let bestScore = current;
      for (const id of pool) {
        if (squad.includes(id)) continue;
        squad[slot] = id;
        const sc = score(squad);
        if (sc > bestScore + 1e-9) {
          bestScore = sc;
          bestId = id;
        }
      }
      squad[slot] = bestId;
      if (bestId !== keep) improved = true;
    }
    if (!improved) break;
  }
  return squad;
}
