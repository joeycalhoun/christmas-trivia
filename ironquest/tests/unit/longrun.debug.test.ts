import { it } from 'vitest';
import { simulate } from './sim';
it.skipIf(!process.env.PACING_DEBUG)('long run', () => {
  const { levels, s, view } = simulate(300);
  console.log('L@60', levels[59], 'L@120', levels[119], 'L@180', levels[179], 'L@300', levels[299], 'cards', Object.keys(s.cards).length, 'kills', view.raidKills, view.skills.map((k) => k.key + ':' + k.level).join(' '));
}, 300000);
