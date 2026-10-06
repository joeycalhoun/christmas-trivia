import type { Difficulty, Question, SectionId, Slot, Stimulus, TextMode } from '../engine/types';

/** A hand-written item. For choice items the first entry of `choices` is the correct one. */
export interface HandItem {
  prompt: string;
  choices?: string[];
  accept?: string[];
  explanation: string;
  /** Text shown during a memorize phase before the prompt appears. */
  memorize?: string;
}

interface HandSlotConfig {
  id: string;
  section: SectionId;
  difficulty: Difficulty;
  title: string;
  timeLimit: number;
  quick?: boolean;
  mode?: TextMode;
  placeholder?: string;
  memorizeSeconds?: number;
  memorizeInstruction?: string;
  memorizeStyle?: Extract<Stimulus, { kind: 'text' }>['style'];
  items: HandItem[];
}

export function handSlot(cfg: HandSlotConfig): Slot {
  return {
    id: cfg.id,
    section: cfg.section,
    difficulty: cfg.difficulty,
    variants: cfg.items.length,
    quick: cfg.quick,
    build(variant: number): Question {
      const item = cfg.items[variant];
      if (!item) throw new Error(`${cfg.id} has no variant ${variant}`);
      const q: Question = {
        id: `${cfg.id}#${variant}`,
        slotId: cfg.id,
        variant,
        section: cfg.section,
        difficulty: cfg.difficulty,
        title: cfg.title,
        prompt: item.prompt,
        timeLimit: cfg.timeLimit,
        explanation: item.explanation,
        answer: item.choices
          ? { kind: 'choice', options: item.choices.map((label) => ({ label })), correct: 0 }
          : { kind: 'text', accept: item.accept ?? [], mode: cfg.mode ?? 'word', placeholder: cfg.placeholder },
      };
      if (item.memorize) {
        q.memorize = {
          stimulus: { kind: 'text', text: item.memorize, style: cfg.memorizeStyle ?? 'phrase' },
          seconds: cfg.memorizeSeconds ?? 8,
          instruction: cfg.memorizeInstruction ?? 'Memorize this.',
        };
      }
      return q;
    },
  };
}
