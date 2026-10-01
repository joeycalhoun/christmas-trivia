import { computeGame, claimReward } from '../../src/game/engine';
import { computeTargets } from '../../src/game/nutrition';
import { buyPack, openPack } from '../../src/game/packs';
import { PACKS } from '../../src/game/cards';
import { mulberry32 } from '../../src/lib/rng';
import { addDays } from '../../src/lib/dates';
import { PROFILE, food, freshState, lift } from './helpers';
import type { GameState } from '../../src/game/types';

/** Simulate a consistent-but-imperfect player and make sure progression feels steady. */
export function simulate(days: number, start = PROFILE.createdAt) {
  let s: GameState = freshState({ profile: { ...PROFILE, createdAt: start } });
  const rng = mulberry32(42);
  const levels: number[] = [];
  let weight = PROFILE.startWeight;
  for (let i = 0; i < days; i++) {
    const date = addDays(start, i);
    const t = computeTargets(PROFILE, weight);
    const good = rng() < 0.75;
    s = {
      ...s,
      foods: [
        ...s.foods,
        food(date, 500, 45, 'breakfast'),
        food(date, 650, 50, 'lunch'),
        food(date, good ? t.calories - 1150 - 100 : t.calories, good ? t.protein - 90 : 50, 'dinner'),
      ],
      sealed: { ...s.sealed, [date]: 1 },
      steps: { ...s.steps, [date]: 6000 + Math.floor(rng() * 5000) },
    };
    if (i % 7 === 0 || i % 7 === 2 || i % 7 === 4) {
      const w = 135 + Math.floor(i / 7) * 5;
      s = { ...s, sessions: { ...s.sessions, [date]: { date, exercises: [lift('squat', [[w, 8], [w, 8], [w, 8]]), lift('bench', [[w - 20, 8], [w - 20, 8], [w - 20, 8]]), lift('barbell_row', [[w - 30, 10], [w - 30, 10], [w - 30, 10]])], cardio: [] } } };
    }
    if (i % 2 === 0) {
      weight -= 0.3;
      s = { ...s, weighIns: [...s.weighIns, { date, weight: Math.round(weight * 10) / 10 }] };
    }
    // Claim everything and open packs at the end of each day, like a real player would.
    for (let g = 0; g < 10; g++) {
      const view = computeGame(s, date);
      if (!view.claimable.length) break;
      for (const r of view.claimable) s = claimReward(s, view, r.id)?.state ?? s;
    }
    while (s.wallet.coins >= PACKS.gold.cost) s = buyPack(s, 'gold')!;
    while (s.packs.length) s = openPack(s, s.packs[0], rng)!.state;
    levels.push(computeGame(s, date).character.level);
  }
  return { s, levels, view: computeGame(s, addDays(start, days - 1)) };
}

