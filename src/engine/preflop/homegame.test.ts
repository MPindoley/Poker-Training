/** Home-game preflop spots: limpers, squeezes, limp-raises, 4-bets, straddles, and solver import of them. */
import { describe, expect, it } from 'vitest';
import six from '../../data/ranges/cash-6max-100bb.json';
import nine from '../../data/ranges/cash-9max-100bb.json';
import home from '../../data/ranges/home-40bb.json';
import { countCombos, parseRange, type Range } from '../range';
import { buildCharts, overlappingCombos, strategyFor, type ActionRanges, type Chart, type ChartJson } from './charts';
import { preflopReason } from './reasons';
import { squeezeSize, isoSize, SQUEEZE_SIZING } from './sizing';
import { importSolverOutput, resolveSpotPath } from './solverImport';
import { straddleView } from './straddle';

const library = Object.fromEntries([six, nine, home].map((j) => [j.id, j as unknown as ChartJson]));
const charts = buildCharts(library);
const all = Object.values(charts);
const combos = (r: Range | undefined) => (r ? countCombos(r) : 0);

/** True if every combo weight in `a` is at most its weight in `b`. */
function within(a: Range, b: Range): boolean {
  for (let i = 0; i < 1326; i++) if (a.weights[i]! > b.weights[i]! + 1e-9) return false;
  return true;
}
function union(ranges: (Range | undefined)[]): Range {
  const w = new Float64Array(1326);
  for (const r of ranges) if (r) for (let i = 0; i < 1326; i++) w[i] = Math.max(w[i]!, r.weights[i]!);
  return { weights: w };
}
const allSpots = (c: Chart): ActionRanges[] => [
  ...c.limperSpots().map((s) => c.vsLimpers(s.seat, s.limpers)!),
  ...c.squeezeSpots().map((s) => c.squeeze(s.seat, s.callers)!),
  ...c.limpRaiseSeats().map((s) => c.vsLimpRaise(s)!),
  ...c.facing4betSeats().map((s) => c.vs4bet(s)!),
];

describe('limper spots', () => {
  it('every seat with enough players before it has a range for 1, 2 and 3+ limpers', () => {
    for (const c of all) {
      for (const seat of c.seats) {
        for (const n of [1, 2, 3, 5]) {
          const possible = c.seatsBefore(seat) >= Math.min(n, 3);
          expect(!!c.vsLimpers(seat, n), `${c.id} ${seat} ${n}`).toBe(possible);
        }
      }
    }
  });

  it('counts combos exactly (home EP vs 1 limper: 77+, ATs+, KJs+, QJs, AJo+, KQo)', () => {
    const s = charts['home-40bb']!.vsLimpers('UTG+1', 1)!;
    // 8 pairs × 6 + 4 suited aces × 4 + 2 suited kings × 4 + QJs 4 + 3 offsuit aces × 12 + KQo 12
    expect(countCombos(s.ranges.raise!)).toBe(8 * 6 + 4 * 4 + 2 * 4 + 4 + 3 * 12 + 12);
    expect(s.path).toBe('vsLimpers.EP.1');
  });

  it('no combo is in two actions at once, in any new spot of any chart', () => {
    for (const c of all) for (const sp of allSpots(c)) expect(overlappingCombos(sp), `${c.id} ${sp.path}`).toEqual([]);
  });

  it('iso-raise ranges get tighter as limpers increase (3+ ⊆ 2 ⊆ 1)', () => {
    for (const c of all) {
      for (const seat of c.seats) {
        const r = [1, 2, 3].map((n) => c.vsLimpers(seat, n)?.ranges.raise);
        if (r[0] && r[1]) expect(within(r[1], r[0]), `${c.id} ${seat} 2⊆1`).toBe(true);
        if (r[1] && r[2]) expect(within(r[2], r[1]), `${c.id} ${seat} 3⊆2`).toBe(true);
        if (r[0] && r[2]) expect(combos(r[2])).toBeLessThan(combos(r[0]));
      }
    }
  });

  it('the big blind checks (never folds) and the rest action is reported', () => {
    const bb = charts['home-40bb']!.vsLimpers('BB', 2)!;
    expect(bb.rest).toBe('check');
    const s = strategyFor(bb, '72o');
    expect(s.main).toBe('check');
    expect(s.freq.fold).toBeUndefined();
    expect(strategyFor(bb, 'AA').main).toBe('raise');
  });

  it('home game: small pairs overlimp late, offsuit broadways fold early vs 3 limpers', () => {
    const c = charts['home-40bb']!;
    expect(strategyFor(c.vsLimpers('BTN', 3)!, '66').main).toBe('limp');
    expect(strategyFor(c.vsLimpers('LJ', 3)!, 'KTo').main).toBe('fold');
    expect(strategyFor(c.vsLimpers('LJ', 3)!, 'QJo').main).toBe('fold');
    expect(strategyFor(c.vsLimpers('CO', 1)!, 'AQo').main).toBe('raise');
  });
});

