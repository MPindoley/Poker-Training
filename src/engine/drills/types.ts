/**
 * Shared drill/question model used by every trainer. Pure data: the UI renders it.
 *
 * Text fields may contain card tokens like {Ah} which the UI renders as mini cards.
 */
import type { Grade } from '../grading';

export type Difficulty = 'bronze' | 'silver' | 'gold' | 'diamond';

export const DIFFICULTIES: readonly Difficulty[] = ['bronze', 'silver', 'gold', 'diamond'];

export const DIFFICULTY_INFO: Record<Difficulty, { label: string; blurb: string; xpMultiplier: number; secondsPerQuestion: number | null }> = {
  bronze: { label: 'Bronze', blurb: 'Whole numbers, simple spots', xpMultiplier: 1, secondsPerQuestion: null },
  silver: { label: 'Silver', blurb: 'Realistic bet sizes', xpMultiplier: 1.5, secondsPerQuestion: null },
  gold: { label: 'Gold', blurb: 'Multi-way pots, dirty outs, blockers', xpMultiplier: 2, secondsPerQuestion: null },
  diamond: { label: 'Diamond', blurb: 'Timed, mixed drill types', xpMultiplier: 3, secondsPerQuestion: 20 },
};

export interface Choice {
  id: string;
  label: string;
  grade: Grade;
  /** Optional note shown next to this choice after answering (e.g. its EV). */
  note?: string;
  /** Optional one-line explanation shown when this choice is picked (instead of the summary). */
  feedback?: string;
}

export interface Fact {
  label: string;
  value: string;
}

export interface QuestionContext {
  /** Card codes, e.g. ["Ah", "Kh"]. */
  hero?: string[];
  board?: string[];
  /** Short labelled numbers shown as chips, e.g. Pot $30. */
  facts?: Fact[];
  /** Free text about the opponent(s), e.g. "Villain: top pair (KQ)". */
  villain?: string;
}

export interface Explanation {
  /** One or two sentences: the WHY. */
  summary: string;
  /** Worked math, one line per step. */
  steps: string[];
}

/** A 13x13 strategy picture shown with the explanation (preflop drills). */
export interface StrategyVisual {
  kind: 'strategy';
  /** Hand class -> action -> frequency (0..1). */
  cells: Record<string, Partial<Record<string, number>>>;
  /** Legend, in paint order. Actions not listed are treated as fold. */
  actions: { id: string; label: string; color: string }[];
  highlight?: string;
  caption?: string;
}

export interface Question {
  /** Unique per generated question (kind + seed). */
  id: string;
  /** Drill type, e.g. "math.outs". */
  kind: string;
  /** Finer-grained skill used for spaced repetition, e.g. "math.outs:flush". */
  skill: string;
  difficulty: Difficulty;
  prompt: string;
  context: QuestionContext;
  choices: Choice[];
  explanation: Explanation;
  /** Extra skill keys to record the answer under (e.g. seat and hand-group tracking). */
  tags?: string[];
  visual?: StrategyVisual;
}

export function bestChoice(q: Question): Choice {
  const best = q.choices.find((c) => c.grade === 'best');
  if (!best) throw new Error(`Question ${q.id} has no best choice`);
  return best;
}
