import type { Difficulty, Figure, FillStyle, Question, ShapeName, SizeName, Slot } from '../engine/types';
import { type Rng, pick, sample, seeded, shuffle } from '../engine/rng';

export const SHAPES: ShapeName[] = ['circle', 'square', 'triangle', 'diamond', 'pentagon', 'hexagon', 'star', 'cross'];
export const FILLS: FillStyle[] = ['outline', 'solid', 'striped'];
export const SIZES: SizeName[] = ['small', 'medium', 'large'];
export const COUNTS = [1, 2, 3, 4];

type Attr = 'shape' | 'count' | 'fill' | 'size';
/**
 * How an attribute behaves across the 3×3 grid:
 *  constant    – the same in every cell
 *  row         – fixed within a row, different in each row
 *  progression – changes in the same order along every row
 *  rotate      – each row holds all three values, shifted one place per row
 *  rotateBack  – as rotate, shifted the other way
 */
type Rule = 'constant' | 'row' | 'progression' | 'rotate' | 'rotateBack';

const RULE_TEXT: Record<Rule, (attr: string) => string> = {
  constant: (a) => `The ${a} is the same in every cell.`,
  row: (a) => `Each row has its own ${a}.`,
  progression: (a) => `The ${a} changes in the same order along every row.`,
  rotate: (a) => `Each row contains all three ${a}s, shifted one place along per row.`,
  rotateBack: (a) => `Each row contains all three ${a}s, shifted one place back per row.`,
};

const ATTR_NAME: Record<Attr, string> = { shape: 'shape', count: 'number of figures', fill: 'shading', size: 'size' };

/** Rules used at each difficulty, with the attributes they may apply to. */
const PLANS: Record<number, Rule[][]> = {
  // One attribute moves.
  1: [['progression'], ['row'], ['rotate']],
  // Two attributes move, in simple ways.
  2: [['progression', 'row'], ['rotate', 'row'], ['progression', 'progression']],
  // Two attributes, both distributed.
  3: [['rotate', 'rotateBack'], ['rotate', 'progression'], ['rotate', 'rotate']],
  // Three attributes.
  4: [['rotate', 'rotateBack', 'progression'], ['rotate', 'progression', 'row']],
  // All four attributes move.
  5: [['rotate', 'rotateBack', 'progression', 'rotate'], ['rotateBack', 'rotate', 'rotate', 'progression']],
};

interface AttrPlan {
  attr: Attr;
  rule: Rule;
  values: (string | number)[]; // three values (one when constant)
}

function domain(attr: Attr): (string | number)[] {
  return attr === 'shape' ? SHAPES : attr === 'count' ? COUNTS : attr === 'fill' ? FILLS : SIZES;
}

function valueAt(p: AttrPlan, r: number, c: number) {
  switch (p.rule) {
    case 'constant':
      return p.values[0];
    case 'row':
      return p.values[r];
    case 'progression':
      return p.values[c];
    case 'rotate':
      return p.values[(c + r) % 3];
    case 'rotateBack':
      return p.values[(c - r + 3) % 3];
  }
}

export const figureKey = (f: Figure) => `${f.shape}|${f.count}|${f.fill}|${f.size}`;

export function buildMatrix(rng: Rng, level: number) {
  const rules = pick(rng, PLANS[level]);
  const attrs = shuffle(rng, ['shape', 'count', 'fill', 'size'] as Attr[]);
  const plans: AttrPlan[] = attrs.map((attr, i) => {
    const rule: Rule = rules[i] ?? 'constant';
    const dom = domain(attr);
    let values: (string | number)[];
    if (rule === 'constant') {
      // Keep constant figures readable: medium/large and a modest count.
      const choices = attr === 'size' ? ['medium', 'large'] : attr === 'count' ? [1, 2] : dom;
      values = [pick(rng, choices)];
    } else if (rule === 'progression' && (attr === 'count' || attr === 'size')) {
      // Ordered attributes progress in order, up or down.
      const ordered = attr === 'count' ? [1, 2, 3] : SIZES;
      values = rng() < 0.5 ? ordered.slice() : ordered.slice().reverse();
    } else {
      values = sample(rng, attr === 'count' ? [1, 2, 3] : dom, 3);
    }
    return { attr, rule, values };
  });

  const cellAt = (r: number, c: number): Figure => {
    const f = { shape: 'circle', count: 1, fill: 'outline', size: 'medium' } as Figure;
    for (const p of plans) (f as unknown as Record<Attr, string | number>)[p.attr] = valueAt(p, r, c);
    return f;
  };

  const cells: (Figure | null)[] = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) cells.push(r === 2 && c === 2 ? null : cellAt(r, c));
  const answer = cellAt(2, 2);

  // Distractors: the answer with one attribute changed, preferring values that appear in the grid,
  // plus the neighbouring cells (a common wrong pick).
  const options = new Map<string, Figure>([[figureKey(answer), answer]]);
  const candidates: Figure[] = [cellAt(2, 1), cellAt(1, 2)];
  for (const p of shuffle(rng, plans)) {
    const alts = p.rule === 'constant' ? domain(p.attr) : p.values;
    for (const v of shuffle(rng, alts)) {
      if (v === answer[p.attr]) continue;
      candidates.push({ ...answer, [p.attr]: v });
    }
  }
  for (const p of shuffle(rng, plans)) {
    for (const v of shuffle(rng, domain(p.attr))) {
      if (v === answer[p.attr]) continue;
      candidates.push({ ...answer, [p.attr]: v });
    }
  }
  for (const cand of candidates) {
    if (options.size >= 6) break;
    if (!options.has(figureKey(cand))) options.set(figureKey(cand), cand);
  }

  const explanation = plans
    .filter((p) => p.rule !== 'constant')
    .map((p) => RULE_TEXT[p.rule](ATTR_NAME[p.attr]))
    .join(' ');
  return { cells, answer, options: [...options.values()], explanation };
}

function describe(f: Figure) {
  const n = f.count === 1 ? 'one' : f.count === 2 ? 'two' : f.count === 3 ? 'three' : 'four';
  return `${n} ${f.size} ${f.fill} ${f.shape}${f.count > 1 ? 's' : ''}`;
}

function matrixSlot(n: number, level: Difficulty, timeLimit: number, quick = false): Slot {
  const id = `pattern.matrix-${n}`;
  return {
    id,
    section: 'pattern',
    difficulty: level,
    variants: 10,
    quick,
    build(variant): Question {
      const m = buildMatrix(seeded(id, variant), level);
      return {
        id: `${id}#${variant}`,
        slotId: id,
        variant,
        section: 'pattern',
        difficulty: level,
        title: 'Matrix',
        prompt: 'Which figure completes the pattern?',
        visual: { kind: 'matrix', cells: m.cells },
        timeLimit,
        answer: { kind: 'choice', options: m.options.map((f) => ({ label: describe(f), visual: { kind: 'figure', figure: f } })), correct: 0 },
        explanation: `${m.explanation} The missing cell holds ${describe(m.answer)}.`,
      };
    },
  };
}

export const patternSlots: Slot[] = [
  matrixSlot(1, 1, 45, true),
  matrixSlot(2, 2, 60),
  matrixSlot(3, 3, 75, true),
  matrixSlot(4, 3, 75),
  matrixSlot(5, 4, 90),
  matrixSlot(6, 5, 105),
];
