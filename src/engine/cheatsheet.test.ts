import { describe, expect, it } from 'vitest';
import { betSizeTable, outsTable } from './cheatsheet';

describe('cheat sheet tables', () => {
  it('outs rows match known values', () => {
    const rows = outsTable();
    expect(rows).toHaveLength(21);
    const nine = rows[8]!;
    expect(nine.outs).toBe(9);
    expect(nine.flopToTurn).toBeCloseTo(9 / 47, 12);
    expect(Math.abs(nine.flopToRiver - 0.35)).toBeLessThan(0.01);
    expect(nine.turnToRiver).toBeCloseTo(9 / 46, 12);
    expect(nine.ruleOf4).toBeCloseTo(0.36, 12);
  });
  it('bet size rows', () => {
    const rows = betSizeTable();
    const half = rows.find((r) => r.label === '1/2 pot')!;
    expect(half.potOdds).toBeCloseTo(0.25, 12);
    expect(half.mdf).toBeCloseTo(2 / 3, 12);
    expect(half.bluffBreakeven).toBeCloseTo(1 / 3, 12);
    expect(half.oddsRatio).toBeCloseTo(3, 12);
    const pot = rows.find((r) => r.label === 'Pot')!;
    expect(pot.potOdds).toBeCloseTo(1 / 3, 12);
    expect(pot.mdf).toBeCloseTo(0.5, 12);
    const two = rows.find((r) => r.label === '2x pot')!;
    expect(two.potOdds).toBeCloseTo(0.4, 12);
  });
  it('bigger bets always need more equity and less defense', () => {
    const rows = betSizeTable();
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i]!.potOdds).toBeGreaterThan(rows[i - 1]!.potOdds);
      expect(rows[i]!.mdf).toBeLessThan(rows[i - 1]!.mdf);
    }
  });
});
