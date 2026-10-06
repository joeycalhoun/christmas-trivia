import type { SectionId, Slot } from '../engine/types';
import { verbalSlots } from './verbal';
import { numericalSlots } from './numerical';
import { logicalSlots } from './logical';
import { patternSlots } from './pattern';
import { spatialSlots } from './spatial';
import { memorySlots } from './memory';

export interface SectionInfo {
  id: SectionId;
  name: string;
  measures: string;
}

/** Subtests in the order they are given. */
export const SECTIONS: SectionInfo[] = [
  { id: 'verbal', name: 'Verbal Reasoning', measures: 'Word meaning, analogies and categories.' },
  { id: 'numerical', name: 'Quantitative Reasoning', measures: 'Number series and arithmetic problems.' },
  { id: 'logical', name: 'Logical Reasoning', measures: 'Deduction, ordering, codes and puzzles.' },
  { id: 'pattern', name: 'Matrix Reasoning', measures: 'Abstract visual patterns across rows.' },
  { id: 'spatial', name: 'Spatial Reasoning', measures: 'Rotating and reflecting shapes in your head.' },
  { id: 'memory', name: 'Working Memory', measures: 'Holding information for a few seconds, then using it.' },
];

export const SECTION_BY_ID = Object.fromEntries(SECTIONS.map((s) => [s.id, s])) as Record<SectionId, SectionInfo>;

const bySection = (id: SectionId, slots: Slot[]) => slots.filter((s) => s.section === id);

export const ALL_SLOTS: Slot[] = SECTIONS.flatMap(({ id }) =>
  bySection(id, [...verbalSlots, ...numericalSlots, ...logicalSlots, ...patternSlots, ...spatialSlots, ...memorySlots]).sort(
    (a, b) => a.difficulty - b.difficulty,
  ),
);
