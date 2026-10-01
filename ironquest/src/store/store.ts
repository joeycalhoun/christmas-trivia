import { create } from 'zustand';
import { emptyState, normalizeState, type CardioEntry, type ExerciseEntry, type FoodEntry, type FoodItem, type GameState, type PackType, type Profile, type Session } from '../game/types';
import { claimReward, computeGame, type AppliedReward, type GameView } from '../game/engine';
import { buyPack, craftCard, openPack, type PackResult } from '../game/packs';
import { todayKey } from '../lib/dates';
import { uid } from '../lib/rng';
import { clearLocal, flushOnExit, loadState, saveState, type SyncStatus } from './persistence';

export interface Toast {
  id: string;
  icon: string;
  title: string;
  detail?: string;
  tone?: 'gold' | 'good' | 'bad' | 'info';
}

interface Store {
  state: GameState;
  today: string;
  loaded: boolean;
  serverOk: boolean;
  sync: SyncStatus;
  toasts: Toast[];
  packReveal: PackResult | null;
  levelUp: { level: number; rank: string } | null;

  init: () => Promise<void>;
  refreshToday: () => void;
  update: (fn: (s: GameState) => GameState) => void;
  toast: (t: Omit<Toast, 'id'>) => void;
  dismissToast: (id: string) => void;
  setLevelUp: (v: Store['levelUp']) => void;

  createHero: (p: Omit<Profile, 'createdAt'>) => void;
  updateProfile: (p: Partial<Profile>) => void;

  addFood: (e: Omit<FoodEntry, 'id' | 'loggedAt'>) => void;
  updateFood: (id: string, patch: Partial<FoodEntry>) => void;
  removeFood: (id: string) => void;
  saveCustomFood: (f: Omit<FoodItem, 'id' | 'custom'>) => void;
  removeCustomFood: (id: string) => void;

  setSteps: (date: string, steps: number) => void;
  logWeight: (date: string, weight: number | null) => void;
  sealDay: (date: string) => void;
  unsealDay: (date: string) => void;

  updateSession: (date: string, fn: (s: Session) => Session) => void;
  addExercise: (date: string, exerciseId: string, sets?: ExerciseEntry['sets']) => void;
  addCardio: (date: string, c: Omit<CardioEntry, 'id'>) => void;

  claim: (id: string) => AppliedReward | null;
  claimAll: () => AppliedReward[];
  buy: (type: PackType) => boolean;
  open: (type: PackType) => PackResult | null;
  closeReveal: () => void;
  craft: (cardId: string) => boolean;
  setSquadSlot: (slot: number, cardId: string | null) => void;

  importSave: (raw: unknown) => void;
  resetAll: () => void;
}

let viewCache: { state: GameState; today: string; view: GameView } | null = null;

/** Memoized game view for the current state — every page reads from this. */
export function getView(state: GameState, today: string): GameView {
  if (viewCache && viewCache.state === state && viewCache.today === today) return viewCache.view;
  const view = computeGame(state, today);
  viewCache = { state, today, view };
  return view;
}

export function useView(): GameView {
  const state = useStore((s) => s.state);
  const today = useStore((s) => s.today);
  return getView(state, today);
}

const emptySession = (date: string): Session => ({ date, exercises: [], cardio: [] });

export const STARTER_GIFT = { id: 'starter', coins: 300, packs: ['silver', 'bronze', 'bronze'] as PackType[] };

