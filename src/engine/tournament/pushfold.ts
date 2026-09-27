/**
 * Push/fold from the small blind vs the big blind (heads-up at the end of the orbit), in big blinds.
 * A simplified model: the big blind calls with a fixed top-X% range. Not a Nash solution.
 */
import { cardFromIndex } from '../cards';
import { calculateEquity } from '../equity';
import { HAND_GRID } from '../hands';
import { classComboIndices, countCombos, COMBOS, type Range } from '../range';
import { topRange } from '../preflop/ranking';

export interface ShoveResult {
  label: string;
  /** EV of shoving minus EV of folding, in big blinds. */
  gain: number;
  shove: boolean;
  foldEquity: number;
  equityWhenCalled: number;
}

/**
 * EV(shove) − EV(fold) for the SB with `stack` bb (including the posted 0.5), vs a BB calling range.
 * Fold: lose the 0.5 posted. Shove: BB folds → win 1 (BB's blind); BB calls → eq × 2·stack − stack.
 */
export function shoveGain(label: string, stack: number, callRange: Range, iterations = 1200, seed = 1): ShoveResult {
  const idx = classComboIndices(label);
  const c = COMBOS[idx[0]!]!;
  const dead = [c.c1, c.c2];
  const total = 1225; // live combos for the BB after removing our two cards
  const calls = countCombos(callRange, dead.map(cardFromIndex));
  const f = 1 - calls / total;
  const eq = calls > 0 ? calculateEquity([label, callRange], { iterations, seed, forceMonteCarlo: true }).players[0]!.equity : 0;
  const evShove = f * 1 + (1 - f) * (eq * 2 * stack - stack);
  const evFold = -0.5;
  const gain = evShove - evFold;
  return { label, gain, shove: gain > 0, foldEquity: f, equityWhenCalled: eq };
}

/** Shove/fold decision for all 169 hands. */
export function pushChart(stack: number, callPercent: number, iterations = 800): Record<string, ShoveResult> {
  const call = topRange(callPercent);
  return Object.fromEntries(HAND_GRID.flat().map((h, i) => [h.label, shoveGain(h.label, stack, call, iterations, 100 + i)]));
}
