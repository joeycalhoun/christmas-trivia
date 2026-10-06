import { describe, expect, it } from 'vitest';
import { ALL_SLOTS, SECTIONS } from '../src/bank';
import { figureKey } from '../src/bank/pattern';
import { applyPoints, polyKey } from '../src/bank/spatial';
import { letterSeriesSpecs } from '../src/bank/logical';
import { normalizeText, scoreResponse } from '../src/engine/scoring';
import type { Figure, Question, Response } from '../src/engine/types';

const all: Question[] = ALL_SLOTS.flatMap((s) => Array.from({ length: s.variants }, (_, v) => s.build(v)));

/** The response a perfect test-taker would give. */
function idealResponse(q: Question): Response {
  const a = q.answer;
  switch (a.kind) {
    case 'choice':
      return { kind: 'choice', index: a.correct };
    case 'text':
      return { kind: 'text', value: a.accept[0] };
    case 'multi':
      return { kind: 'multi', indices: a.correct };
    case 'grid':
      return { kind: 'grid', cells: a.cells };
  }
}

describe('question bank', () => {
  it('has the expected shape', () => {
    expect(ALL_SLOTS.length).toBe(35);
    for (const s of SECTIONS) expect(ALL_SLOTS.some((x) => x.section === s.id)).toBe(true);
    expect(ALL_SLOTS.filter((s) => s.quick).length).toBeGreaterThanOrEqual(12);
    for (const s of ALL_SLOTS) expect(s.variants).toBeGreaterThanOrEqual(6);
  });

  it('builds every variant with a unique id and sane fields', () => {
    const ids = new Set(all.map((q) => q.id));
    expect(ids.size).toBe(all.length);
    for (const q of all) {
      expect(q.prompt.length, q.id).toBeGreaterThan(5);
      expect(q.explanation.length, q.id).toBeGreaterThan(5);
      expect(q.timeLimit, q.id).toBeGreaterThanOrEqual(15);
      if (q.memorize) expect(q.memorize.seconds).toBeGreaterThanOrEqual(3);
    }
  });

  it('gives full credit to the intended answer for every item', () => {
    for (const q of all) expect(scoreResponse(q, idealResponse(q)), q.id).toBe(1);
  });

  it('has distinct choice options with a valid answer key', () => {
    for (const q of all) {
      const a = q.answer;
      if (a.kind !== 'choice') continue;
      expect(a.options.length, q.id).toBeGreaterThanOrEqual(4);
      expect(a.correct).toBeGreaterThanOrEqual(0);
      expect(a.correct).toBeLessThan(a.options.length);
      const keys = a.options.map((o) => (o.visual ? JSON.stringify(o.visual) : o.label.toLowerCase()));
      expect(new Set(keys).size, q.id).toBe(keys.length);
      // Any wrong option scores zero.
      a.options.forEach((_, i) => {
        if (i !== a.correct) expect(scoreResponse(q, { kind: 'choice', index: i })).toBe(0);
      });
    }
  });

  it('accepts only normalizable text answers', () => {
    for (const q of all) {
      if (q.answer.kind !== 'text') continue;
      for (const x of q.answer.accept) expect(normalizeText(x, q.answer.mode), q.id).not.toBe('');
      expect(scoreResponse(q, { kind: 'text', value: '' })).toBe(0);
    }
  });

  it('uses real anagrams', () => {
    const sort = (s: string) => s.toLowerCase().split('').sort().join('');
    for (const q of all.filter((x) => x.slotId === 'verbal.anagram')) {
      const scrambled = q.prompt.match(/letters ([A-Z]+)/)![1];
      const a = q.answer;
      if (a.kind !== 'text') throw new Error('anagram must be text');
      expect(sort(scrambled), q.id).toBe(sort(a.accept[0]));
      expect(scrambled.toLowerCase()).not.toBe(a.accept[0]);
    }
  });

  it('has letter series answers that fit the alphabet', () => {
    for (const s of letterSeriesSpecs) expect(s.next).toMatch(/^[A-Z]+$/);
  });

  it('shows the memory stimulus that the answer depends on', () => {
    for (const q of all.filter((x) => x.slotId.startsWith('memory.digits'))) {
      const stim = q.memorize!.stimulus;
      if (stim.kind !== 'text' || q.answer.kind !== 'text') throw new Error(q.id);
      const shown = stim.text.replace(/\s/g, '');
      const expected = q.slotId.endsWith('backward') ? shown.split('').reverse().join('') : shown;
      expect(q.answer.accept[0]).toBe(expected);
    }
    for (const q of all.filter((x) => x.slotId === 'memory.word-list')) {
      const stim = q.memorize!.stimulus;
      if (stim.kind !== 'words' || q.answer.kind !== 'multi') throw new Error(q.id);
      const a = q.answer;
      expect(a.correct.map((i) => a.options[i]).sort()).toEqual([...stim.words].sort());
      expect(new Set(a.options).size).toBe(16);
    }
    for (const q of all.filter((x) => x.slotId === 'memory.grid')) {
      const stim = q.memorize!.stimulus;
      if (stim.kind !== 'grid' || q.answer.kind !== 'grid') throw new Error(q.id);
      expect(q.answer.cells).toEqual(stim.cells);
      expect(new Set(stim.cells).size).toBe(7);
    }
  });
});

