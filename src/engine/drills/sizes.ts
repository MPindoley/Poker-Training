/** Pot and bet sizes by difficulty. */
import type { Dealer } from './deal';
import type { Difficulty } from './types';

export interface PotBet {
  pot: number;
  bet: number;
  /** e.g. "1/2 pot" */
  sizeLabel: string;
}

const FRACTIONS: [number, string][] = [
  [1 / 4, '1/4 pot'],
  [1 / 3, '1/3 pot'],
  [1 / 2, '1/2 pot'],
  [2 / 3, '2/3 pot'],
  [3 / 4, '3/4 pot'],
  [1, 'pot'],
  [1.5, '1.5x pot'],
  [2, '2x pot'],
];

export function potAndBet(d: Dealer, difficulty: Difficulty): PotBet {
  if (difficulty === 'bronze') {
    const pot = d.pick([10, 20, 30, 40, 50, 60, 80, 100]);
    const [f, label] = d.pick(FRACTIONS.filter(([f]) => f === 0.5 || f === 1 || (f === 0.25 && pot % 4 === 0)));
    return { pot, bet: pot * f, sizeLabel: label };
  }
  const pot = d.int(12, 180);
  const [f, label] = d.pick(FRACTIONS.slice(1, difficulty === 'silver' ? 6 : 8));
  return { pot, bet: Math.max(1, Math.round(pot * f)), sizeLabel: label };
}
