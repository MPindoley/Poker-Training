/**
 * Lesson content model. Any number in a lesson is a function of the engine, evaluated at render
 * time — never typed in. Claims to double-check are marked with a `todo` block.
 */

/** Text, or a function that builds text from engine numbers. */
export type Dyn = string | (() => string);

export type ExampleId =
  | 'hand-rankings'
  | 'positions'
  | 'min-raise'
  | 'outs'
  | 'pot-odds'
  | 'implied'
  | 'equity'
  | 'ev'
  | 'combos'
  | 'range-chart'
  | 'sizing-price'
  | 'set-mining'
  | 'texture'
  | 'reading'
  | 'archetypes'
  | 'spr'
  | 'icm'
  | 'push-fold'
  | 'variance';

export type Block =
  | { kind: 'p'; text: Dyn }
  | { kind: 'h'; text: string }
  | { kind: 'list'; items: Dyn[] }
  | { kind: 'tip'; text: Dyn }
  | { kind: 'example'; example: ExampleId; caption?: string }
  /** A claim flagged for human review (shown in the lesson as a review note). */
  | { kind: 'todo'; text: string };

export interface QuizQuestion {
  prompt: Dyn;
  choices: Dyn[];
  /** Index of the correct choice. */
  answer: number;
  why: Dyn;
}

export interface Lesson {
  id: string;
  title: string;
  minutes: number;
  blurb: string;
  blocks: Block[];
  quiz: QuizQuestion[];
  drill: { route: string; label: string };
}

export interface Unit {
  id: string;
  number: number;
  title: string;
  blurb: string;
  lessons: Lesson[];
}

export const dyn = (d: Dyn): string => (typeof d === 'function' ? d() : d);