/** Independently solve a matrix: every rule consistent with the 8 known cells must predict the same 9th cell. */
function solveMatrix(cells: (Figure | null)[]): Figure {
  const at = (r: number, c: number) => cells[r * 3 + c]!;
  const solution = {} as Record<string, string | number>;
  for (const attr of ['shape', 'count', 'fill', 'size'] as const) {
    const v = (r: number, c: number) => at(r, c)[attr];
    const predictions = new Set<string | number>();
    // constant
    const known = cells.filter(Boolean).map((f) => f![attr]);
    if (new Set(known).size === 1) predictions.add(known[0]);
    // row: fixed within each row
    if ([0, 1].every((r) => v(r, 0) === v(r, 1) && v(r, 1) === v(r, 2)) && v(2, 0) === v(2, 1)) predictions.add(v(2, 0));
    // progression: same sequence along every row
    if ([0, 1, 2].every((c) => (c === 2 ? v(0, 2) === v(1, 2) : v(0, c) === v(1, c) && v(1, c) === v(2, c)))) predictions.add(v(0, 2));
    // rotate / rotateBack: rows are cyclic shifts of row 0
    const row0 = [v(0, 0), v(0, 1), v(0, 2)];
    if (new Set(row0).size === 3) {
      for (const dir of [1, -1]) {
        const fits = [1, 2].every((r) => [0, 1, 2].every((c) => (r === 2 && c === 2) || v(r, c) === row0[(((c + dir * r) % 3) + 3) % 3]));
        if (fits) predictions.add(row0[(((2 + dir * 2) % 3) + 3) % 3]);
      }
    }
    expect(predictions.size, `${attr} must have exactly one consistent prediction`).toBe(1);
    solution[attr] = [...predictions][0];
  }
  return solution as unknown as Figure;
}

describe('matrix puzzles', () => {
  it('each has exactly one defensible answer, and it is the keyed one', () => {
    const matrices = all.filter((q) => q.visual?.kind === 'matrix');
    expect(matrices.length).toBe(60);
    for (const q of matrices) {
      if (q.visual?.kind !== 'matrix' || q.answer.kind !== 'choice') throw new Error(q.id);
      const solved = solveMatrix(q.visual.cells);
      const keyed = q.answer.options[q.answer.correct].visual;
      if (keyed?.kind !== 'figure') throw new Error(q.id);
      expect(figureKey(keyed.figure), q.id).toBe(figureKey(solved));
      expect(q.answer.options.length).toBe(6);
    }
  });
});

describe('spatial items', () => {
  const rotationsOf = (m: { cells: [number, number][]; mark?: [number, number] }) =>
    [0, 1, 2, 3].map((k) => polyKey(applyPoints(m, Array.from({ length: k }, () => ([x, y]: [number, number]) => [-y, x] as [number, number]))));

  it('rotation items have exactly one rotated copy among the options', () => {
    for (const q of all.filter((x) => x.slotId.startsWith('spatial.rotate'))) {
      if (q.visual?.kind !== 'poly' || q.answer.kind !== 'choice') throw new Error(q.id);
      const target = rotationsOf({ cells: q.visual.cells, mark: q.visual.mark });
      const matches = q.answer.options.map((o, i) => (o.visual?.kind === 'poly' && target.includes(polyKey({ cells: o.visual.cells, mark: o.visual.mark })) ? i : -1)).filter((i) => i >= 0);
      expect(matches, q.id).toEqual([q.answer.correct]);
    }
  });

  it('mirror items have exactly one left–right reflection among the options', () => {
    for (const q of all.filter((x) => x.slotId === 'spatial.mirror')) {
      if (q.visual?.kind !== 'poly' || q.answer.kind !== 'choice') throw new Error(q.id);
      const reflected = polyKey(applyPoints({ cells: q.visual.cells }, [([x, y]) => [-x, y]]));
      const matches = q.answer.options.map((o, i) => (o.visual?.kind === 'poly' && polyKey({ cells: o.visual.cells }) === reflected ? i : -1)).filter((i) => i >= 0);
      expect(matches, q.id).toEqual([q.answer.correct]);
    }
  });
});
