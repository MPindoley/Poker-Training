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

// ---------------------------------------------------------------------------
// Betting math. Conventions: `pot` is the pot BEFORE the bet in question; `bet` is the size of
// that bet. All results are fractions (0..1) or chip amounts in the same unit as the inputs.

function assertNonNegative(values: Record<string, number>) {
  for (const [name, v] of Object.entries(values)) {
    if (!Number.isFinite(v) || v < 0) throw new Error(`${name} must be a non-negative number`);
  }
}

/**
 * Equity needed to call a bet: toCall / (pot + bet + toCall).
 * Example: $6 pot, villain bets $4, we call $4 -> 4 / 14 = 28.6%.
 * `heroAlreadyIn` is what we already put in on this street (e.g. facing a raise after betting).
 */
export function requiredEquity(pot: number, bet: number, heroAlreadyIn = 0): PotOddsResult {
  assertNonNegative({ pot, bet, heroAlreadyIn });
  const toCall = bet - heroAlreadyIn;
  if (toCall <= 0) throw new Error('Nothing to call');
  return potOdds(pot + bet, toCall);
}

/** Minimum defense frequency: how often you must continue so a pure bluff can't auto-profit. pot / (pot + bet). */
export function minimumDefenseFrequency(pot: number, bet: number): number {
  assertNonNegative({ pot, bet });
  if (pot + bet === 0) throw new Error('pot + bet must be positive');
  return pot / (pot + bet);
}

/** How often a bluff must work to break even: bet / (pot + bet). */
export function bluffBreakeven(pot: number, bet: number): number {
  assertNonNegative({ pot, bet });
  if (pot + bet === 0) throw new Error('pot + bet must be positive');
  return bet / (pot + bet);
}

/**
 * EV of calling, measured against folding (fold EV = 0), assuming no more betting:
 * equity × (pot + bet + toCall) − toCall.
 */
export function evCall(pot: number, bet: number, equity: number): number {
  assertNonNegative({ pot, bet, equity });
  return equity * (pot + bet + bet) - bet;
}

/** Folding never wins or loses more chips from this point. */
export function evFold(): number {
  return 0;
}

export interface BetEvInput {
  /** Pot before our bet/raise, including any bet we face. */
  pot: number;
  /** Chips we add with our bet or raise. */
  risk: number;
  /** Chips villain adds to call it. */
  villainCall: number;
  /** How often villain folds (0..1). */
  foldFrequency: number;
  /** Our equity when called (0..1). */
  equityWhenCalled: number;
}

/**
 * EV of betting or raising (relative to folding now), assuming villain folds or calls — no re-raise:
 * f × pot + (1 − f) × (eq × (pot + risk + villainCall) − risk).
 */
export function evBet({ pot, risk, villainCall, foldFrequency, equityWhenCalled }: BetEvInput): number {
  assertNonNegative({ pot, risk, villainCall, foldFrequency, equityWhenCalled });
  const called = equityWhenCalled * (pot + risk + villainCall) - risk;
  return foldFrequency * pot + (1 - foldFrequency) * called;
}

/**
 * Raise EV when facing a bet. `pot` is before villain's bet, `bet` is villain's bet,
 * `raiseTo` is our total raise size; villain calls the difference or folds.
 */
export function evRaise(input: { pot: number; bet: number; raiseTo: number; foldFrequency: number; equityWhenCalled: number }): number {
  const { pot, bet, raiseTo, foldFrequency, equityWhenCalled } = input;
  if (raiseTo <= bet) throw new Error('raiseTo must be bigger than the bet');
  return evBet({ pot: pot + bet, risk: raiseTo, villainCall: raiseTo - bet, foldFrequency, equityWhenCalled });
}

/**
 * Implied odds: extra chips you must win on later streets for a call to break even.
 * Solves equity × (potBeforeCall + toCall + X) = toCall  ->  X = toCall / equity − potBeforeCall − toCall.
 * `potBeforeCall` includes villain's bet. Returns 0 when direct odds already suffice.
 */
export function impliedOddsNeeded(potBeforeCall: number, toCall: number, equity: number): number {
  assertNonNegative({ potBeforeCall, toCall, equity });
  if (equity === 0) return Infinity;
  return Math.max(0, toCall / equity - potBeforeCall - toCall);
}

/** Stack-to-pot ratio: effective stack / pot. */
export function stackToPotRatio(effectiveStack: number, pot: number): number {
  assertNonNegative({ effectiveStack, pot });
  if (pot === 0) throw new Error('pot must be positive');
  return effectiveStack / pot;
}
