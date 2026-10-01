import { useEffect, type ReactNode } from 'react';
import type { PackType } from '../game/types';
import { PACKS } from '../game/cards';
import { fmt, pct } from '../lib/format';

export function Bar({
  value,
  max,
  tone = 'gold',
  size,
  label,
  zone,
}: {
  value: number;
  max: number;
  tone?: 'xp' | 'gold' | 'green' | 'red' | 'blue' | 'orange' | 'boss';
  size?: 'lg' | 'xl';
  label?: ReactNode;
  zone?: [number, number];
}) {
  const w = max > 0 ? pct(value / max) : 0;
  return (
    <div className={`bar ${size ?? ''}`} role="progressbar" aria-valuenow={Math.round(value)} aria-valuemax={Math.round(max)}>
      {zone && max > 0 && <div className="zone" style={{ left: `${pct(zone[0] / max)}%`, width: `${pct((zone[1] - zone[0]) / max)}%` }} />}
      <div className={`fill ${tone}`} style={{ width: `${w}%` }} />
      {label !== undefined && <div className="bar-label">{label}</div>}
    </div>
  );
}

export function Rewards({ xp, coins, packs }: { xp: number; coins: number; packs: PackType[] }) {
  return (
    <span className="rewards">
      {xp > 0 && <span className="xp">+{fmt(xp)} XP</span>}
      {coins > 0 && <span className="coin">🪙 {fmt(coins)}</span>}
      {packs.map((p, i) => (
        <span key={i} style={{ color: PACKS[p].color }}>
          📦 {PACKS[p].label}
        </span>
      ))}
    </span>
  );
}

export function Modal({ children, onClose, wide }: { children: ReactNode; onClose?: () => void; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog">
        {children}
      </div>
    </div>
  );
}

export function Tile({ k, v, sub }: { k: string; v: ReactNode; sub?: ReactNode }) {
  return (
    <div className="tile">
      <div className="k">{k}</div>
      <div className="v">{v}</div>
      {sub && <div className="small muted">{sub}</div>}
    </div>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  step,
  min,
  placeholder,
  suffix,
  testId,
}: {
  label?: string;
  value: number | '' | null | undefined;
  onChange: (n: number | '') => void;
  step?: number;
  min?: number;
  placeholder?: string;
  suffix?: string;
  testId?: string;
}) {
  const input = (
    <input
      type="number"
      inputMode="decimal"
      value={value ?? ''}
      step={step ?? 'any'}
      min={min}
      placeholder={placeholder}
      data-testid={testId}
      onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
    />
  );
  if (!label) return input;
  return (
    <label className="field">
      <span>
        {label}
        {suffix && <span className="dim"> ({suffix})</span>}
      </span>
      {input}
    </label>
  );
}
