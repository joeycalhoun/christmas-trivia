import { useEffect, useRef, useState } from 'react';

/** Milliseconds left until `deadline`; calls onExpire once when it passes. Uses wall-clock time, so hiding the tab does not pause it. */
export function useCountdown(deadline: number, onExpire: () => void): number {
  const [now, setNow] = useState(() => Date.now());
  const cb = useRef(onExpire);
  cb.current = onExpire;
  useEffect(() => {
    let fired = false;
    const tick = () => {
      const t = Date.now();
      setNow(t);
      if (t >= deadline && !fired) {
        fired = true;
        cb.current();
      }
    };
    tick();
    const id = window.setInterval(tick, 100);
    return () => window.clearInterval(id);
  }, [deadline]);
  return Math.max(0, deadline - now);
}

export function formatClock(ms: number): string {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
