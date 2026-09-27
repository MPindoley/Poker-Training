import { describe, expect, it } from 'vitest';
import { parseCardIndices } from './cards';
import { EquityError, calculateEquity } from './equity';
import { evaluateIndices } from './evaluator';
import { parseRange } from './range';

const eq = (...args: Parameters<typeof calculateEquity>) => calculateEquity(...args).players.map((p) => p.equity);

describe('known preflop matchups (within 1 percentage point)', () => {
  it('AA vs KK ≈ 82% / 18% (exact)', () => {
    const r = calculateEquity(['AhAs', 'KdKc']);
    expect(r.method).toBe('exact');
    expect(r.samples).toBe(1_712_304); // C(48, 5) boards
    expect(Math.abs(r.players[0]!.equity - 0.82)).toBeLessThan(0.01);
    expect(Math.abs(r.players[1]!.equity - 0.18)).toBeLessThan(0.01);
  }, 20_000);

  it('AKs vs QQ ≈ 46% / 54% (exact)', () => {
    const [ak, qq] = eq(['AhKh', 'QsQc']);
    expect(Math.abs(ak! - 0.46)).toBeLessThan(0.01);
    expect(Math.abs(qq! - 0.54)).toBeLessThan(0.01);
  }, 20_000);

  it('AA vs a random hand ≈ 85% (Monte Carlo)', () => {
    const r = calculateEquity(['AhAs', 'random'], { seed: 7, iterations: 200_000 });
    expect(r.method).toBe('monte-carlo');
    expect(Math.abs(r.players[0]!.equity - 0.852)).toBeLessThan(0.01);
    expect(r.confidence).toBe(0.95);
    expect(r.maxMargin95).toBeGreaterThan(0);
    expect(r.maxMargin95).toBeLessThan(0.005);
  });
});

describe('result invariants', () => {
  it('equities sum to 1 and equity = win + tie share (heads-up)', () => {
    const r = calculateEquity(['AhKh', 'QsQc'], { board: 'Qh7h2c' });
    const [a, b] = r.players;
    expect(a!.equity + b!.equity).toBeCloseTo(1, 12);
    expect(a!.equity).toBeCloseTo(a!.win + a!.tie / 2, 12);
    expect(a!.tie).toBeCloseTo(b!.tie, 12);
  });

  it('a board that plays for everyone is a 100% tie', () => {
    const r = calculateEquity(['2c3d', '4c5d', '6s7s'], { board: 'AhKhQhJhTh' });
    for (const p of r.players) {
      expect(p.win).toBe(0);
      expect(p.tie).toBe(1);
      expect(p.equity).toBeCloseTo(1 / 3, 12);
    }
  });

  it('river showdowns are 0 or 1', () => {
    expect(eq(['AsAd', 'KsKd'], { board: 'Ah7c2d9s3h' })).toEqual([1, 0]);
  });

  it('suit-symmetric hands get identical equity', () => {
    const [a, b] = eq(['AsKd', 'AhKc']);
    expect(a).toBeCloseTo(b!, 12);
  });

  it('is deterministic for a fixed seed', () => {
    const a = eq(['QQ', 'AKs, AKo'], { seed: 3, iterations: 20_000 });
    const b = eq(['QQ', 'AKs, AKo'], { seed: 3, iterations: 20_000 });
    expect(a).toEqual(b);
  });
});

describe('boards', () => {
  it('flop: made hand vs flush draw', () => {
    // KsKd vs AhQh on Jh7h2c: villain has 9 hearts + 3 aces = 12 outs twice (≈46.7% by the
    // outs formula, a little less once KK's own redraws are counted), so KK is a slight favourite.
    const [kk, fd] = eq(['KsKd', 'AhQh'], { board: 'Jh7h2c' });
    expect(kk! + fd!).toBeCloseTo(1, 12);
    expect(kk).toBeGreaterThan(0.5);
    expect(kk).toBeLessThan(0.6);
  });

  it('turn: flush draw vs set is exactly the clean outs over 44 cards', () => {
    // Hero AhQh, villain 7s7c, board Kh7h2c3d. Hearts seen: Ah Qh Kh 7h, so 9 remain.
    // 2h and 3h pair the board and give villain a full house, leaving 7 clean outs.
    // Unseen river cards: 52 − 2 − 2 − 4 = 44.
    const [hero] = eq(['AhQh', '7s7c'], { board: 'Kh7h2c3d' });
    expect(hero).toBeCloseTo(7 / 44, 12);
  });

  it('matches a brute-force 3-way count on the turn', () => {
    const hands = ['AsKs', 'QdQc', '9h8h'];
    const board = 'Kd7h6h2c';
    const r = calculateEquity(hands, { board });
    const hs = hands.map(parseCardIndices);
    const b = parseCardIndices(board);
    const used = new Set([...hs.flat(), ...b]);
    const wins = [0, 0, 0];
    const shares = [0, 0, 0];
    let total = 0;
    for (let river = 0; river < 52; river++) {
      if (used.has(river)) continue;
      const scores = hs.map((h) => evaluateIndices([...h, ...b, river]));
      const best = Math.max(...scores);
      const winners = scores.filter((s) => s === best).length;
      scores.forEach((s, p) => {
        if (s !== best) return;
        if (winners === 1) wins[p]!++;
        shares[p]! += 1 / winners;
      });
      total++;
    }
    expect(total).toBe(42);
    r.players.forEach((p, i) => {
      expect(p.win).toBeCloseTo(wins[i]! / total, 12);
      expect(p.equity).toBeCloseTo(shares[i]! / total, 12);
    });
  });
});

