/**
 * POSTFLOP STRATEGY RULES — readable on purpose. Every grade in the Postflop Trainer comes from
 * one of the rules below, applied to numbers the engine computes (equity, range advantage,
 * nut advantage, SPR, fold frequencies from the villain model).
 *
 * These are established heuristics, simplified. Adjust the constants to change how the trainer grades.
 *
 * 1. EQUITY REALIZATION — when not all-in, you don't always get to realize your raw equity.
 *    Out of position you realize less. Used for check/call EV estimates on flop and turn.
 *
 * 2. EV TOLERANCE — options whose estimated EV is within this share of the pot of the best
 *    option are graded Acceptable (the estimates are simplified, so near-ties are judgment calls).
 *
 * 3. C-BET PLAN (preflop aggressor, first bet on a street), from range and nut advantage:
 *    - Range advantage ≥ 55% on a dry or semi-wet board, and no nut disadvantage
 *        → "range bet small": bet 1/4–1/3 with most of the range.
 *    - Nut advantage ≥ 4 points on a semi-wet or wet board
 *        → "polarize big": bet 2/3–pot with strong hands and good draws, check medium hands.
 *    - Range advantage < 50%
 *        → "check a lot": check most hands; bet big only with strong value and strong draws.
 *    - Otherwise → "medium": 1/2 pot with value and draws, check weak hands.
 *    Hands with no pair but real equity (overcards, backdoor draws: ≥ 30% vs villain's range)
 *    make good small c-bets ("stabs") in the range-small and medium plans.
 *
 * 4. VALUE, BLUFF, FACING-BET and SHORT-STACK spots are graded by the EV estimate of each option
 *    (fold equity from the villain model, equity from the engine), with notes on:
 *    - bluff breakeven bet/(pot+bet) vs the model's fold frequency,
 *    - pot odds call/(pot+bet+call) and MDF pot/(pot+bet) when facing a bet,
 *    - commitment: at SPR ≤ 1.5 strong hands and strong draws should get the money in;
 *      at SPR ≤ 3 top pair good kicker or better is usually committed.
 *
 * 5. BLUFF-TO-VALUE — villains bet bluffs at bet/(pot + 2·bet) of their river betting range
 *    when balanced (more on earlier streets); see villainModel.ts for the exact knobs.
 */
import type { Wetness } from '../texture';
import type { HandInfo } from '../postflop/buckets';

export const RULES = {
  realization: { ip: 1.0, oop: 0.9 },
  evTolerance: 0.04,
  cbet: { rangeAdvantage: 0.55, nutAdvantage: 0.04, checkBelow: 0.5, stabEquity: 0.3 },
  commitment: { committedSpr: 1.5, topPairSpr: 3 },
  /**
   * Streets of value (rule of thumb): equity against the range that calls a 2/3-pot bet.
   * ≥ 70% → 3 streets, ≥ 60% → 2, ≥ 50% → 1, otherwise 0 (check / bluff-catch).
   */
  streetsOfValue: [0.5, 0.6, 0.7],
} as const;

export type CbetPlan = 'range-small' | 'polar-big' | 'check-heavy' | 'medium';

export const CBET_PLAN_TEXT: Record<CbetPlan, string> = {
  'range-small': 'You have the range advantage on a board that doesn’t change much: bet small (1/4–1/3) with most of your range.',
  'polar-big': 'You have more of the very strong hands on a dynamic board: bet big (2/3–pot) with value and good draws, check your medium hands.',
  'check-heavy': 'Villain’s range does better here: check most of your hands and only bet big with strong value and strong draws.',
  medium: 'No big edge either way: bet about half pot with value and draws, and check your weak hands.',
};

export function cbetPlan(rangeEquity: number, nutEdge: number, wetness: Wetness): CbetPlan {
  if (rangeEquity < RULES.cbet.checkBelow) return 'check-heavy';
  if (nutEdge >= RULES.cbet.nutAdvantage && wetness !== 'dry') return 'polar-big';
  if (rangeEquity >= RULES.cbet.rangeAdvantage && wetness !== 'wet' && nutEdge > -0.02) return 'range-small';
  return 'medium';
}

