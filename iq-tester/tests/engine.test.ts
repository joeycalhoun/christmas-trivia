import { describe, expect, it } from 'vitest';
import { ALL_SLOTS } from '../src/bank';
import { buildTest, freshFormsLeft, slotsFor, type SeenMap } from '../src/engine/builder';
import { classify, normalizeText, percentile, scoreResponse, summarize, toIQ } from '../src/engine/scoring';
import type { ItemResult, Question } from '../src/engine/types';

describe('test assembly', () => {
  it('never repeats an item until every alternate form is used', () => {
    for (const form of ['full', 'quick'] as const) {
      let seen: SeenMap = {};
      const fresh = freshFormsLeft(form, seen);
      expect(fresh).toBeGreaterThanOrEqual(6);
      const taken = new Set<string>();
      for (let i = 0; i < fresh; i++) {
        const t = buildTest(form, seen, 1000 + i);
        for (const q of t.questions) {
          expect(taken.has(q.id), `${form} repeat of ${q.id} on take ${i + 1}`).toBe(false);
          taken.add(q.id);
        }
        seen = t.seen;
        expect(freshFormsLeft(form, seen)).toBe(fresh - i - 1);
      }
      // After the bank is exhausted it still builds, reusing the oldest variants.
      const again = buildTest(form, seen, 99);
      expect(again.questions.length).toBe(slotsFor(form).length);
    }
  });

  it('keeps the answer key correct after shuffling options', () => {
    for (let seed = 0; seed < 20; seed++) {
      const { questions } = buildTest('full', {}, seed);
      for (const q of questions) {
        const slot = ALL_SLOTS.find((s) => s.id === q.slotId)!;
        const original = slot.build(q.variant);
        if (q.answer.kind === 'choice' && original.answer.kind === 'choice') {
          expect(q.answer.options[q.answer.correct]).toEqual(original.answer.options[original.answer.correct]);
        }
      }
    }
  });

  it('orders the full form by section', () => {
    const { questions } = buildTest('full', {}, 1);
    const order = questions.map((q) => q.section).filter((s, i, a) => a[i - 1] !== s);
    expect(order).toEqual(['verbal', 'numerical', 'logical', 'pattern', 'spatial', 'memory']);
  });
});

describe('scoring', () => {
  const q = (answer: Question['answer']): Question => ({
    id: 'x#0', slotId: 'x', variant: 0, section: 'verbal', difficulty: 1, title: 't', prompt: 'p', timeLimit: 30, explanation: 'e', answer,
  });

  it('normalizes typed answers', () => {
    expect(normalizeText(' $1,200 ', 'number')).toBe('1200');
    expect(normalizeText('20.0', 'number')).toBe('20');
    expect(normalizeText('Kanga-roo ', 'word')).toBe('kangaroo');
    expect(normalizeText('2 7 9 a b k', 'sequence')).toBe('279abk');
    expect(normalizeText('Seven purple OWLS, guard!', 'phrase')).toBe('7 purple owls guard');
  });

  it('gives half credit for a phrase with one slip', () => {
    const item = q({ kind: 'text', accept: ['Seven purple owls guard the silver gate at dawn'], mode: 'phrase' });
    expect(scoreResponse(item, { kind: 'text', value: 'seven purple owls guard the silver gate at dawn.' })).toBe(1);
    expect(scoreResponse(item, { kind: 'text', value: '7 purple owls guard the silver gate at dawn' })).toBe(1);
    expect(scoreResponse(item, { kind: 'text', value: 'seven purple owls guard the gold gate at dawn' })).toBe(0.5);
    expect(scoreResponse(item, { kind: 'text', value: 'purple owls at dawn' })).toBe(0);
  });

  it('penalizes false alarms in select-all items', () => {
    const item = q({ kind: 'multi', options: ['a', 'b', 'c', 'd'], correct: [0, 1] });
    expect(scoreResponse(item, { kind: 'multi', indices: [0, 1] })).toBe(1);
    expect(scoreResponse(item, { kind: 'multi', indices: [0] })).toBe(0.5);
    expect(scoreResponse(item, { kind: 'multi', indices: [0, 1, 2, 3] })).toBe(0);
    expect(scoreResponse(item, { kind: 'multi', indices: [] })).toBe(0);
  });

  it('maps scores onto the IQ scale', () => {
    expect(toIQ(0)).toBe(57);
    expect(toIQ(1)).toBe(140);
    expect(toIQ(0.52)).toBe(100);
    expect(toIQ(0.3)).toBeLessThan(toIQ(0.6));
    expect(percentile(100)).toBeCloseTo(50, 1);
    expect(percentile(130)).toBeCloseTo(97.7, 0);
    expect(classify(100)).toBe('Average');
    expect(classify(131)).toBe('Extremely high');
  });

  it('summarizes a run', () => {
    const results: ItemResult[] = [
      { questionId: 'a', slotId: 'a', section: 'verbal', difficulty: 1, response: { kind: 'choice', index: 0 }, credit: 1, seconds: 10, timedOut: false },
      { questionId: 'b', slotId: 'b', section: 'memory', difficulty: 3, response: { kind: 'text', value: '' }, credit: 0, seconds: 30, timedOut: true },
    ];
    const s = summarize(results, ['verbal', 'memory']);
    expect(s.correct).toBe(1);
    expect(s.timedOut).toBe(1);
    expect(s.fraction).toBeCloseTo(1 / 3);
    expect(s.sections.map((x) => x.section)).toEqual(['verbal', 'memory']);
    expect(s.low).toBeLessThan(s.iq);
  });
});
