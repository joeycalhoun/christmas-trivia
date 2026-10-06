import type { Difficulty, Poly, Question, Slot, Visual } from '../engine/types';
import { type Rng, pick, seeded, shuffle } from '../engine/rng';

export function normalize(cells: Poly): Poly {
  const minX = Math.min(...cells.map((c) => c[0]));
  const minY = Math.min(...cells.map((c) => c[1]));
  return cells
    .map(([x, y]) => [x - minX, y - minY] as [number, number])
    .sort((a, b) => a[1] - b[1] || a[0] - b[0]);
}

/** Quarter turn clockwise (screen coordinates, y down). */
export const rotate = (cells: Poly): Poly => normalize(cells.map(([x, y]) => [-y, x]));
export const mirror = (cells: Poly): Poly => normalize(cells.map(([x, y]) => [-x, y]));
export const rotateN = (cells: Poly, n: number): Poly => {
  let out = normalize(cells);
  for (let i = 0; i < ((n % 4) + 4) % 4; i++) out = rotate(out);
  return out;
};

export interface Marked {
  cells: Poly;
  mark?: [number, number];
}

export const polyKey = (m: Marked) => JSON.stringify(normalize(m.cells)) + (m.mark ? `@${m.mark.join(',')}` : '');

/** Rigid transforms expressed per point so a marked cell can be tracked. */
type PointFn = (p: [number, number]) => [number, number];
const ROT: PointFn = ([x, y]) => [-y, x];
const MIR: PointFn = ([x, y]) => [-x, y];

export function applyPoints(m: Marked, fns: PointFn[]): Marked {
  const run = (p: [number, number]) => fns.reduce((acc, f) => f(acc), p);
  const moved = m.cells.map(run);
  const minX = Math.min(...moved.map((c) => c[0]));
  const minY = Math.min(...moved.map((c) => c[1]));
  const shift = ([x, y]: [number, number]): [number, number] => [x - minX, y - minY];
  const cells = normalize(moved.map(shift));
  return m.mark ? { cells, mark: shift(run(m.mark)) } : { cells };
}

const rotations = (k: number): PointFn[] => Array.from({ length: k }, () => ROT);

/** Grow a random polyomino with no rotational symmetry whose mirror image is not a rotation of it. */
export function randomChiralPoly(rng: Rng, n: number): Poly {
  for (;;) {
    const cells: Poly = [[0, 0]];
    const has = (x: number, y: number) => cells.some((c) => c[0] === x && c[1] === y);
    while (cells.length < n) {
      const [x, y] = pick(rng, cells);
      const [dx, dy] = pick(rng, [[1, 0], [-1, 0], [0, 1], [0, -1]] as const);
      if (!has(x + dx, y + dy)) cells.push([x + dx, y + dy]);
    }
    const base = normalize(cells);
    const w = Math.max(...base.map((c) => c[0])) + 1;
    const h = Math.max(...base.map((c) => c[1])) + 1;
    if (w > 4 || h > 4) continue; // keep shapes compact enough to draw clearly
    const rots = [0, 1, 2, 3].map((k) => JSON.stringify(rotateN(base, k)));
    if (new Set(rots).size !== 4) continue;
    const mirrored = [0, 1, 2, 3].map((k) => JSON.stringify(rotateN(mirror(base), k)));
    if (mirrored.some((m) => rots.includes(m))) continue;
    return base;
  }
}

const vis = (m: Marked): Visual => ({ kind: 'poly', cells: m.cells, mark: m.mark });
const ANGLE = ['0°', '90° clockwise', '180°', '90° counter-clockwise'];

interface SpatialItem {
  prompt: string;
  target: Marked;
  correct: Marked;
  distractors: Marked[];
  explanation: string;
}

function rotationItem(rng: Rng, n: number, withMark: boolean): SpatialItem {
  const base = randomChiralPoly(rng, n);
  const target: Marked = withMark ? { cells: base, mark: pick(rng, base) } : { cells: base };
  const k = pick(rng, [1, 2, 3]);
  const correct = applyPoints(target, rotations(k));
  const distractors: Marked[] = [];
  for (const j of shuffle(rng, [0, 1, 2, 3])) distractors.push(applyPoints(target, [MIR, ...rotations(j)]));
  if (withMark) {
    // Same outline and turn, but the dot is on the wrong square.
    const other = pick(rng, base.filter((c) => c[0] !== target.mark![0] || c[1] !== target.mark![1]));
    distractors.unshift(applyPoints({ cells: base, mark: other }, rotations(k)));
  }
  return {
    prompt: withMark
      ? 'Which option is the same shape, with the dot in the same place, only rotated? Flipped shapes do not count.'
      : 'Which option is the same shape, only rotated? Flipped (mirrored) shapes do not count.',
    target,
    correct,
    distractors,
    explanation: `The correct option is the original turned ${ANGLE[k]}. The others are mirror images${withMark ? ' or have the dot moved' : ''}, which no rotation can produce.`,
  };
}

function mirrorItem(rng: Rng, n: number): SpatialItem {
  const base = randomChiralPoly(rng, n);
  const target: Marked = { cells: base };
  const correct = applyPoints(target, [MIR]);
  return {
    prompt: 'A mirror stands upright to the right of this shape. Which option shows its reflection?',
    target,
    correct,
    distractors: [target, applyPoints(target, rotations(1)), applyPoints(target, rotations(2)), applyPoints(target, [MIR, ROT])],
    explanation: 'A mirror on the right swaps left and right but keeps top and bottom. The other options are rotations of the original or a turned reflection.',
  };
}

function spatialSlot(
  id: string,
  difficulty: Difficulty,
  timeLimit: number,
  make: (rng: Rng) => SpatialItem,
  optionCount: number,
  title: string,
  quick = false,
): Slot {
  return {
    id,
    section: 'spatial',
    difficulty,
    variants: 10,
    quick,
    build(variant): Question {
      const item = make(seeded(id, variant));
      const seen = new Set([polyKey(item.correct)]);
      const opts: Marked[] = [item.correct];
      for (const d of item.distractors) {
        if (opts.length >= optionCount) break;
        if (!seen.has(polyKey(d))) {
          seen.add(polyKey(d));
          opts.push(d);
        }
      }
      return {
        id: `${id}#${variant}`,
        slotId: id,
        variant,
        section: 'spatial',
        difficulty,
        title,
        prompt: item.prompt,
        visual: vis(item.target),
        timeLimit,
        answer: { kind: 'choice', options: opts.map((o) => ({ label: 'Shape', visual: vis(o) })), correct: 0 },
        explanation: item.explanation,
      };
    },
  };
}

export const spatialSlots: Slot[] = [
  spatialSlot('spatial.rotate-1', 2, 40, (rng) => rotationItem(rng, 5, false), 4, 'Rotation', true),
  spatialSlot('spatial.mirror', 3, 45, (rng) => mirrorItem(rng, 6), 5, 'Reflection'),
  spatialSlot('spatial.rotate-2', 3, 50, (rng) => rotationItem(rng, 6, false), 5, 'Rotation'),
  spatialSlot('spatial.rotate-3', 4, 60, (rng) => rotationItem(rng, 7, true), 5, 'Rotation'),
];
