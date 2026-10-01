import { it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { simulate } from './sim';
import { addDays, todayKey } from '../../src/lib/dates';

// Writes a realistic ~3.5-week save for demos/screenshots:
//   SEED_OUT=/some/dir npx vitest run tests/unit/seed.debug.test.ts
it.skipIf(!process.env.SEED_OUT)('seed demo save', () => {
  const { s } = simulate(24, addDays(todayKey(), -24));
  const out = process.env.SEED_OUT!;
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'save.json'), JSON.stringify({ ...s, updatedAt: Date.now() }));
});
