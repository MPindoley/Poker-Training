import { describe, expect, it } from 'vitest';
import { parseCards } from './cards';
import { HAND_GRID, TOTAL_COMBOS } from './hands';
import {
  COMBOS,
  RangeParseError,
  classCombos,
  comboIndex,
  countCombos,
  fullRange,
  gridToRange,
  parseRange,
  rangeCombos,
  rangeFraction,
  rangeFromLabels,
  rangeToClassWeights,
  rangeToGrid,
  rangeToString,
} from './range';

const labels = (text: string) => [...rangeToClassWeights(parseRange(text)).keys()].sort();
const count = (text: string, dead = '') => countCombos(parseRange(text), dead);

describe('combo tables', () => {
  it('has 1326 unique combos', () => {
    expect(COMBOS).toHaveLength(1326);
    expect(TOTAL_COMBOS).toBe(1326);
    expect(new Set(COMBOS.map((c) => c.c1 * 52 + c.c2)).size).toBe(1326);
  });
  it('comboIndex is order-independent', () => {
    expect(comboIndex(51, 50)).toBe(comboIndex(50, 51));
    expect(() => comboIndex(3, 3)).toThrow();
  });
});

describe('known combo counts', () => {
  it('pair 6, suited 4, offsuit 12, AK 16', () => {
    expect(count('QQ')).toBe(6);
    expect(count('T9s')).toBe(4);
    expect(count('T9o')).toBe(12);
    expect(count('AK')).toBe(16);
    expect(count('random')).toBe(1326);
  });
});

describe('parsing', () => {
  it('pairs with + and dash', () => {
    expect(labels('22+')).toHaveLength(13);
    expect(count('22+')).toBe(78);
    expect(labels('TT-77')).toEqual(['77', '88', '99', 'TT']);
    expect(labels('77-TT')).toEqual(['77', '88', '99', 'TT']);
  });
  it('kicker plus', () => {
    expect(count('A2s+')).toBe(48);
    expect(labels('KTs+')).toEqual(['KJs', 'KQs', 'KTs']);
    expect(labels('AJo+')).toEqual(['AJo', 'AKo', 'AQo']);
    expect(labels('K9+')).toEqual(['K9o', 'K9s', 'KJo', 'KJs', 'KQo', 'KQs', 'KTo', 'KTs']);
  });
  it('dash ranges with a fixed top card or a fixed gap', () => {
    expect(labels('A5s-A2s')).toEqual(['A2s', 'A3s', 'A4s', 'A5s']);
    expect(labels('76s-54s')).toEqual(['54s', '65s', '76s']);
    expect(labels('KQo-T9o')).toEqual(['JTo', 'KQo', 'QJo', 'T9o']);
    expect(labels('J9s-64s')).toEqual(['64s', '75s', '86s', '97s', 'J9s', 'T8s']);
  });
  it('the full example string', () => {
    // 78 pairs + 48 A2s+ + 12 KTs+ + 36 AJo+ + 4 T9s + 12 (76s,65s,54s)
    const r = parseRange('22+, A2s+, KTs+, AJo+, T9s, 76s-54s');
    expect(countCombos(r)).toBe(190);
    expect(rangeFraction(r)).toBeCloseTo(190 / 1326, 12);
  });
  it('is case- and spacing-tolerant, and accepts reversed ranks', () => {
    expect(count('aks,  kqs qq')).toBe(4 + 4 + 6);
    expect(count('KAs')).toBe(4);
  });
  it('specific combos', () => {
    expect(count('AsKs')).toBe(1);
    expect(count('AsKs, AhKh')).toBe(2);
  });
  it('weights', () => {
    expect(count('AKo@50')).toBe(6);
    expect(count('AKo:0.25')).toBe(3);
    expect(count('QQ+, AKs@50%')).toBe(18 + 2);
    // later tokens overwrite earlier ones
    expect(count('AA, AA@50')).toBe(3);
  });
  it('rejects nonsense with a useful error', () => {
    expect(() => parseRange('AXs')).toThrow(RangeParseError);
    expect(() => parseRange('AAs')).toThrow(/pairs cannot/);
    expect(() => parseRange('AKs-QQ')).toThrow();
    expect(() => parseRange('A5s-K2s')).toThrow(/top card or a gap/);
    expect(() => parseRange('AK@150')).toThrow(/weight/);
  });
});

describe('card removal (blockers)', () => {
  it('an ace on the board removes AK combos', () => {
    expect(count('AK', 'As')).toBe(12);
    expect(count('AKs', 'As')).toBe(3);
    expect(count('AA', 'As')).toBe(3);
    expect(count('AA', 'AsAh')).toBe(1);
  });
  it('hero hand plus board', () => {
    // Hero AhKd on K72 board: villain KK has 1 combo left (Kc Ks minus the board K)
    expect(count('KK', 'AhKd Kh7c2s')).toBe(1);
    expect(classCombos('AK', 'AhKd Kh7c2s')).toBe(6); // 3 live aces x 2 live kings
  });
  it('weights survive removal', () => {
    expect(count('AKo@50', 'As')).toBe(4.5);
  });
  it('rangeCombos lists the live combos', () => {
    const combos = rangeCombos(parseRange('AA'), parseCards('As'));
    expect(combos).toHaveLength(3);
    expect(combos.every((c) => c.label === 'AA')).toBe(true);
  });
});

describe('grid and percentage conversion', () => {
  it('grid holds class weights', () => {
    const grid = rangeToGrid(parseRange('AA, AKs@50, AsKh'));
    expect(grid[0]![0]).toBe(1);
    expect(grid[0]![1]).toBe(0.5);
    expect(grid[1]![0]).toBeCloseTo(1 / 12);
    expect(grid[12]![12]).toBe(0);
  });
  it('grid round-trips for class-level ranges', () => {
    const r = parseRange('22+, A2s+, KTs+, AJo+@75, T9s, 76s-54s');
    expect(gridToRange(rangeToGrid(r)).weights).toEqual(r.weights);
  });
  it('labels (RangeGrid selection) convert to a range', () => {
    expect(countCombos(rangeFromLabels(['AA', 'AKs']))).toBe(10);
  });
  it('percent of all hands', () => {
    expect(rangeFraction(fullRange())).toBe(1);
    expect(rangeFraction(parseRange('AA'))).toBeCloseTo(6 / 1326);
  });
});

describe('back to notation', () => {
  it.each([
    ['22+, A2s+, KTs+, AJo+, T9s, 76s-54s', '22+, A2s+, AJo+, KTs+, T9s, 76s, 65s, 54s'],
    ['TT-77', 'TT-77'],
    ['A5s-A2s, AKo', 'A5s-A2s, AKo'],
    ['AA, KK@50', 'AA, KK@50'],
    ['random', 'random'],
    ['', ''],
  ])('%s -> %s', (input, expected) => {
    expect(rangeToString(parseRange(input))).toBe(expected);
  });

  it('round-trips any range, including partial classes', () => {
    for (const text of ['22+, A2s+, KTs+, AJo+, T9s, 76s-54s', 'AsKs, AhKh, QQ@33.3', 'K9o-K2o@25, 87s', 'random']) {
      const r = parseRange(text);
      expect(parseRange(rangeToString(r)).weights).toEqual(r.weights);
    }
  });

  it('every single class round-trips', () => {
    for (const h of HAND_GRID.flat()) expect(rangeToString(parseRange(h.label))).toBe(h.label);
  });
});
