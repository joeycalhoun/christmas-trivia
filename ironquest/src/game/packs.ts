import type { GameState, PackType, Rarity } from './types';
import { CARDS_BY_RARITY, CARD_BY_ID, PACKS, PITY_LIMIT, RARITIES, RARITY_INFO } from './cards';

export interface PulledCard {
  cardId: string;
  isNew: boolean;
  essence: number;
}

export interface PackResult {
  type: PackType;
  pulls: PulledCard[];
  /** Set when several packs were opened at once. */
  count?: number;
}

function rollRarity(type: PackType, rng: () => number): Rarity {
  const odds = PACKS[type].odds;
  const total = RARITIES.reduce((s, r) => s + odds[r], 0);
  let x = rng() * total;
  for (const r of RARITIES) {
    x -= odds[r];
    if (x < 0) return r;
  }
  return 'common';
}

function rollAtLeast(type: PackType, min: Rarity, rng: () => number): Rarity {
  const minIdx = RARITIES.indexOf(min);
  const allowed = RARITIES.slice(minIdx);
  const odds = PACKS[type].odds;
  const total = allowed.reduce((s, r) => s + odds[r], 0);
  let x = rng() * total;
  for (const r of allowed) {
    x -= odds[r];
    if (x < 0) return r;
  }
  return min;
}

/** Roll the rarities for a pack, honoring its guaranteed minimum and the legendary pity timer. */
export function rollPack(type: PackType, pity: number, rng: () => number): Rarity[] {
  const def = PACKS[type];
  const rarities = Array.from({ length: def.cards }, () => rollRarity(type, rng));
  const gIdx = RARITIES.indexOf(def.guarantee);
  if (!rarities.some((r) => RARITIES.indexOf(r) >= gIdx)) {
    rarities[rarities.length - 1] = rollAtLeast(type, def.guarantee, rng);
  }
  if (pity + 1 >= PITY_LIMIT && !rarities.includes('legendary')) {
    rarities[rarities.length - 1] = 'legendary';
  }
  // Best card revealed last — it's more fun that way.
  return rarities.sort((a, b) => RARITIES.indexOf(a) - RARITIES.indexOf(b));
}

/** Open the first unopened pack of `type`. Returns the new state and what was pulled. */
export function openPack(state: GameState, type: PackType, rng: () => number = Math.random): { state: GameState; result: PackResult } | null {
  const idx = state.packs.indexOf(type);
  if (idx < 0) return null;
  const rarities = rollPack(type, state.pity, rng);
  const cards = { ...state.cards };
  let essence = state.wallet.essence;
  const pulls: PulledCard[] = rarities.map((r) => {
    const pool = CARDS_BY_RARITY[r];
    const card = pool[Math.floor(rng() * pool.length)];
    const owned = cards[card.id] ?? 0;
    // Duplicates melt straight into essence, which crafts any card you're missing.
    if (owned === 0) cards[card.id] = 1;
    const dupe = owned > 0 ? RARITY_INFO[r].dupeEssence : 0;
    essence += dupe;
    return { cardId: card.id, isNew: owned === 0, essence: dupe };
  });
  const packs = [...state.packs];
  packs.splice(idx, 1);
  const gotLegendary = rarities.includes('legendary');
  return {
    state: {
      ...state,
      packs,
      cards,
      wallet: { ...state.wallet, essence },
      packsOpened: state.packsOpened + 1,
      pity: gotLegendary ? 0 : state.pity + 1,
    },
    result: { type, pulls },
  };
}

export function buyPack(state: GameState, type: PackType): GameState | null {
  const cost = PACKS[type].cost;
  if (state.wallet.coins < cost) return null;
  return { ...state, wallet: { ...state.wallet, coins: state.wallet.coins - cost }, packs: [...state.packs, type] };
}

export function craftCard(state: GameState, cardId: string): GameState | null {
  const card = CARD_BY_ID[cardId];
  if (!card || (state.cards[cardId] ?? 0) > 0) return null;
  const cost = RARITY_INFO[card.rarity].craftCost;
  if (state.wallet.essence < cost) return null;
  return {
    ...state,
    wallet: { ...state.wallet, essence: state.wallet.essence - cost },
    cards: { ...state.cards, [cardId]: 1 },
  };
}
