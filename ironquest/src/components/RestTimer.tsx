import { useEffect, useState } from 'react';
import { create } from 'zustand';

interface TimerState {
  endsAt: number | null;
  total: number;
  preset: number;
  start: (seconds?: number) => void;
  add: (seconds: number) => void;
  stop: () => void;
  setPreset: (s: number) => void;
}

const loadPreset = () => {
  try {
    return Number(localStorage.getItem('ironquest.rest')) || 90;
  } catch {
    return 90;
  }
};

export const useRestTimer = create<TimerState>((set, get) => ({
  endsAt: null,
  total: 90,
  preset: loadPreset(),
  start: (seconds) => {
    const s = seconds ?? get().preset;
    set({ endsAt: Date.now() + s * 1000, total: s });
  },
  add: (seconds) => {
    const { endsAt, total } = get();
    if (endsAt) set({ endsAt: endsAt + seconds * 1000, total: total + seconds });
  },
  stop: () => set({ endsAt: null }),
  setPreset: (s) => {
    try {
      localStorage.setItem('ironquest.rest', String(s));
    } catch {
      /* ignore */
    }
    set({ preset: s });
  },
}));

function chime() {
  try {
    navigator.vibrate?.([200, 100, 200]);
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [0, 0.25].forEach((t) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.18, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.2);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.22);
    });
  } catch {
    /* sound is a nice-to-have */
  }
}

/** Floating countdown shown while resting between sets. */
export function RestTimerChip() {
  const { endsAt, total, add, stop } = useRestTimer();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!endsAt) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [endsAt]);
  useEffect(() => {
    if (!endsAt) return;
    const ms = endsAt - Date.now();
    const id = setTimeout(() => {
      chime();
      setTimeout(() => useRestTimer.getState().endsAt === endsAt && stop(), 4000);
    }, Math.max(0, ms));
    return () => clearTimeout(id);
  }, [endsAt, stop]);
  if (!endsAt) return null;
  const left = Math.max(0, Math.ceil((endsAt - now) / 1000));
  const done = left === 0;
  return (
    <div className={`rest-chip ${done ? 'done' : ''}`} data-testid="rest-timer">
      <div className="rest-ring" style={{ ['--p' as string]: `${(1 - left / total) * 100}%` }}>
        <span>{done ? 'GO' : `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`}</span>
      </div>
      <div className="stack" style={{ gap: 4 }}>
        <b className="small">{done ? 'Rest over — next set!' : 'Resting…'}</b>
        <div className="row" style={{ gap: 4 }}>
          <button className="btn xs" onClick={() => add(30)}>
            +30s
          </button>
          <button className="btn xs ghost" onClick={stop}>
            {done ? 'Close' : 'Skip'}
          </button>
        </div>
      </div>
    </div>
  );
}
