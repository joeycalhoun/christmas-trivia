import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PORT = 3377;
const BASE = `http://127.0.0.1:${PORT}`;
let proc: ChildProcess;
let dir: string;

const save = (heroId: string, heroName: string, foods = 0) => ({
  version: 1,
  profile: { heroId, heroName, createdAt: '2026-09-28' },
  foods: Array.from({ length: foods }, (_, i) => ({ id: String(i) })),
  updatedAt: Date.now(),
});
const put = (body: unknown) => fetch(`${BASE}/api/state`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const replaced = () => fs.readdirSync(path.join(dir, 'backups')).filter((f) => f.startsWith('replaced-'));

beforeAll(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'iq-'));
  proc = spawn(process.execPath, ['server/server.mjs', '--port', String(PORT), '--host', '127.0.0.1', '--data', dir], { stdio: 'ignore' });
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(`${BASE}/api/health`)).ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('server did not start');
});

afterAll(() => {
  proc.kill();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('save server', () => {
  it('reports "no save yet" with 204, then round-trips a save', async () => {
    expect((await fetch(`${BASE}/api/state`)).status).toBe(204);
    expect((await put(save('a', 'Joey', 50))).ok).toBe(true);
    const got = await (await fetch(`${BASE}/api/state`)).json();
    expect(got.profile.heroName).toBe('Joey');
    expect(fs.readdirSync(path.join(dir, 'backups')).some((f) => f.startsWith('save-'))).toBe(true);
  });

  it('rejects garbage', async () => {
    expect((await fetch(`${BASE}/api/state`, { method: 'PUT', body: 'nope' })).status).toBe(400);
    expect((await put({ hello: 'world' })).status).toBe(400);
  });

  it('does not archive on rename, but does before a different hero or a wipe replaces the save', async () => {
    await put(save('a', 'Joey the Relentless', 50));
    expect(replaced()).toHaveLength(0);
    await put(save('b', 'Stray phone hero', 0));
    expect(replaced()).toHaveLength(1);
    await put({ version: 1, profile: null, updatedAt: Date.now() });
    expect(replaced()).toHaveLength(2);
  });

  it('survives many concurrent saves', async () => {
    const results = await Promise.all(Array.from({ length: 20 }, (_, i) => put(save('b', `n${i}`, 1))));
    expect(results.every((r) => r.ok)).toBe(true);
    const got = await (await fetch(`${BASE}/api/state`)).json();
    expect(got.profile.heroId).toBe('b');
  });

  it('serves the app shell for client routes and blocks path traversal', async () => {
    const r = await fetch(`${BASE}/food`);
    expect([200, 500]).toContain(r.status); // 500 only if the app hasn't been built
    const t = await fetch(`${BASE}/..%2f..%2fpackage.json`);
    expect(await t.text()).not.toContain('"devDependencies"');
  });
});
