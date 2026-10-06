import React, { useId } from 'react';
import type { Figure, Poly, ShapeName, Visual } from '../engine/types';

const SIZE_SCALE = { small: 0.5, medium: 0.74, large: 1 } as const;

/** Where copies sit inside a 100×100 cell, and how big each may be. */
const LAYOUTS: Record<number, { at: [number, number][]; r: number }> = {
  1: { at: [[50, 50]], r: 32 },
  2: { at: [[29, 50], [71, 50]], r: 18 },
  3: { at: [[50, 29], [29, 70], [71, 70]], r: 16 },
  4: { at: [[29, 29], [71, 29], [29, 71], [71, 71]], r: 16 },
};

function polygon(n: number, r: number, rot = -90): string {
  return Array.from({ length: n }, (_, i) => {
    const a = ((rot + (360 / n) * i) * Math.PI) / 180;
    return `${(r * Math.cos(a)).toFixed(2)},${(r * Math.sin(a)).toFixed(2)}`;
  }).join(' ');
}

function star(r: number): string {
  return Array.from({ length: 10 }, (_, i) => {
    const rr = i % 2 === 0 ? r : r * 0.45;
    const a = ((-90 + 36 * i) * Math.PI) / 180;
    return `${(rr * Math.cos(a)).toFixed(2)},${(rr * Math.sin(a)).toFixed(2)}`;
  }).join(' ');
}

function ShapePath({ shape, r, className, fill }: { shape: ShapeName; r: number; className: string; fill?: string }) {
  const p = { className, style: fill ? { fill } : undefined };
  switch (shape) {
    case 'circle':
      return <circle r={r * 0.92} {...p} />;
    case 'square':
      return <rect x={-r * 0.8} y={-r * 0.8} width={r * 1.6} height={r * 1.6} {...p} />;
    case 'triangle':
      return <polygon points={polygon(3, r * 1.08)} transform={`translate(0 ${r * 0.16})`} {...p} />;
    case 'diamond':
      return <polygon points={`0,${-r * 1.05} ${r * 0.78},0 0,${r * 1.05} ${-r * 0.78},0`} {...p} />;
    case 'pentagon':
      return <polygon points={polygon(5, r)} transform={`translate(0 ${r * 0.06})`} {...p} />;
    case 'hexagon':
      return <polygon points={polygon(6, r, 0)} {...p} />;
    case 'star':
      return <polygon points={star(r * 1.1)} transform={`translate(0 ${r * 0.06})`} {...p} />;
    case 'cross': {
      const a = r * 0.34;
      const b = r * 0.95;
      return <polygon points={`${-a},${-b} ${a},${-b} ${a},${-a} ${b},${-a} ${b},${a} ${a},${a} ${a},${b} ${-a},${b} ${-a},${a} ${-b},${a} ${-b},${-a} ${-a},${-a}`} {...p} />;
    }
  }
}

/** Hatch pattern for striped fills; one per SVG so ids stay unique. */
function Hatch({ id }: { id: string }) {
  return (
    <defs>
      <pattern id={id} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="6" height="6" className="fig-hatch-bg" />
        <line x1="0" y1="0" x2="0" y2="6" className="fig-hatch-line" />
      </pattern>
    </defs>
  );
}

function FigureCell({ figure, hatchId }: { figure: Figure; hatchId: string }) {
  const layout = LAYOUTS[figure.count] ?? LAYOUTS[1];
  const r = layout.r * SIZE_SCALE[figure.size];
  const cls = `fig fig-${figure.fill}`;
  return (
    <>
      {layout.at.map(([x, y], i) => (
        <g key={i} transform={`translate(${x} ${y})`}>
          <ShapePath shape={figure.shape} r={r} className={cls} fill={figure.fill === 'striped' ? `url(#${hatchId})` : undefined} />
        </g>
      ))}
    </>
  );
}

const useSvgId = () => `h${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

export function FigureView({ figure, label }: { figure: Figure; label?: string }) {
  const id = useSvgId();
  return (
    <svg viewBox="0 0 100 100" className="figure-svg" role="img" aria-label={label}>
      <Hatch id={id} />
      <FigureCell figure={figure} hatchId={id} />
    </svg>
  );
}

export function MatrixView({ cells }: { cells: (Figure | null)[] }) {
  const id = useSvgId();
  return (
    <svg viewBox="-2 -2 304 304" className="matrix-svg" role="img" aria-label="A three by three grid of figures with the last cell missing">
      <Hatch id={id} />
      {cells.map((f, i) => {
        const x = (i % 3) * 100;
        const y = Math.floor(i / 3) * 100;
        return (
          <g key={i} transform={`translate(${x} ${y})`}>
            <rect width="100" height="100" className={f ? 'matrix-cell' : 'matrix-cell matrix-missing'} />
            {f ? (
              <FigureCell figure={f} hatchId={id} />
            ) : (
              <text x="50" y="52" className="matrix-q" textAnchor="middle" dominantBaseline="middle">
                ?
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

const UNIT = 20;
const BOX = 5 * UNIT; // shapes are at most 4 cells across; keep every option on the same scale

export function PolyView({ cells, mark, label }: { cells: Poly; mark?: [number, number]; label?: string }) {
  const w = (Math.max(...cells.map((c) => c[0])) + 1) * UNIT;
  const h = (Math.max(...cells.map((c) => c[1])) + 1) * UNIT;
  const ox = (BOX - w) / 2;
  const oy = (BOX - h) / 2;
  return (
    <svg viewBox={`0 0 ${BOX} ${BOX}`} className="poly-svg" role="img" aria-label={label ?? 'Shape made of squares'}>
      <g transform={`translate(${ox} ${oy})`}>
        {cells.map(([x, y]) => (
          <rect key={`${x},${y}`} x={x * UNIT} y={y * UNIT} width={UNIT} height={UNIT} className="poly-cell" />
        ))}
        {mark && <circle cx={mark[0] * UNIT + UNIT / 2} cy={mark[1] * UNIT + UNIT / 2} r={UNIT * 0.24} className="poly-mark" />}
      </g>
    </svg>
  );
}

export function VisualView({ visual, label }: { visual: Visual; label?: string }) {
  switch (visual.kind) {
    case 'matrix':
      return <MatrixView cells={visual.cells} />;
    case 'figure':
      return <FigureView figure={visual.figure} label={label} />;
    case 'poly':
      return <PolyView cells={visual.cells} mark={visual.mark} label={label} />;
  }
}

/** A size×size grid of squares, some lit. Used for spatial memory. */
export function GridView({
  size,
  lit,
  onToggle,
  marks,
  label,
}: {
  size: number;
  lit: number[];
  onToggle?: (i: number) => void;
  /** Review mode: show hits, misses and false alarms. */
  marks?: { correct: number[]; picked: number[] };
  label: string;
}) {
  return (
    <div className="grid-board" style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }} role="group" aria-label={label}>
      {Array.from({ length: size * size }, (_, i) => {
        let state = lit.includes(i) ? 'on' : 'off';
        if (marks) {
          const c = marks.correct.includes(i);
          const p = marks.picked.includes(i);
          state = c && p ? 'hit' : c ? 'miss' : p ? 'false' : 'off';
        }
        const common = { className: `grid-sq grid-${state}`, 'aria-label': `Row ${Math.floor(i / size) + 1}, column ${(i % size) + 1}` };
        return onToggle ? (
          <button key={i} type="button" {...common} aria-pressed={state === 'on'} onClick={() => onToggle(i)} />
        ) : (
          <span key={i} {...common} />
        );
      })}
    </div>
  );
}
