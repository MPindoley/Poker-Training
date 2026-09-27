/**
 * HOW SURE IS EACH GRADE? Every graded postflop / exploit / review decision gets a confidence and a
 * source label, so a clear-cut spot is told apart from a close one or one that hinges on assumptions.
 *
 *  - clear:           the best option beats the next one by at least CLEAR_MARGIN_POT × pot.
 *  - close:           the margin is smaller than that (within the grading tolerance is closest).
 *  - model-dependent: the best action changes when the spot is re-analysed with villains a bit looser
 *                     and a bit tighter, and with equity realization at the ends of its sensible range.
 */
import type { Grade } from '../grading';
import type { Bucket } from '../postflop/buckets';
import { forStreet, type ModelStreet, type VillainModel } from './villainModel';

export type Confidence = 'clear' | 'close' | 'model-dependent';
export type AnswerSource = 'solver' | 'chart' | 'model';

export const CONFIDENCE_LABEL: Record<Confidence, string> = { clear: 'Clear', close: 'Close spot', 'model-dependent': 'Depends on reads' };
export const SOURCE_LABEL: Record<AnswerSource, string> = { solver: 'Solver data', chart: 'Chart (approximation)', model: 'Model estimate' };

/** Best must beat the runner-up by this share of the pot to be "clear". */
export const CLEAR_MARGIN_POT = 0.1;

/**
 * The "reasonable alternate assumptions" re-run for model-dependence. Stickiness s maps each continue
 * chance p to p^(1/s): 1.25 = villains call noticeably wider, 0.8 = they fold noticeably more.
 * Realization: the ends of the range we'd defend (OOP 0.8–1.0, IP 0.9–1.0; rules.ts uses 0.9 / 1.0).
 */
export const ALTERNATES = [
  { name: 'villains looser, full realization', stickiness: 1.25, realization: { ip: 1, oop: 1 } },
  { name: 'villains tighter, low realization', stickiness: 0.8, realization: { ip: 0.9, oop: 0.8 } },
] as const;

/** How much of a normal mistake's penalty applies (XP and leak weighting). */
export const MISTAKE_WEIGHT: Record<Confidence, number> = { clear: 1, close: 0.5, 'model-dependent': 0.5 };

/** A model whose continue chances are all shifted by stickiness s (every street). */
export function shiftModel(model: VillainModel, s: number): VillainModel {
  const one = (m: VillainModel): VillainModel => ({
    ...m,
    continueVsHalfPot: Object.fromEntries(Object.entries(m.continueVsHalfPot).map(([b, p]) => [b, p <= 0 ? 0 : p >= 1 ? 1 : Math.pow(p, 1 / s)])) as Record<Bucket, number>,
    byStreet: undefined,
  });
  const streets: ModelStreet[] = ['flop', 'turn', 'river'];
  return { ...one(model), byStreet: Object.fromEntries(streets.map((st) => [st, one(forStreet(model, st))])) };
}

/** Confidence from the EV margin alone (before the alternate re-runs). */
export function marginConfidence(evs: readonly number[], pot: number): Confidence {
  const sorted = [...evs].sort((a, b) => b - a);
  if (sorted.length < 2) return 'clear';
  return sorted[0]! - sorted[1]! >= CLEAR_MARGIN_POT * pot ? 'clear' : 'close';
}

/** Mistake severity for a grade in a spot of this confidence (1 = full). */
export function mistakeWeight(grade: Grade | null, confidence: Confidence | undefined): number {
  if (grade !== 'mistake') return 0;
  return MISTAKE_WEIGHT[confidence ?? 'clear'];
}
