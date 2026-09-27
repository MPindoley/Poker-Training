import { describe, expect, it } from 'vitest';
import { choose, formatPercent } from './math';
import { hitProbability, potOdds } from './odds';
import { breakdownChips } from './chips';
import { gradeByEvLoss } from './grading';

describe('math helpers', () => {
  it('computes binomials', () => {
    expect(choose(52, 2)).toBe(1326);
    expect(choose(50, 3)).toBe(19600);
    expect(choose(5, 0)).toBe(1);
    expect(choose(3, 5)).toBe(0);
  });

  it('formats percents', () => {
    expect(formatPercent(0.25)).toBe('25.0%');
    expect(formatPercent(1 / 3, 2)).toBe('33.33%');
  });
});

describe('pot odds', () => {
  it('computes required equity for a half-pot bet', () => {
    // Pot 20, villain bets 10 -> pot 30, we call 10 into 40 total.
    const r = potOdds(30, 10);
    expect(r.requiredEquity).toBeCloseTo(0.25);
    expect(r.ratio).toBe(3);
    expect(r.working).toBe('10 / (30 + 10) = 25.0%');
  });

  it('computes required equity for a pot-sized bet', () => {
    expect(potOdds(20, 10).requiredEquity).toBeCloseTo(1 / 3);
  });
});

describe('chips and grading', () => {
  it('breaks amounts into chips greedily', () => {
    expect(breakdownChips(135)).toEqual([
      { denom: 100, count: 1 },
      { denom: 25, count: 1 },
      { denom: 5, count: 2 },
    ]);
    expect(breakdownChips(0)).toEqual([]);
  });

  it('grades by EV loss', () => {
    expect(gradeByEvLoss(0)).toBe('best');
    expect(gradeByEvLoss(0.3)).toBe('acceptable');
    expect(gradeByEvLoss(2)).toBe('mistake');
  });
});

describe('hitProbability', () => {
  it('matches known draw odds', () => {
    // Flush draw on the flop, seeing turn and river: 1 - C(38,2)/C(47,2) = 1 - 703/1081
    expect(hitProbability(9, 47, 2)).toBeCloseTo(1 - 703 / 1081, 10);
    // Flush draw on the turn: 9/46
    expect(hitProbability(9, 46, 1)).toBeCloseTo(9 / 46, 10);
    expect(hitProbability(0, 47, 2)).toBe(0);
  });
});