describe('squeeze, limp-raise and 4-bet spots', () => {
  it('squeeze 3-bets are no wider than the widest plain 3-bet from the same seat', () => {
    for (const c of all) {
      for (const { seat, callers } of c.squeezeSpots()) {
        const plain = c.facingOpenPairs().filter((p) => p.seat === seat).map((p) => combos(c.vsOpen(seat, p.opener)!.ranges['3bet']));
        if (!plain.length) continue;
        expect(combos(c.squeeze(seat, callers)!.ranges['3bet']), `${c.id} ${seat} ${callers}`).toBeLessThanOrEqual(Math.max(...plain) + 1e-9);
      }
    }
  });

  it('home squeezes are value-heavy: no hand below JJ / AQs / AKo in the squeeze range except one A5s bluff', () => {
    const c = charts['home-40bb']!;
    for (const { seat, callers } of c.squeezeSpots()) {
      const r = c.squeeze(seat, callers)!.ranges['3bet']!;
      expect(within(r, parseRange('JJ+, AQs+, AKo, A5s')), `${seat} ${callers}`).toBe(true);
    }
  });

  it('limp-raise continues only with hands every seat in the group can limp (the 1-limper overlimp range)', () => {
    for (const c of all) {
      for (const seat of c.limpRaiseSeats()) {
        const limps = union([c.vsLimpers(seat, 1)?.ranges.limp]);
        const sp = c.vsLimpRaise(seat)!;
        expect(within(sp.ranges.call!, limps), `${c.id} ${seat}`).toBe(true);
        expect(within(sp.ranges['3bet']!, limps)).toBe(true);
        // Limp-calling is weak: most limps fold to a raise.
        expect(combos(sp.ranges.call) + combos(sp.ranges['3bet'])).toBeLessThan(countCombos(limps) / 2);
      }
    }
  });

  it('4-bet responses only use hands that 3-bet from that seat', () => {
    for (const c of all) {
      for (const seat of c.facing4betSeats()) {
        const threeBets = union([
          ...c.facingOpenPairs().filter((p) => p.seat === seat).map((p) => c.vsOpen(seat, p.opener)!.ranges['3bet']),
          ...[1, 2].map((n) => c.squeeze(seat, n)?.ranges['3bet']),
        ]);
        const sp = c.vs4bet(seat)!;
        expect(within(union([sp.ranges['5bet'], sp.ranges.call]), threeBets), `${c.id} ${seat}`).toBe(true);
      }
    }
  });

  it('at 40bb facing a 4-bet is jam or fold', () => {
    const c = charts['home-40bb']!;
    for (const seat of c.facing4betSeats()) expect(combos(c.vs4bet(seat)!.ranges.call)).toBe(0);
  });

  it('9-handed charts inherit the new sections through their own seat groups', () => {
    const c = charts['cash-9max-100bb']!;
    expect(c.vsLimpers('LJ', 2)!.path).toBe('vsLimpers.MP.2');
    expect(c.vsLimpers('UTG+1', 1)!.path).toBe('vsLimpers.EP.1');
    expect(c.vsLimpers('UTG', 1)).toBeNull();
  });
});

describe('sizing', () => {
  it('squeeze: 3x + 1 per caller in position, 4x + 1 per caller out of position', () => {
    expect(squeezeSize(2.5, 1, true).best).toBe(2.5 * (SQUEEZE_SIZING.ipOpenMultiple + 1));
    expect(squeezeSize(2.5, 2, false).best).toBe(2.5 * (SQUEEZE_SIZING.oopOpenMultiple + 2));
    expect(squeezeSize(4, 1, true).reason).toContain('16bb');
  });
  it('iso: 3bb + 1 per limper (casino), 4bb + 1 per limper (home)', () => {
    expect(isoSize('casino', 'CO', 2).best).toBe(5);
    expect(isoSize('home', 'CO', 3).best).toBe(7);
  });
});

