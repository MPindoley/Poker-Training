import { describe, expect, it } from 'vitest';
import { HAND_GRID, TOTAL_COMBOS, comboCount, handClassAt, handClassByLabel, rangeStats } from './hands';

describe('hand classes', () => {
  it('has 169 unique classes', () => {
    const labels = HAND_GRID.flat().map((h) => h.label);
    expect(labels).toHaveLength(169);
    expect(new Set(labels).size).toBe(169);
  });

  it('uses the standard grid layout', () => {
    expect(handClassAt(0, 0).label).toBe('AA');
    expect(handClassAt(0, 1).label).toBe('AKs');
    expect(handClassAt(1, 0).label).toBe('AKo');
    expect(handClassAt(12, 12).label).toBe('22');
    expect(handClassAt(4, 5).label).toBe('T9s');
  });

  it('derives combo counts by enumeration', () => {
    expect(comboCount(handClassByLabel('AA'))).toBe(6);
    expect(comboCount(handClassByLabel('AKs'))).toBe(4);
    expect(comboCount(handClassByLabel('AKo'))).toBe(12);
  });

  it('sums every class to all 1326 starting combos', () => {
    expect(TOTAL_COMBOS).toBe(1326);
    const all = rangeStats(HAND_GRID.flat().map((h) => h.label));
    expect(all.combos).toBe(1326);
    expect(all.fraction).toBe(1);
  });

  it('summarises a range', () => {
    const r = rangeStats(['AA', 'KK', 'AKs', 'AKo', 'AA']);
    expect(r).toEqual({ hands: 4, combos: 28, fraction: 28 / 1326 });
  });
});
