import { describe, expect, it } from 'vitest';
import { classifyBoard, rangeAdvantage } from './texture';

describe('suits', () => {
  it.each([
    ['Kh7c2s', 'rainbow', false, false],
    ['Kh7h2s', 'two-tone', false, true],
    ['Kh7h2h', 'monotone', true, false],
    ['Kh7h2h9c', 'three-flush', true, false],
    ['Kh7h2h9h', 'four-flush', true, false],
    ['Kh7h2s9c4d', 'two-tone', false, false], // no cards to come, so no draw
  ] as const)('%s is %s', (board, suits, flush, draw) => {
    const t = classifyBoard(board);
    expect(t.suits).toBe(suits);
    expect(t.flushPossible).toBe(flush);
    expect(t.flushDrawPossible).toBe(draw);
  });
});

describe('pairing', () => {
  it.each([
    ['Kh7c2s', 'unpaired'],
    ['KhKc2s', 'paired'],
    ['KhKc2s2d', 'two-pair'],
    ['KhKcKs', 'trips'],
    ['KhKcKs2d2c', 'full-house'],
    ['KhKcKsKd', 'quads'],
  ] as const)('%s is %s', (board, pairing) => {
    expect(classifyBoard(board).pairing).toBe(pairing);
  });
});

describe('height', () => {
  it('uses the top card', () => {
    expect(classifyBoard('Ah7c2s').height).toBe('high');
    expect(classifyBoard('Qh7c2s').height).toBe('high');
    expect(classifyBoard('Jh7c2s').height).toBe('middle');
    expect(classifyBoard('8h7c2s').height).toBe('middle');
    expect(classifyBoard('7h5c2s').height).toBe('low');
  });
});

describe('connectedness', () => {
  it('counts ranks in the best straight window, with the ace low too', () => {
    expect(classifyBoard('JhTc9s').connectedness).toBe(3);
    expect(classifyBoard('Ah3c2s').connectedness).toBe(3);
    expect(classifyBoard('Kh7c2s').connectedness).toBe(1);
    expect(classifyBoard('Qh8c2s').connectedness).toBe(2);
  });
  it('counts two-rank holdings that make a straight', () => {
    // J-T-9: KQ, Q8, 87 -> 3 rank combos
    expect(classifyBoard('JhTc9s').straightCombosRanks).toBe(3);
    // A-3-2 (wheel): 54 only; 4-5 is the one holding
    expect(classifyBoard('Ah3c2s').straightCombosRanks).toBe(1);
    expect(classifyBoard('Kh7c2s').straightCombosRanks).toBe(0);
    expect(classifyBoard('JhTc9s').straightPossible).toBe(true);
  });
});

describe('wetness', () => {
  it.each([
    ['Kh7c2s', 'dry'],
    ['KhKc7s', 'dry'],
    ['Th6c2s', 'dry'],
    ['Kh7h2s', 'semi-wet'],
    ['Qh8h5s', 'semi-wet'],
    ['JhTc9s', 'wet'],
    ['JhTh9s', 'wet'],
    ['Kh7h2h', 'wet'],
  ] as const)('%s is %s', (board, wetness) => {
    expect(classifyBoard(board).wetness).toBe(wetness);
  });

  it('summarises', () => {
    expect(classifyBoard('Kh7c2s').summary).toBe('K-high rainbow, dry');
    expect(classifyBoard('KhKc7s').summary).toBe('K-high rainbow, paired, dry');
  });
});

describe('range favour', () => {
  const raiser = '22+, A2s+, K9s+, Q9s+, J9s+, T9s, ATo+, KJo+, QJo';
  const caller = '22-JJ, A2s-AJs, K2s-KJs, Q8s+, J8s+, T8s+, 97s+, 86s+, 75s+, 64s+, 54s, A9o-AJo, KTo+, QTo+, JTo';

  it('labels', () => {
    expect(classifyBoard('Ah7c2s').favors).toBe('preflop-raiser');
    expect(classifyBoard('7h6h5c').favors).toBe('caller');
    expect(classifyBoard('9h6c2s').favors).toBe('neutral');
  });

  it('the labels agree with measured equity for example ranges', () => {
    const aceHigh = rangeAdvantage('Ah7c2s', raiser, caller, { seed: 1 });
    const lowConnected = rangeAdvantage('7h6h5c', raiser, caller, { seed: 1 });
    expect(aceHigh).toBeGreaterThan(0.5);
    expect(lowConnected).toBeLessThan(aceHigh);
  });
});

it('validates', () => {
  expect(() => classifyBoard('Kh7c')).toThrow();
  expect(() => classifyBoard('KhKh2c')).toThrow();
});