describe('straddles', () => {
  const seats = charts['home-40bb']!.seats;
  it('the straddler reads as the BB and acts last; everyone else plays one seat tighter', () => {
    const v = straddleView(seats, 40);
    expect(v.seatMap.UTG).toBe('BB');
    expect(v.preflopOrder[v.preflopOrder.length - 1]).toBe('UTG');
    expect(v.preflopOrder[0]).toBe('UTG+1');
    expect(v.seatMap['UTG+1']).toBe('UTG');
    expect(v.seatMap.BTN).toBe('CO');
    expect(v.seatMap.SB).toBe('SB');
    expect(v.seatMap.BB).toBe('SB');
    expect(v.effectiveStack).toBe(20);
  });
  it('works for 6-handed seats too', () => {
    const v = straddleView(charts['cash-6max-100bb']!.seats, 100);
    expect(v.seatMap).toMatchObject({ UTG: 'BB', HJ: 'UTG', CO: 'HJ', BTN: 'CO' });
  });
});

describe('reasons', () => {
  it('explains an overlimp with the computed set chance', () => {
    const text = preflopReason({ kind: 'vsLimpers', label: '66', seat: 'BTN', best: 'limp', chosen: 'limp', rangeFraction: 0.2, playersBehind: 2, count: 3 });
    expect(text).toMatch(/^66 overlimps behind 3 limpers or more on the button: it wants a cheap multi-way flop to hit a set \(\d+\.\d%/);
  });
  it('every new spot/action pair has a reason', () => {
    for (const kind of ['vsLimpers', 'squeeze', 'vsLimpRaise', 'vs4bet'] as const)
      for (const best of ['raise', 'limp', 'check', 'fold', '3bet', 'call', '5bet'] as const) {
        const t = preflopReason({ kind, label: 'KTo', seat: 'CO', best, chosen: 'fold', rangeFraction: 0.1, playersBehind: 3, count: 2 });
        expect(t.length).toBeGreaterThan(20);
      }
  });
});

describe('solver import of the new spots', () => {
  it('resolves seats and groups, with 3+ accepted', () => {
    const c = charts['cash-9max-100bb']!;
    expect(resolveSpotPath(c, 'vsLimpers.BTN.3+')!.path).toBe('vsLimpers.BTN.3');
    expect(resolveSpotPath(c, 'vsLimpers.MP.2')!.path).toBe('vsLimpers.MP.2');
    expect(resolveSpotPath(c, 'squeeze.BB.2')!.path).toBe('squeeze.BB.2');
    expect(resolveSpotPath(c, 'vs4bet.CO')!.path).toBe('vs4bet.CO');
    expect(resolveSpotPath(c, 'vsLimpRaise.SB')!.path).toBe('vsLimpRaise.SB');
    expect(resolveSpotPath(c, 'vsLimpers.UTG.1')).toBeNull();
  });

  it('round-trips: imported frequencies come back out of the chart', () => {
    const csv = [
      'spot,hand,action,frequency',
      'vsLimpers.BTN.2,AA,iso,1',
      'vsLimpers.BTN.2,66,overlimp,1',
      'vsLimpers.BTN.2,A5s,raise,50%',
      'vsLimpers.BTN.2,A5s,limp,50%',
      'squeeze.BB.1,QQ,squeeze,1',
      'squeeze.BB.1,T9s,call,1',
      'vs4bet.CO,AA,jam,1',
      'vsLimpRaise.BTN,55,call,1',
      'vsLimpers.BB.1,AKo,raise,1',
      'vsLimpers.BB.1,72o,check,1',
    ].join('\n');
    const r = importSolverOutput(csv, charts, 'home-40bb');
    expect(r.errors).toEqual([]);
    const c = buildCharts(library, { 'home-40bb': r.overrides })['home-40bb']!;
    const btn = c.vsLimpers('BTN', 2)!;
    expect(strategyFor(btn, 'AA').freq.raise).toBe(1);
    expect(strategyFor(btn, '66').main).toBe('limp');
    expect(strategyFor(btn, 'A5s').freq.raise).toBeCloseTo(0.5);
    expect(strategyFor(btn, 'KQo').main).toBe('fold');
    expect(strategyFor(c.squeeze('BB', 1)!, 'QQ').main).toBe('3bet');
    expect(strategyFor(c.vs4bet('CO')!, 'AA').main).toBe('5bet');
    expect(strategyFor(c.vsLimpRaise('BTN')!, '55').main).toBe('call');
    expect(strategyFor(c.vsLimpers('BB', 1)!, '72o').main).toBe('check');
  });

  it('rejects actions that do not exist in a spot', () => {
    const r = importSolverOutput('spot,hand,action,frequency\nvsLimpers.BTN.1,AA,4bet,1', charts, 'home-40bb');
    expect(r.errors[0]).toMatch(/raise\/limp/);
  });
});