export type SizeClass = 'check' | 'small' | 'half' | 'big' | 'overbet';

export function sizeClass(fraction: number | null): SizeClass {
  if (fraction === null) return 'check';
  if (fraction <= 0.4) return 'small';
  if (fraction <= 0.55) return 'half';
  if (fraction <= 1.05) return 'big';
  return 'overbet';
}

/** Grades each size class for a hand under a c-bet plan. Unlisted classes are mistakes. */
export function cbetHandRule(plan: CbetPlan, hand: HandInfo, equity = 0): { best: SizeClass; acceptable: SizeClass[]; why: string } {
  const b = hand.bucket;
  const strongDraw = b === 'draw' && hand.strongDraw;
  const stab = (b === 'air' || b === 'weak') && equity >= RULES.cbet.stabEquity;
  switch (plan) {
    case 'range-small':
      if (stab) return { best: 'small', acceptable: ['check', 'half'], why: 'No pair yet, but with overcards/backdoors this hand has plenty of equity: a small range bet is ideal.' };
      if (b === 'weak') return { best: 'check', acceptable: ['small'], why: 'Weak showdown value prefers to check, though a small range bet is fine.' };
      if (b === 'monster') return { best: 'small', acceptable: ['check', 'half'], why: 'Keep your strong hands in the small range bet so it isn’t easy to read.' };
      return { best: 'small', acceptable: b === 'air' ? ['check'] : ['half'], why: 'A small bet with your whole range is cheap and folds out villain’s worst hands.' };
    case 'polar-big':
      if (b === 'monster' || b === 'strong') return { best: 'big', acceptable: ['half', 'overbet'], why: 'Strong hands want to build the pot while you hold the nut advantage.' };
      if (strongDraw) return { best: 'big', acceptable: ['half', 'check'], why: 'Strong draws bet big as semi-bluffs: fold equity plus lots of equity when called.' };
      if (b === 'draw') return { best: 'check', acceptable: ['big'], why: 'Weaker draws can check and realize equity; some bet big as bluffs.' };
      if (b === 'medium') return { best: 'check', acceptable: ['small'], why: 'Medium hands check: a big bet folds worse and gets called by better.' };
      if (stab) return { best: 'check', acceptable: ['big'], why: 'Overcards with backdoors can check or be a big bluff; checking keeps your checking range from being too weak.' };
      return { best: 'check', acceptable: [], why: 'Hands with little equity check — big bets need hands that can win when called.' };
    case 'check-heavy':
      if (b === 'monster') return { best: 'big', acceptable: ['check', 'half'], why: 'Even when checking a lot, your best hands bet big for value.' };
      if (strongDraw) return { best: 'check', acceptable: ['big'], why: 'Strong draws can check or bet big; checking keeps the pot small out of position.' };
      if (b === 'strong') return { best: 'half', acceptable: ['check', 'big'], why: 'Strong one-pair hands can bet for value or check to protect your checking range.' };
      return { best: 'check', acceptable: [], why: 'Villain’s range is stronger here: check and play defense.' };
    default:
      if (b === 'monster' || b === 'strong') return { best: 'half', acceptable: ['big', 'small'], why: 'Value hands bet about half pot.' };
      if (b === 'draw') return { best: 'half', acceptable: ['check', 'big'], why: 'Draws make good semi-bluffs at half pot.' };
      if (b === 'medium') return { best: 'check', acceptable: ['small'], why: 'Medium hands mostly check for pot control.' };
      if (stab) return { best: 'small', acceptable: ['check', 'half'], why: 'No pair, but enough equity (overcards, backdoor draws) to stab small and take the pot now.' };
      if (b === 'air') return { best: 'check', acceptable: ['small'], why: 'With no equity, check; a small stab is OK on dry boards.' };
      return { best: 'check', acceptable: [], why: 'Weak showdown value checks.' };
  }
}
