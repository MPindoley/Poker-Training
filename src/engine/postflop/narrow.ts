/**
 * Narrow ranges by actions ("villain calls a 1/3-pot c-bet", "villain bets 3/4 pot").
 * Works on the engine's weighted Range: each combo's weight is multiplied by the chance
 * it takes that action under a VillainModel.
 */
import { COMBOS, type Range } from '../range';
import { actionProbs, continueProb, STREET_BLUFF_FACTOR, type VillainModel } from '../strategy/villainModel';
import { classifyHand, BUCKETS, type Bucket, type HandInfo } from './buckets';

export type Street = 'flop' | 'turn' | 'river';

export function streetOf(board: readonly number[]): Street {
  return board.length === 3 ? 'flop' : board.length === 4 ? 'turn' : 'river';
}

export interface ClassifiedCombo {
  index: number;
  weight: number;
  info: HandInfo;
}

/** Live combos (not touching dead cards or the board) with their bucket. */
export function classifyRange(range: Range, board: readonly number[], dead: readonly number[] = []): ClassifiedCombo[] {
  const blocked = new Set([...board, ...dead]);
  const out: ClassifiedCombo[] = [];
  range.weights.forEach((w, index) => {
    if (w <= 0) return;
    const { c1, c2 } = COMBOS[index]!;
    if (blocked.has(c1) || blocked.has(c2)) return;
    out.push({ index, weight: w, info: classifyHand(c1, c2, board) });
  });
  return out;
}

function fromCombos(combos: readonly ClassifiedCombo[], factor: (c: ClassifiedCombo) => number): Range {
  const weights = new Float64Array(1326);
  for (const c of combos) weights[c.index] = c.weight * Math.max(0, Math.min(1, factor(c)));
  return { weights };
}

/** Range that continues (calls or raises) against a bet of `betFraction` × pot. */
export function continuingRange(combos: readonly ClassifiedCombo[], betFraction: number, model: VillainModel): Range {
  return fromCombos(combos, (c) => continueProb(model, c.info.bucket, betFraction, c.info.strongDraw));
}

/** Range that just calls that bet (continuing minus raising). */
export function callingRange(combos: readonly ClassifiedCombo[], betFraction: number, model: VillainModel): Range {
  return fromCombos(combos, (c) => actionProbs(model, c.info.bucket, betFraction, c.info.strongDraw).call);
}

/** Range that raises (check-raises out of position) against that bet. */
export function raisingRange(combos: readonly ClassifiedCombo[], betFraction: number, model: VillainModel): Range {
  return fromCombos(combos, (c) => actionProbs(model, c.info.bucket, betFraction, c.info.strongDraw).raise);
}

/** Range that folds to that bet. */
export function foldingRange(combos: readonly ClassifiedCombo[], betFraction: number, model: VillainModel): Range {
  return fromCombos(combos, (c) => 1 - continueProb(model, c.info.bucket, betFraction, c.info.strongDraw));
}

/** Per-combo frequency of betting `betFraction` × pot, with bluffs sized to the model's ratio. */
export function betFrequencies(combos: readonly ClassifiedCombo[], betFraction: number, model: VillainModel, street: Street): (c: ClassifiedCombo) => number {
  const value = combos.reduce((s, c) => s + (['monster', 'strong', 'medium'].includes(c.info.bucket) ? c.weight * model.betFreq[c.info.bucket] : 0), 0);
  const draws = combos.filter((c) => c.info.bucket === 'draw');
  const drawFreq = (c: ClassifiedCombo) => (c.info.strongDraw ? Math.min(1, model.betFreq.draw * 1.5) : model.betFreq.draw);
  const drawBets = draws.reduce((s, c) => s + c.weight * drawFreq(c), 0);
  const target = Math.min(0.6, model.bluffFactor * STREET_BLUFF_FACTOR[street] * (betFraction / (1 + 2 * betFraction)));
  const needed = (target / (1 - target)) * value;
  const air = combos.filter((c) => c.info.bucket === 'air' || c.info.bucket === 'weak');
  const airWeight = air.reduce((s, c) => s + c.weight * (c.info.bucket === 'air' ? 1 : 0.35), 0);
  const airFreq = airWeight > 0 ? Math.min(1, Math.max(0, needed - drawBets) / airWeight) : 0;
  return (c) => {
    const b = c.info.bucket;
    if (b === 'draw') return drawFreq(c);
    if (b === 'air') return airFreq;
    if (b === 'weak') return Math.max(model.betFreq.weak, airFreq * 0.35);
    return model.betFreq[b];
  };
}

export function bettingRange(combos: readonly ClassifiedCombo[], betFraction: number, model: VillainModel, street: Street): Range {
  const f = betFrequencies(combos, betFraction, model, street);
  return fromCombos(combos, f);
}

export function checkingRange(combos: readonly ClassifiedCombo[], betFraction: number, model: VillainModel, street: Street): Range {
  const f = betFrequencies(combos, betFraction, model, street);
  return fromCombos(combos, (c) => 1 - f(c));
}

export interface Composition {
  total: number;
  share: Record<Bucket, number>;
}

/** Weighted share of each bucket in a range. */
export function composition(combos: readonly ClassifiedCombo[]): Composition {
  const share = Object.fromEntries(BUCKETS.map((b) => [b, 0])) as Record<Bucket, number>;
  let total = 0;
  for (const c of combos) {
    share[c.info.bucket] += c.weight;
    total += c.weight;
  }
  if (total > 0) for (const b of BUCKETS) share[b] /= total;
  return { total, share };
}

export function totalWeight(range: Range, blocked: readonly number[] = []): number {
  const dead = new Set(blocked);
  let s = 0;
  range.weights.forEach((w, i) => {
    if (w > 0 && !dead.has(COMBOS[i]!.c1) && !dead.has(COMBOS[i]!.c2)) s += w;
  });
  return s;
}