export const useStore = create<Store>((set, get) => ({
  state: emptyState(),
  today: todayKey(),
  loaded: false,
  serverOk: false,
  sync: 'loading',
  toasts: [],
  packReveal: null,
  levelUp: null,

  init: async () => {
    const { state, serverOk } = await loadState();
    set({ state: state ?? emptyState(), loaded: true, serverOk, sync: serverOk ? 'server' : 'local' });
    // Make sure the server has the newest copy (e.g. if the local copy won).
    if (state && serverOk) saveState(state, (sync) => set({ sync }), serverOk);
    window.addEventListener('pagehide', flushOnExit);
  },

  refreshToday: () => {
    const t = todayKey();
    if (t !== get().today) set({ today: t });
  },

  update: (fn) => {
    const next = { ...fn(get().state), updatedAt: Date.now() };
    set({ state: next });
    saveState(next, (sync) => set({ sync }), get().serverOk);
  },

  toast: (t) => {
    const id = uid();
    set({ toasts: [...get().toasts, { ...t, id }].slice(-5) });
    setTimeout(() => get().dismissToast(id), 4200);
  },
  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
  setLevelUp: (levelUp) => set({ levelUp }),

  createHero: (p) => {
    const today = get().today;
    get().update((s) => ({
      ...s,
      profile: { ...p, createdAt: today },
      weighIns: [{ date: today, weight: p.startWeight }],
      wallet: { ...s.wallet, coins: s.wallet.coins + STARTER_GIFT.coins },
      packs: [...s.packs, ...STARTER_GIFT.packs],
      claims: {
        ...s.claims,
        starter: { id: 'starter', at: Date.now(), title: 'Starter gift', xp: 0, coins: STARTER_GIFT.coins, packs: STARTER_GIFT.packs },
      },
    }));
  },

  updateProfile: (p) => get().update((s) => (s.profile ? { ...s, profile: { ...s.profile, ...p } } : s)),

  addFood: (e) => get().update((s) => ({ ...s, foods: [...s.foods, { ...e, id: uid(), loggedAt: Date.now() }] })),
  updateFood: (id, patch) => get().update((s) => ({ ...s, foods: s.foods.map((f) => (f.id === id ? { ...f, ...patch } : f)) })),
  removeFood: (id) => get().update((s) => ({ ...s, foods: s.foods.filter((f) => f.id !== id) })),
  saveCustomFood: (f) =>
    get().update((s) => {
      const existing = s.customFoods.find((c) => c.name.toLowerCase() === f.name.toLowerCase());
      const item: FoodItem = { ...f, id: existing?.id ?? `my_${uid()}`, custom: true };
      return { ...s, customFoods: existing ? s.customFoods.map((c) => (c.id === existing.id ? item : c)) : [...s.customFoods, item] };
    }),
  removeCustomFood: (id) => get().update((s) => ({ ...s, customFoods: s.customFoods.filter((c) => c.id !== id) })),

  setSteps: (date, steps) =>
    get().update((s) => {
      const next = { ...s.steps };
      if (steps > 0) next[date] = Math.round(steps);
      else delete next[date];
      return { ...s, steps: next };
    }),
  logWeight: (date, weight) =>
    get().update((s) => {
      const rest = s.weighIns.filter((w) => w.date !== date);
      return { ...s, weighIns: weight && weight > 0 ? [...rest, { date, weight }].sort((a, b) => a.date.localeCompare(b.date)) : rest };
    }),
  sealDay: (date) => get().update((s) => ({ ...s, sealed: { ...s.sealed, [date]: Date.now() } })),
  unsealDay: (date) =>
    get().update((s) => {
      const sealed = { ...s.sealed };
      delete sealed[date];
      return { ...s, sealed };
    }),

  updateSession: (date, fn) =>
    get().update((s) => {
      const next = fn(s.sessions[date] ?? emptySession(date));
      const sessions = { ...s.sessions };
      if (next.exercises.length === 0 && next.cardio.length === 0 && !next.notes) delete sessions[date];
      else sessions[date] = next;
      return { ...s, sessions };
    }),
  addExercise: (date, exerciseId, sets) =>
    get().updateSession(date, (sess) => ({
      ...sess,
      exercises: [...sess.exercises, { id: uid(), exerciseId, sets: sets ?? [{ weight: 0, reps: 0 }] }],
    })),
  addCardio: (date, c) => get().updateSession(date, (sess) => ({ ...sess, cardio: [...sess.cardio, { ...c, id: uid() }] })),

  claim: (id) => {
    const { state, today } = get();
    const res = claimReward(state, getView(state, today), id);
    if (!res) return null;
    get().update(() => res.state);
    return res.applied;
  },
  claimAll: () => {
    const out: AppliedReward[] = [];
    // Claiming XP can unlock level rewards, so loop until nothing is left.
    for (let guard = 0; guard < 20; guard++) {
      const { state, today } = get();
      const view = getView(state, today);
      if (!view.claimable.length) break;
      let s = state;
      for (const r of view.claimable) {
        const res = claimReward(s, view, r.id);
        if (res) {
          s = res.state;
          out.push(res.applied);
        }
      }
      get().update(() => s);
    }
    return out;
  },
  buy: (type) => {
    const next = buyPack(get().state, type);
    if (!next) return false;
    get().update(() => next);
    return true;
  },
  open: (type) => {
    const res = openPack(get().state, type);
    if (!res) return null;
    get().update(() => res.state);
    set({ packReveal: res.result });
    return res.result;
  },
  closeReveal: () => set({ packReveal: null }),
  craft: (cardId) => {
    const next = craftCard(get().state, cardId);
    if (!next) return false;
    get().update(() => next);
    return true;
  },
  setSquadSlot: (slot, cardId) =>
    get().update((s) => {
      const squad = s.squad.map((c) => (c === cardId ? null : c));
      squad[slot] = cardId;
      return { ...s, squad };
    }),

  importSave: (raw) => {
    const next = normalizeState(raw);
    get().update(() => next);
  },
  resetAll: () => {
    clearLocal();
    get().update(() => emptyState());
  },
}));
