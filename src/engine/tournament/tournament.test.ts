import { describe, expect, it } from 'vitest';
import { icmEquity } from './icm';
import { bankrollFor, normalQuantile, resultRange, riskOfRuin } from './bankroll';
import { pushChart, shoveGain } from './pushfold';
import { topRange } from '../preflop/ranking';

describe('ICM', () => {
  it('equal stacks split equally', () => {
    const e = icmEquity([1000, 1000, 1000], [50, 30, 20]);
    for (const x of e) expect(x).toBeCloseTo(100 / 3, 10);
  });
  it('matches a hand-computed 3-player example', () => {
    // Stacks 50/30/20, payouts 70/30. P(A 1st)=.5; A 2nd: via B first .3*(50/70) + via C first .2*(50/80)
    const [a] = icmEquity([50, 30, 20], [70, 30]);
    const aSecond = 0.3 * (50 / 70) + 0.2 * (50 / 80);
    expect(a).toBeCloseTo(0.5 * 70 + aSecond * 30, 10);
  });
  it('sums to the prize pool and chip leader is worth less than chips', () => {
    const e = icmEquity([6000, 3000, 1000], [50, 30, 20]);
    expect(e.reduce((s, x) => s + x, 0)).toBeCloseTo(100, 10);
    expect(e[0]! / 100).toBeLessThan(0.6);
    expect(e[2]! / 100).toBeGreaterThan(0.1);
  });
  it('busted players get nothing', () => {
    expect(icmEquity([100, 0], [60, 40])[1]).toBe(0);
  });
});

describe('bankroll', () => {
  it('risk of ruin formula', () => {
    expect(riskOfRuin(5, 100, 3000)).toBeCloseTo(Math.exp(-3), 12);
    expect(riskOfRuin(-1, 100, 3000)).toBe(1);
    expect(riskOfRuin(5, 100, bankrollFor(5, 100, 0.05))).toBeCloseTo(0.05, 12);
  });
  it('normal quantile', () => {
    expect(normalQuantile(0.975)).toBeCloseTo(1.959964, 5);
    expect(normalQuantile(0.5)).toBeCloseTo(0, 8);
    expect(normalQuantile(0.01)).toBeCloseTo(-2.326348, 5);
  });
  it('result range widens with sqrt(hands)', () => {
    const r = resultRange(5, 100, 10_000);
    expect(r.expected).toBe(500);
    expect(r.high - r.expected).toBeCloseTo(1.959964 * 1000, 2);
    expect(r.losingChance).toBeCloseTo(0.3085, 3); // P(Z < −0.5)
  });
});

describe('push/fold model', () => {
  it('shoves AA at any stack and folds 72o deep vs a wide-ish calling range', () => {
    const call = topRange(0.3);
    expect(shoveGain('AA', 20, call).shove).toBe(true);
    expect(shoveGain('72o', 20, call).shove).toBe(false);
  });
  it('shoves wider when shorter', () => {
    const count = (s: number) => Object.values(pushChart(s, 0.25, 300)).filter((r) => r.shove).length;
    expect(count(5)).toBeGreaterThan(count(15));
  }, 60_000);
});
