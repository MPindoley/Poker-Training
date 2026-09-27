import { describe, expect, it } from 'vitest';
import { choose } from './math';
import {
  bluffBreakeven,
  evBet,
  evCall,
  evFold,
  evRaise,
  hitProbability,
  impliedOddsNeeded,
  minimumDefenseFrequency,
  potOdds,
  requiredEquity,
  stackToPotRatio,
} from './odds';

describe('known values', () => {
  it('calling $4 into a $6 pot after a $4 bet needs 4/14 ≈ 28.6%', () => {
    const r = requiredEquity(6, 4);
    expect(r.requiredEquity).toBeCloseTo(4 / 14, 12);
    expect(Math.abs(r.requiredEquity - 0.286)).toBeLessThan(0.01);
    expect(r.working).toBe('4 / (10 + 4) = 28.6%');
  });

  it('9 outs flop to river ≈ 35%', () => {
    const p = hitProbability(9, 47, 2);
    expect(p).toBeCloseTo(1 - choose(38, 2) / choose(47, 2), 12);
    expect(Math.abs(p - 0.35)).toBeLessThan(0.01);
  });

  it('8 outs flop to river ≈ 31.5%', () => {
    expect(Math.abs(hitProbability(8, 47, 2) - 0.315)).toBeLessThan(0.01);
  });

  it('pocket pair flops a set or better ≈ 11.8%', () => {
    // 2 cards of our rank left among 50 unseen, 3 flop cards.
    const p = hitProbability(2, 50, 3);
    expect(p).toBeCloseTo(1 - choose(48, 3) / choose(50, 3), 12);
    expect(Math.abs(p - 0.118)).toBeLessThan(0.01);
  });
});

describe('pot odds and requirements', () => {
  it('potOdds uses the pot including the bet', () => {
    expect(potOdds(30, 10).requiredEquity).toBeCloseTo(0.25);
    expect(potOdds(30, 10).ratio).toBe(3);
  });
  it('requiredEquity accounts for chips already invested', () => {
    // We bet 10 into 20, villain raises to 40: pot before raise 30, we call 30 more.
    expect(requiredEquity(30, 40, 10).requiredEquity).toBeCloseTo(30 / (30 + 40 + 30), 12);
    expect(() => requiredEquity(10, 5, 5)).toThrow();
  });
  it('rejects bad inputs', () => {
    expect(() => potOdds(0, 5)).toThrow();
    expect(() => requiredEquity(-1, 5)).toThrow();
  });
});

describe('frequencies', () => {
  it('MDF and bluff breakeven for common sizes', () => {
    expect(minimumDefenseFrequency(100, 50)).toBeCloseTo(2 / 3, 12);
    expect(minimumDefenseFrequency(100, 100)).toBeCloseTo(0.5, 12);
    expect(bluffBreakeven(100, 50)).toBeCloseTo(1 / 3, 12);
    expect(bluffBreakeven(100, 100)).toBeCloseTo(0.5, 12);
  });
  it('MDF and bluff breakeven are complements', () => {
    for (const [pot, bet] of [[10, 3], [20, 20], [7, 15]] as const) {
      expect(minimumDefenseFrequency(pot, bet) + bluffBreakeven(pot, bet)).toBeCloseTo(1, 12);
    }
  });
});

describe('EV', () => {
  it('calling at exactly the required equity is break-even', () => {
    const need = requiredEquity(6, 4).requiredEquity;
    expect(evCall(6, 4, need)).toBeCloseTo(0, 12);
    expect(evCall(6, 4, need + 0.1)).toBeGreaterThan(0);
    expect(evCall(6, 4, need - 0.1)).toBeLessThan(0);
    expect(evFold()).toBe(0);
  });
  it('EV of call with 50% equity: 0.5 × 14 − 4 = 3', () => {
    expect(evCall(6, 4, 0.5)).toBeCloseTo(3, 12);
  });
  it('a pure bluff at the breakeven fold frequency has zero EV', () => {
    const f = bluffBreakeven(100, 75);
    expect(evBet({ pot: 100, risk: 75, villainCall: 75, foldFrequency: f, equityWhenCalled: 0 })).toBeCloseTo(0, 10);
  });
  it('value bet that never gets folds: EV = eq × (pot + 2b) − b', () => {
    expect(evBet({ pot: 100, risk: 50, villainCall: 50, foldFrequency: 0, equityWhenCalled: 0.7 })).toBeCloseTo(0.7 * 200 - 50, 10);
  });
  it('raise EV matches a hand calculation', () => {
    // Pot 20, villain bets 10, we raise to 30. Villain folds 40%: we win 30.
    // Called 60%: pot 20 + 30 + 30 = 80, we win 80 × 0.35 − 30 = −2.
    expect(evRaise({ pot: 20, bet: 10, raiseTo: 30, foldFrequency: 0.4, equityWhenCalled: 0.35 })).toBeCloseTo(0.4 * 30 + 0.6 * -2, 10);
    expect(() => evRaise({ pot: 20, bet: 10, raiseTo: 10, foldFrequency: 0, equityWhenCalled: 0 })).toThrow();
  });
});

describe('implied odds and SPR', () => {
  it('flush draw on the turn facing a half-pot bet needs extra money later', () => {
    // Pot 20, bet 10 -> pot 30, call 10 with 9/46 equity.
    const eq = hitProbability(9, 46, 1);
    const x = impliedOddsNeeded(30, 10, eq);
    expect(x).toBeCloseTo(10 / eq - 40, 10);
    // Check: winning x more makes the call break even.
    expect(eq * (30 + 10 + x) - 10).toBeCloseTo(0, 10);
  });
  it('no implied odds needed when direct odds are enough', () => {
    expect(impliedOddsNeeded(30, 10, 0.5)).toBe(0);
    expect(impliedOddsNeeded(30, 10, 0)).toBe(Infinity);
  });
  it('stack-to-pot ratio', () => {
    expect(stackToPotRatio(40, 6.5)).toBeCloseTo(40 / 6.5, 12);
    expect(() => stackToPotRatio(40, 0)).toThrow();
  });
});
