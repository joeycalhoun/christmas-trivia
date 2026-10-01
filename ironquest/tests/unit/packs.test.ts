import { describe, expect, it } from 'vitest';
import { CARDS, CARD_BY_ID, PACKS, RARITY_INFO, squadBonus } from '../../src/game/cards';
import { buyPack, craftCard, openPack, rollPack } from '../../src/game/packs';
import { mulberry32 } from '../../src/lib/rng';
import { freshState } from './helpers';
import { RARITIES } from '../../src/game/cards';

describe('card catalog', () => {
  it('has 120 unique, stable cards', () => {
    expect(CARDS).toHaveLength(120);
    expect(new Set(CARDS.map((c) => c.name)).size).toBe(120);
    expect(CARD_BY_ID['hearth_12'].rarity).toBe('legendary');
    for (const c of CARDS) {
      const [lo, hi] = RARITY_INFO[c.rarity].ovr;
      expect(c.ovr).toBeGreaterThanOrEqual(lo);
      expect(c.ovr).toBeLessThanOrEqual(hi);
    }
  });

  it('computes squad bonuses including chemistry', () => {
    const empty = squadBonus([null, null, null, null, null]);
    expect(empty.xpPct).toBe(0);
    const chem = squadBonus(['hearth_01', 'hearth_02', 'hearth_03', null, null]);
    expect(chem.chemistry?.count).toBe(3);
    expect(chem.coinPct).toBeGreaterThanOrEqual(5);
  });
});

describe('packs', () => {
  it('always honors the guaranteed rarity', () => {
    const rng = mulberry32(1);
    for (const type of ['silver', 'gold', 'elite'] as const) {
      for (let i = 0; i < 300; i++) {
        const r = rollPack(type, 0, rng);
        expect(r).toHaveLength(PACKS[type].cards);
        const min = RARITIES.indexOf(PACKS[type].guarantee);
        expect(r.some((x) => RARITIES.indexOf(x) >= min)).toBe(true);
      }
    }
  });

  it('forces a legendary when the pity timer runs out', () => {
    const r = rollPack('bronze', 39, () => 0.01);
    expect(r).toContain('legendary');
  });

  it('buys, opens, converts duplicates to essence, and crafts', () => {
    let s = freshState({ wallet: { coins: 1000, essence: 0, bonusXp: 0 } });
    s = buyPack(s, 'bronze')!;
    expect(s.wallet.coins).toBe(1000 - PACKS.bronze.cost);
    expect(buyPack({ ...s, wallet: { ...s.wallet, coins: 10 } }, 'gold')).toBeNull();
    const opened = openPack(s, 'bronze', () => 0)!; // same card every time → duplicates
    expect(opened.state.packs).toHaveLength(0);
    expect(opened.result.pulls).toHaveLength(3);
    expect(opened.result.pulls[0].isNew).toBe(true);
    expect(opened.result.pulls[1].isNew).toBe(false);
    expect(opened.state.wallet.essence).toBe(2 * RARITY_INFO.common.dupeEssence);
    expect(opened.state.pity).toBe(1);
    const missing = CARDS.find((c) => c.rarity === 'common' && !opened.state.cards[c.id])!;
    expect(craftCard(opened.state, missing.id)).toBeNull(); // not enough essence
    const rich = { ...opened.state, wallet: { ...opened.state.wallet, essence: 100 } };
    const crafted = craftCard(rich, missing.id)!;
    expect(crafted.cards[missing.id]).toBe(1);
    expect(crafted.wallet.essence).toBe(100 - RARITY_INFO.common.craftCost);
  });
});

describe('auto squad', () => {
  it('fills all five slots and beats a naive top-rating pick', async () => {
    const { bestSquad, squadBonus, squadScore } = await import('../../src/game/cards');
    const owned = CARDS.filter((_, i) => i % 3 === 0).map((c) => c.id);
    const auto = bestSquad(owned);
    expect(auto.filter(Boolean)).toHaveLength(5);
    expect(new Set(auto).size).toBe(5);
    const naive = [...owned].sort((a, b) => CARD_BY_ID[b].ovr - CARD_BY_ID[a].ovr).slice(0, 5);
    expect(squadScore(squadBonus(auto))).toBeGreaterThanOrEqual(squadScore(squadBonus(naive)));
    expect(bestSquad(owned.slice(0, 2)).filter(Boolean)).toHaveLength(2);
  });
});
