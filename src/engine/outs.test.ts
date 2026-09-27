import { describe, expect, it } from 'vitest';
import { cardToString } from './cards';
import { calculateOuts } from './outs';

const names = (cards: { rank: string; suit: string }[]) => cards.map((c) => cardToString(c as never)).sort();

describe('outs', () => {
  it('flush draw vs top pair: the 9 remaining hearts, all clean', () => {
    const r = calculateOuts('9h8h', 'Kh7h2c', 'KsQd');
    expect(names(r.outs)).toEqual(['2h', '3h', '4h', '5h', '6h', 'Ah', 'Jh', 'Qh', 'Th']);
    expect(r.dirty).toEqual([]);
    expect(r.unseen).toBe(47);
    expect(r.shareNow).toBe(0);
    expect(r.nextCardChance).toBeCloseTo(9 / 47, 12);
    // 9 outs flop to river ≈ 35%
    expect(Math.abs(r.byRiverChance - 0.35)).toBeLessThan(0.01);
  });

  it('open-ended straight draw vs an overpair: 8 clean outs', () => {
    const r = calculateOuts('JsTs', '9h8c2d', 'AhAd');
    expect(names(r.outs)).toEqual(['7c', '7d', '7h', '7s', 'Qc', 'Qd', 'Qh', 'Qs']);
    expect(Math.abs(r.byRiverChance - 0.315)).toBeLessThan(0.01);
  });

  it('flush draw vs a set: the board-pairing heart is not an out', () => {
    const r = calculateOuts('9h8h', 'Kh7h2c', '7s7c');
    // 2h gives hero a flush but villain a full house.
    expect(names(r.outs)).toEqual(['3h', '4h', '5h', '6h', 'Ah', 'Jh', 'Qh', 'Th']);
    const twoH = r.cards.find((c) => cardToString(c.card) === '2h')!;
    expect(twoH.shareAfter).toBe(0);
    expect(twoH.villainHelped).toBe(1);
    // Cards villain holds are skipped.
    expect(r.cards.some((c) => cardToString(c.card) === '7s')).toBe(false);
  });

  it('flags dirty outs that also help part of the range', () => {
    const r = calculateOuts('9h8h', 'Kh7h2c', '7s7c, KsQd');
    expect(names(r.clean)).toEqual(['3h', '4h', '5h', '6h', 'Ah', 'Jh', 'Qh', 'Th']);
    // 2h beats KQ but gives 77 a boat: an out against half the range, and dirty.
    expect(names(r.dirty)).toEqual(['2h']);
    const twoH = r.cards.find((c) => cardToString(c.card) === '2h')!;
    expect(twoH.shareAfter).toBeCloseTo(0.5, 12);
    expect(twoH.villainHelped).toBeCloseTo(0.5, 12);
  });

  it('works on the turn and counts discounted outs', () => {
    const r = calculateOuts('AhQh', 'Kh7h2c3d', '7s7c');
    // 9 hearts left; 2h and 3h pair the board -> villain boat, so 7 clean outs.
    // Hero can't see villain's cards, so 52 − 2 − 4 = 46 cards are unseen.
    expect(r.outs).toHaveLength(7);
    expect(r.unseen).toBe(46);
    expect(r.byRiverChance).toBe(r.nextCardChance);
    expect(r.weightedOuts).toBe(7);
  });

  it('no outs when already ahead', () => {
    const r = calculateOuts('AsAd', 'Kh7h2c', 'KsQd');
    expect(r.shareNow).toBe(1);
    expect(r.outs).toEqual([]);
  });

  it('validates input', () => {
    expect(() => calculateOuts('9h8h', 'Kh7h', 'KK')).toThrow(/flop or turn/);
    expect(() => calculateOuts('9h8h', 'Kh7h2c3d4s', 'KK')).toThrow();
    expect(() => calculateOuts('9h8h', '9h7h2c', 'KK')).toThrow(/Duplicate/);
    expect(() => calculateOuts('KhKd', 'KsKc2c', 'KK')).toThrow(/no live combos/);
  });
});
