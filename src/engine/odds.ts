/** Pot odds and related quick math. */
import { choose } from './math';

export interface PotOddsResult {
  /** Minimum equity needed to call profitably (0..1). */
  requiredEquity: number;
  /** Odds against as "x to 1", i.e. final pot excluding our call / call amount. */
  ratio: number;
  /** Human-readable working, e.g. "10 / (30 + 10) = 25.0%". */
  working: string;
}

/**
 * Pot odds for facing a bet.
 * @param potBeforeCall The pot INCLUDING the villain's bet, before we call.
 * @param toCall The amount we must put in.
 */
export function potOdds(potBeforeCall: number, toCall: number): PotOddsResult {
  if (potBeforeCall <= 0 || toCall <= 0) throw new Error('pot and call must be positive');
  const requiredEquity = toCall / (potBeforeCall + toCall);
  const ratio = potBeforeCall / toCall;
  const pct = (requiredEquity * 100).toFixed(1);
  return {
    requiredEquity,
    ratio,
    working: `${toCall} / (${potBeforeCall} + ${toCall}) = ${pct}%`,
  };
}

/**
 * Exact chance of hitting at least one of `outs` when drawing `draws` cards
 * from `unseen` unknown cards: 1 - C(unseen - outs, draws) / C(unseen, draws).
 * Flop to river: unseen 47, draws 2. Turn to river: unseen 46, draws 1.
 */
export function hitProbability(outs: number, unseen: number, draws: number): number {
  if (outs < 0 || outs > unseen || draws < 0 || draws > unseen) throw new Error('invalid outs/unseen/draws');
  return 1 - choose(unseen - outs, draws) / choose(unseen, draws);
}
