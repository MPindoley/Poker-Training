import exampleJson from '../../../public/examples/postflop-FORMAT-EXAMPLE.json?raw';
import exampleCsv from '../../../public/examples/postflop-FORMAT-EXAMPLE.csv?raw';
import { describe, expect, it } from 'vitest';
import { parseCardIndices } from '../cards';
import {
  buildPostflopDb,
  canonicalFlop,
  canonicalHand,
  frequenciesForOptions,
  gradeFromFrequencies,
  importPostflopSolver,
  lookupSolverSpot,
  parseSolverAction,
  solverConfidence,
} from './solverImport';
import type { Spot } from './scenario';

const SUITS = ['s', 'h', 'd', 'c'];
const perms = (xs: string[]): string[][] => (xs.length <= 1 ? [xs] : xs.flatMap((x, i) => perms([...xs.slice(0, i), ...xs.slice(i + 1)]).map((p) => [x, ...p])));

describe('suit isomorphism', () => {
  it.each(['As7h2c', 'Ks Kh 4d', 'Th9h8h', 'QdQc2d', '7s7h7d', 'Ac5c2d'])('every suit permutation of %s maps to one key', (flop) => {
    const cards = flop.replace(/\s/g, '').match(/../g)!;
    const keys = new Set(
      perms(SUITS).map((p) => {
        const relabel = Object.fromEntries(SUITS.map((s, i) => [s, p[i]!]));
        return canonicalFlop(parseCardIndices(cards.map((c) => c[0]! + relabel[c[1]!]!).join(''))).key;
      }),
    );
    expect(keys.size).toBe(1);
  });

  it('keeps different flops apart', () => {
    expect(canonicalFlop(parseCardIndices('As7h2c')).key).not.toBe(canonicalFlop(parseCardIndices('As7s2c')).key);
    expect(canonicalFlop(parseCardIndices('As7s2s')).key).not.toBe(canonicalFlop(parseCardIndices('As7s2c')).key);
  });

  it('maps an exact combo consistently with its flop', () => {
    const a = canonicalFlop(parseCardIndices('As7h2c'));
    const b = canonicalFlop(parseCardIndices('Ad7s2h'));
    // Ah on As7h2c is "the ace of the 7's suit"; on Ad7s2h that is the As.
    expect(canonicalHand('AhKc', a.perms)).toBe(canonicalHand('AsKh', b.perms));
    expect(canonicalHand('AhKc', a.perms)).not.toBe(canonicalHand('AhKs', b.perms));
    expect(canonicalHand('AKs', a.perms)).toBe('AKs');
    expect(canonicalHand('Zz', a.perms)).toBeNull();
  });
});