describe('ranges', () => {
  it('hand vs range on the flop is exact and removes blocked combos', () => {
    const r = calculateEquity(['AhKd', 'KK, AA, 72o'], { board: 'Kh7c2s' });
    expect(r.method).toBe('exact');
    // Blockers from the board and hero's hand: KK has 1 live combo (KsKc), AA has 3 (Ah gone).
    // 72o live: sevens {7s,7h,7d} × deuces {2h,2d,2c} = 9 minus suited pairs (7h2h, 7d2d) = 7
    expect(r.players[1]!.combos).toBe(1 + 3 + 7);
  });

  it('weighted range equity is the weighted mix of its parts', () => {
    const opts = { board: 'Th9h4c' };
    const vsKK = calculateEquity(['AsAd', 'KK'], opts).players[0]!.equity;
    const vsQQ = calculateEquity(['AsAd', 'QQ'], opts).players[0]!.equity;
    const mixed = calculateEquity(['AsAd', 'KK, QQ@50'], opts);
    // 6 KK combos at weight 1, 6 QQ combos at weight 0.5
    expect(mixed.players[0]!.equity).toBeCloseTo((6 * vsKK + 3 * vsQQ) / 9, 10);
    expect(mixed.players[1]!.combos).toBe(9);
  });

  it('range vs range preflop via Monte Carlo agrees with symmetric expectations', () => {
    const [a, b] = eq(['QQ+, AKs', 'QQ+, AKs'], { seed: 11, iterations: 60_000 });
    expect(Math.abs(a! - 0.5)).toBeLessThan(0.01);
    expect(a! + b!).toBeCloseTo(1, 10);
  });

  it('Monte Carlo agrees with exact enumeration within its margin', () => {
    const exact = calculateEquity(['AhKh', 'QQ, JJ, T9s'], { board: '8h7h2c' });
    const mc = calculateEquity(['AhKh', 'QQ, JJ, T9s'], { board: '8h7h2c', forceMonteCarlo: true, seed: 5, iterations: 100_000 });
    expect(exact.method).toBe('exact');
    const diff = Math.abs(exact.players[0]!.equity - mc.players[0]!.equity);
    expect(diff).toBeLessThan(mc.players[0]!.margin95 * 1.5);
  });

  it('accepts Range objects', () => {
    const r = calculateEquity(['AsAd', parseRange('KK')], { board: 'Th9h4c' });
    expect(r.players[1]!.input).toBe('range');
  });
});

describe('multiway', () => {
  it('handles 9 players', () => {
    const r = calculateEquity(['AhAs', ...Array(8).fill('random')], { seed: 9, iterations: 30_000 });
    expect(r.players).toHaveLength(9);
    const sum = r.players.reduce((s, p) => s + p.equity, 0);
    expect(sum).toBeCloseTo(1, 10);
    // AA is still the favourite against 8 random hands (~35%), and random hands share the rest.
    expect(r.players[0]!.equity).toBeGreaterThan(0.3);
    expect(r.players[0]!.equity).toBeLessThan(0.4);
  });

  it('3-way preflop pairs rank in order', () => {
    const [aa, kk, qq] = eq(['AhAs', 'KhKs', 'QhQs'], { seed: 1, iterations: 60_000 });
    expect(aa).toBeGreaterThan(kk!);
    expect(kk).toBeGreaterThan(qq!);
  });
});

describe('validation', () => {
  it('rejects bad player counts, boards and collisions', () => {
    expect(() => calculateEquity(['AsAd'])).toThrow(EquityError);
    expect(() => calculateEquity(Array(10).fill('random'))).toThrow(/2 to 9/);
    expect(() => calculateEquity(['AsAd', 'KsKd'], { board: 'Kh7h' })).toThrow(/0, 3, 4 or 5/);
    expect(() => calculateEquity(['AsAd', 'AsKd'])).toThrow(/no possible hands|same card/);
    expect(() => calculateEquity(['AsAd', 'KK'], { board: 'KsKdKh', dead: 'Kc' })).toThrow(/no possible hands/);
    expect(() => calculateEquity(['AsAd', 'KsKd'], { board: 'AsKh2c' })).toThrow();
  });
});
