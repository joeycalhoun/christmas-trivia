import { normalizeState, type GameState } from '../game/types';

const LS_KEY = 'ironquest.save.v1';

export type SyncStatus = 'loading' | 'server' | 'local' | 'saving' | 'error';

function readLocal(): GameState | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? normalizeState(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function writeLocal(state: GameState) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  } catch {
    /* storage full or blocked — the server copy still exists */
  }
}

async function readServer(): Promise<{ state: GameState | null; reachable: boolean }> {
  try {
    const res = await fetch('/api/state', { cache: 'no-store' });
    if (res.status === 204) return { state: null, reachable: true };
    if (!res.ok || !(res.headers.get('content-type') ?? '').includes('json')) return { state: null, reachable: false };
    return { state: normalizeState(await res.json()), reachable: true };
  } catch {
    return { state: null, reachable: false };
  }
}

// The hero's identity must not change when the (editable) name does. Older saves without an id fall
// back to the creation date, which is also immutable.
const identity = (s: GameState) => (s.profile ? (s.profile.heroId ?? `created:${s.profile.createdAt}`) : null);

/**
 * Decide between the server save and this browser's copy. The server is the source of truth whenever
 * the two disagree about *which hero* this is (e.g. a phone that created a throwaway hero while the server
 * was unreachable must never clobber the real save). Same hero → the most recently changed copy wins.
 */
export function pickState(server: GameState | null, local: GameState | null): GameState | null {
  if (!server || !server.profile) return local?.profile ? local : (server ?? local);
  if (!local || !local.profile) return server;
  if (identity(server) !== identity(local)) return server;
  return local.updatedAt > server.updatedAt ? local : server;
}

/** Load the best of the server save and the browser's local copy. */
export async function loadState(): Promise<{ state: GameState | null; serverOk: boolean }> {
  const [server, local] = await Promise.all([readServer(), Promise.resolve(readLocal())]);
  return { state: pickState(server.state, local), serverOk: server.reachable };
}

/** Fetch the server copy (used to pick up changes made on another device). */
export async function fetchServerState() {
  return readServer();
}

/** True while a change is waiting to upload *or* uploading — the server copy can't be trusted yet. */
export function hasPendingSave() {
  return pending !== null || inFlight > 0;
}

let timer: ReturnType<typeof setTimeout> | null = null;
let pending: GameState | null = null;
let inFlight = 0;

export function saveState(state: GameState, onStatus: (s: SyncStatus) => void, serverOk: boolean) {
  writeLocal(state);
  if (!serverOk) {
    onStatus('local');
    return;
  }
  pending = state;
  onStatus('saving');
  if (timer) clearTimeout(timer);
  timer = setTimeout(flush, 400, onStatus);
}

async function flush(onStatus: (s: SyncStatus) => void) {
  const state = pending;
  pending = null;
  timer = null;
  if (!state) return;
  inFlight++;
  try {
    const res = await fetch('/api/state', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state),
    });
    onStatus(res.ok ? 'server' : 'error');
  } catch {
    onStatus('error');
  } finally {
    inFlight--;
  }
}

export function clearLocal() {
  try {
    localStorage.removeItem(LS_KEY);
  } catch {
    /* ignore */
  }
}

/** Best-effort save when the tab is closing mid-debounce. */
export function flushOnExit() {
  if (!pending) return;
  try {
    navigator.sendBeacon('/api/state', new Blob([JSON.stringify(pending)], { type: 'application/json' }));
    pending = null;
  } catch {
    /* ignore */
  }
}
