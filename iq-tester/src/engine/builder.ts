import { ALL_SLOTS } from '../bank';
import { type Rng, makeRng, shuffle } from './rng';
import type { Question, Slot } from './types';

export type Form = 'full' | 'quick';

/** Variants already taken, per slot, oldest first. */
export type SeenMap = Record<string, number[]>;

export function slotsFor(form: Form, slots: Slot[] = ALL_SLOTS): Slot[] {
  return form === 'full' ? slots : slots.filter((s) => s.quick);
}

/** Choose a variant nobody has seen yet; once all are used, reuse the one seen longest ago. */
export function chooseVariant(slot: Slot, seen: number[], rng: Rng): number {
  const fresh = Array.from({ length: slot.variants }, (_, i) => i).filter((v) => !seen.includes(v));
  if (fresh.length) return fresh[Math.floor(rng() * fresh.length)];
  return seen[0];
}

/** How many more times this form can be taken before any item repeats. */
export function freshFormsLeft(form: Form, seen: SeenMap, slots: Slot[] = ALL_SLOTS): number {
  return Math.min(...slotsFor(form, slots).map((s) => s.variants - new Set(seen[s.id] ?? []).size));
}

/** Shuffle choice options (unless their order matters) and remap the correct index. */
export function shuffleOptions(q: Question, rng: Rng): Question {
  const a = q.answer;
  if (a.kind !== 'choice' || a.keepOrder) return q;
  const order = shuffle(rng, a.options.map((_, i) => i));
  return {
    ...q,
    answer: { ...a, options: order.map((i) => a.options[i]), correct: order.indexOf(a.correct) },
  };
}

export interface BuiltTest {
  questions: Question[];
  seen: SeenMap;
  formCode: string;
}

export function buildTest(form: Form, seen: SeenMap, seed: number, slots: Slot[] = ALL_SLOTS): BuiltTest {
  const rng = makeRng(seed);
  const nextSeen: SeenMap = { ...seen };
  const questions = slotsFor(form, slots).map((slot) => {
    const prior = seen[slot.id] ?? [];
    const variant = chooseVariant(slot, prior, rng);
    nextSeen[slot.id] = [...prior.filter((v) => v !== variant), variant];
    return shuffleOptions(slot.build(variant), rng);
  });
  // A printed-booklet style form number, derived from the items chosen.
  let h = 0;
  for (const q of questions) h = (h * 31 + q.variant + 7) % 9973;
  const formCode = `${form === 'full' ? 'L' : 'S'}-${String(h).padStart(4, '0')}`;
  return { questions, seen: nextSeen, formCode };
}
