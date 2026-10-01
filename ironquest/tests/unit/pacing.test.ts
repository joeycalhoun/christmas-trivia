import { describe, expect, it } from 'vitest';
import { simulate } from './sim';

describe('progression pacing', () => {
  it('levels up quickly at first, then steadily, without hitting the cap in a month', () => {
    const { levels, view, s } = simulate(30);
    const packsBy: Record<string, number> = {};
    for (const c of Object.values(s.claims)) {
      const kind = c.id.split(':')[0];
      packsBy[kind] = (packsBy[kind] ?? 0) + c.packs.length;
    }
    if (process.env.PACING_DEBUG) {
      console.log('levels', levels.join(','), 'cards', Object.keys(s.cards).length, 'coins', s.wallet.coins, 'kills', view.raidKills, 'packs', JSON.stringify(packsBy));
    }
    expect(levels[0]).toBeGreaterThanOrEqual(3); // day one feels rewarding
    expect(levels[6]).toBeGreaterThan(levels[0]);
    expect(levels[29]).toBeGreaterThan(levels[13]);
    expect(levels[29]).toBeLessThan(25); // the road to 60 is long
    expect(view.raidKills).toBeGreaterThanOrEqual(2);
    const unique = Object.keys(s.cards).length;
    expect(unique).toBeGreaterThan(15);
    expect(unique).toBeLessThan(90); // even spending every coin, the collection takes months
  });
});
