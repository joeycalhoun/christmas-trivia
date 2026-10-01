import { it } from 'vitest';
import { simulate } from './sim';
import { computeGame } from '../../src/game/engine';
import { addDays } from '../../src/lib/dates';
it.skipIf(!process.env.PACING_DEBUG)('perf after a year', () => {
  const { s } = simulate(365);
  const today = addDays(s.profile!.createdAt, 364);
  const t0 = performance.now();
  for (let i = 0; i < 20; i++) computeGame({ ...s }, today);
  console.log('computeGame ms', ((performance.now() - t0) / 20).toFixed(1), 'foods', s.foods.length);
}, 300000);
