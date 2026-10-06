export type SectionId = 'verbal' | 'numerical' | 'logical' | 'pattern' | 'spatial' | 'memory';

export type Difficulty = 1 | 2 | 3 | 4 | 5;

export type ShapeName = 'circle' | 'square' | 'triangle' | 'diamond' | 'pentagon' | 'hexagon' | 'star' | 'cross';
export type FillStyle = 'outline' | 'solid' | 'striped';
export type SizeName = 'small' | 'medium' | 'large';

/** One cell of a matrix puzzle: `count` copies of a shape. */
export interface Figure {
  shape: ShapeName;
  count: number;
  fill: FillStyle;
  size: SizeName;
}

/** A polyomino: a set of filled unit squares, as [col, row] pairs. */
export type Poly = [number, number][];

export type Visual =
  | { kind: 'matrix'; cells: (Figure | null)[] }
  | { kind: 'figure'; figure: Figure }
  | { kind: 'poly'; cells: Poly; mark?: [number, number] };

export interface ChoiceOption {
  label: string;
  visual?: Visual;
}

/** How a free-text answer is compared with the accepted answers. */
export type TextMode = 'number' | 'word' | 'phrase' | 'sequence';

export type AnswerSpec =
  | { kind: 'choice'; options: ChoiceOption[]; correct: number; keepOrder?: boolean }
  | { kind: 'text'; accept: string[]; mode: TextMode; placeholder?: string }
  | { kind: 'multi'; options: string[]; correct: number[] }
  | { kind: 'grid'; size: number; cells: number[] };

export type Stimulus =
  | { kind: 'text'; text: string; style: 'digits' | 'phrase' | 'letters' | 'passage' }
  | { kind: 'words'; words: string[] }
  | { kind: 'grid'; size: number; cells: number[] };

export interface Memorize {
  stimulus: Stimulus;
  seconds: number;
  instruction: string;
}

export interface Question {
  /** `${slotId}#${variant}`, stable across sessions. */
  id: string;
  slotId: string;
  variant: number;
  section: SectionId;
  difficulty: Difficulty;
  /** Short item-type label, e.g. "Analogy". */
  title: string;
  prompt: string;
  visual?: Visual;
  memorize?: Memorize;
  answer: AnswerSpec;
  /** Seconds allowed for answering (after any memorize phase). */
  timeLimit: number;
  explanation: string;
}

export interface Slot {
  id: string;
  section: SectionId;
  difficulty: Difficulty;
  /** Number of distinct alternate forms this item has. */
  variants: number;
  /** Included in the short form of the test. */
  quick?: boolean;
  build: (variant: number) => Question;
}

export type Response =
  | { kind: 'choice'; index: number | null }
  | { kind: 'text'; value: string }
  | { kind: 'multi'; indices: number[] }
  | { kind: 'grid'; cells: number[] };

export interface ItemResult {
  questionId: string;
  slotId: string;
  section: SectionId;
  difficulty: Difficulty;
  response: Response;
  /** 0..1 */
  credit: number;
  seconds: number;
  timedOut: boolean;
}
