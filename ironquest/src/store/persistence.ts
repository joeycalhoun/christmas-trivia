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

/** Load the newest of the server save and the browser's local copy. */
export async function loadState(): Promise<{ state: GameState | null; serverOk: boolean }> {
  const [server, local] = await Promise.all([readServer(), Promise.resolve(readLocal())]);
  const candidates = [server.state, local].filter((s): s is GameState => !!s);
  candidates.sort((a, b) => b.updatedAt - a.updatedAt);
  return { state: candidates[0] ?? null, serverOk: server.reachable };
}

let timer: ReturnType<typeof setTimeout> | null = null;
let pending: GameState | null = null;

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
  try {
    const res = await fetch('/api/state', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state),
    });
    onStatus(res.ok ? 'server' : 'error');
  } catch {
    onStatus('error');
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