describe('import parsing', () => {
  it('parses actions', () => {
    expect(parseSolverAction('bet33')).toBe('bet:0.33');
    expect(parseSolverAction('Bet 75%')).toBe('bet:0.75');
    expect(parseSolverAction('b150')).toBe('bet:1.5');
    expect(parseSolverAction('raise3x')).toBe('raise:3');
    expect(parseSolverAction('X')).toBe('check');
    expect(parseSolverAction('limp')).toBeNull();
  });

  it('refuses the FORMAT EXAMPLE file but can read it for tests', () => {
    const text = exampleJson;
    expect(importPostflopSolver(text).errors[0]).toMatch(/FORMAT EXAMPLE/);
    const r = importPostflopSolver(text, { allowExample: true });
    expect(r.errors).toEqual([]);
    expect(r.entries.length).toBe(2);
    expect(r.entries[1]!.facing).toBeCloseTo(0.33);
  });

  it('reads the CSV example', () => {
    const r = importPostflopSolver(exampleCsv);
    expect(r.errors).toEqual([]);
    expect(r.entries.length).toBe(2);
    expect(r.entries[1]!.strategy['77']).toEqual({ call: 0.5, 'raise:3': 0.5 });
  });

  it('gives clear error messages', () => {
    const bad = JSON.stringify({
      spots: [
        { pot: 'huge', positions: 'BB-BTN', stack: 100, flop: 'As7h2c', actor: 'BTN', strategy: { AA: { check: 1 } } },
        { pot: 'srp', positions: 'BB-BTN', stack: 100, flop: 'As7h', actor: 'BTN', strategy: { AA: { check: 1 } } },
        { pot: 'srp', positions: 'BB-BTN', stack: 100, flop: 'As7h2c', actor: 'CO', strategy: { AA: { check: 1 } } },
        { pot: 'srp', positions: 'BB-BTN', stack: 100, flop: 'As7h2c', actor: 'BTN', strategy: { AA: { dance: 1 }, AsKd: { check: 1 }, KK: { check: 150 } } },
      ],
    });
    const r = importPostflopSolver(bad);
    expect(r.errors.join('\n')).toMatch(/Spot 1: pot must be/);
    expect(r.errors.join('\n')).toMatch(/Spot 2: flop must be 3 different cards/);
    expect(r.errors.join('\n')).toMatch(/Spot 3: actor “CO”/);
    expect(r.errors.join('\n')).toMatch(/unknown action “dance”/);
    expect(r.errors.join('\n')).toMatch(/AsKd uses a card on the flop/);
    expect(r.errors.join('\n')).toMatch(/frequency “150” for KK check must be 0–1/);
    expect(importPostflopSolver('pot,flop\nsrp,As7h2c').errors[0]).toMatch(/header is missing/);
    expect(importPostflopSolver('{nope').errors[0]).toMatch(/Not valid JSON/);
  });

  it('scales frequencies that add up to more than 100%', () => {
    const r = importPostflopSolver(JSON.stringify({ spots: [{ pot: 'srp', positions: 'BB-BTN', stack: 100, flop: 'As7h2c', actor: 'BTN', strategy: { AA: { check: 60, bet33: 60 } } }] }));
    expect(r.warnings[0]).toMatch(/scaled/);
    expect(r.entries[0]!.strategy.AA!.check).toBeCloseTo(0.5);
  });
});

describe('grading from imported frequencies', () => {
  it('Best = most frequent, Acceptable ≥ 20%, else Mistake', () => {
    expect(gradeFromFrequencies([0.6, 0.3, 0.1])).toEqual(['best', 'acceptable', 'mistake']);
    expect(gradeFromFrequencies([0.05, 0.95])).toEqual(['mistake', 'best']);
    expect(solverConfidence([0.85, 0.15])).toBe('clear');
    expect(solverConfidence([0.55, 0.45])).toBe('close');
  });

  it('spreads solver sizes onto the nearest offered option', () => {
    const f = frequenciesForOptions({ check: 0.2, 'bet:0.33': 0.5, 'bet:0.75': 0.3 }, [
      { action: 'check', fraction: null },
      { action: 'bet', fraction: 0.25 },
      { action: 'bet', fraction: 0.66 },
      { action: 'bet', fraction: 1.5 },
    ]);
    expect(f).toEqual([0.2, 0.5, 0.3, 0]);
  });

  it('matches an isomorphic drill spot and finds the hand (exact combo first)', () => {
    const r = importPostflopSolver(
      JSON.stringify({ spots: [{ pot: 'srp', positions: 'BB-BTN', stack: 100, flop: 'As7h2c', actor: 'BTN', strategy: { AKo: { check: 1 }, AhKd: { bet33: 1 } } }] }),
    );
    const db = buildPostflopDb(r.entries);
    const spot = (hero: string) =>
      ({ board: parseCardIndices('Ad7s2h'), hero: parseCardIndices(hero), heroSeat: 'BTN', heroIP: true, villains: [{ seat: 'BB' }], potType: 'srp', stackBb: 100, facingBet: null, pot: 5.5 }) as unknown as Spot;
    // Ah on As7h2c ↔ As on Ad7s2h (the 7's suit); Kd ↔ Kc (the suit not on the board).
    expect(lookupSolverSpot(db, spot('AsKc'))!.freqs).toEqual({ 'bet:0.33': 1 });
    expect(lookupSolverSpot(db, spot('AcKd'))!.freqs).toEqual({ check: 1 });
    expect(lookupSolverSpot(db, { ...spot('AsKc'), stackBb: 40 } as Spot)).toBeNull();
    expect(lookupSolverSpot(db, { ...spot('AsKc'), facingBet: 2 } as Spot)).toBeNull();
  });
});
