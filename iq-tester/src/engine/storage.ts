import type { SeenMap } from './builder';
import type { TestSummary } from './scoring';

const SEEN_KEY = 'iq-tester.seen.v1';
const HISTORY_KEY = 'iq-tester.history.v1';

export interface HistoryEntry {
  at: number;
  form: 'full' | 'quick';
  formCode: string;
  relaxed: boolean;
  iq: number;
  band: string;
  correct: number;
  items: number;
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be unavailable (private mode, blocked site data); the test still works without it.
  }
}

export const loadSeen = () => read<SeenMap>(SEEN_KEY, {});
export const saveSeen = (seen: SeenMap) => write(SEEN_KEY, seen);
export const loadHistory = () => read<HistoryEntry[]>(HISTORY_KEY, []);

export function addHistory(entry: HistoryEntry) {
  write(HISTORY_KEY, [entry, ...loadHistory()].slice(0, 25));
}

export function clearAll() {
  try {
    window.localStorage.removeItem(SEEN_KEY);
    window.localStorage.removeItem(HISTORY_KEY);
  } catch {
    // ignore
  }
}

export type { TestSummary };
