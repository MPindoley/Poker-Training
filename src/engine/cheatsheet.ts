/** Reference tables for the cheat sheet. Every value is computed, never typed in. */
import { hitProbability, bluffBreakeven, minimumDefenseFrequency, requiredEquity } from './odds';

export interface OutsRow {
  outs: number;
  flopToTurn: number;
  flopToRiver: number;
  turnToRiver: number;
  /** Rule of 2 / rule of 4 shortcuts for comparison. */
  ruleOf2: number;
  ruleOf4: number;
}

export function outsTable(maxOuts = 21): OutsRow[] {
  return Array.from({ length: maxOuts }, (_, i) => {
    const outs = i + 1;
    return {
      outs,
      flopToTurn: hitProbability(outs, 47, 1),
      flopToRiver: hitProbability(outs, 47, 2),
      turnToRiver: hitProbability(outs, 46, 1),
      ruleOf2: (outs * 2) / 100,
      ruleOf4: (outs * 4) / 100,
    };
  });
}

export const BET_SIZES: { label: string; fraction: number }[] = [
  { label: '1/4 pot', fraction: 1 / 4 },
  { label: '1/3 pot', fraction: 1 / 3 },
  { label: '1/2 pot', fraction: 1 / 2 },
  { label: '2/3 pot', fraction: 2 / 3 },
  { label: '3/4 pot', fraction: 3 / 4 },
  { label: 'Pot', fraction: 1 },
  { label: '2x pot', fraction: 2 },
];

export interface BetSizeRow {
  label: string;
  fraction: number;
  /** Equity needed to call. */
  potOdds: number;
  /** Odds as "x to 1". */
  oddsRatio: number;
  mdf: number;
  bluffBreakeven: number;
}

export function betSizeTable(): BetSizeRow[] {
  return BET_SIZES.map(({ label, fraction }) => {
    const r = requiredEquity(1, fraction);
    return {
      label,
      fraction,
      potOdds: r.requiredEquity,
      oddsRatio: (1 + fraction) / fraction,
      mdf: minimumDefenseFrequency(1, fraction),
      bluffBreakeven: bluffBreakeven(1, fraction),
    };
  });
}
