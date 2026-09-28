import { describe, expect, it } from 'vitest';
import { parseCardIndices } from '../cards';
import { BUCKETS } from '../postflop/buckets';
import { buildCharts, type ChartJson } from '../preflop/charts';
import { parseRange } from '../range';
import { createRng } from '../rng';
import home from '../../data/ranges/home-40bb.json';
import {
  blockerEffect,
  bucketBreakdown,
  decodeScenario,
  encodeScenario,
  gradeEquityGuess,
  nextCardGrid,
  runLab,
  showdownVsRange,
  validateScenario,
  type LabScenario,
} from './lab';
import { bandOf, equityQuestion } from './drills';

const b = (s: string) => parseCardIndices(s);

describe('bucketBreakdown', () => {
  it('sums to 100% for several ranges and boards', () => {
    for (const [r, board] of [
      ['random', 'Kh7h2c'],
      ['QQ+, AKs, 76s', 'As8d8c'],
      ['22+, A2s+, KTo+', 'Th9h8h7c'],
      ['JJ-99', 'Ks Qs 2d 5c 9h'],
    ] as const) {
      const bd = bucketBreakdown(parseRange(r), b(board));
      expect(BUCKETS.reduce((s, k) => s + bd.shares[k], 0)).toBeCloseTo(1, 9);
    }
  });

  it('puts every AA combo in the monster/strong buckets on a low dry board', () => {
    const bd = bucketBreakdown(parseRange('AA'), b('7c4d2h'));
    expect(bd.combos).toBe(6);
    expect(bd.shares.air + bd.shares.weak).toBe(0);
  });
});

describe('blockerEffect', () => {
  it('holding the Ah removes 3 of the 6 AA combos and 1 of 4 AKs', () => {
    const e = blockerEffect(b('AhQc'), parseRange('AA, AKs'), b('7c4d2s'));
    // AA 6 + AKs 4 = 10 before; Ah removes 3 AA combos and AhKh.
    expect(e.before).toBe(10);
    expect(e.after).toBe(6);
    expect(e.removed.find((r) => r.label === 'AA')).toEqual({ label: 'AA', before: 6, after: 3 });
    expect(e.removed.find((r) => r.label === 'AKs')).toEqual({ label: 'AKs', before: 4, after: 3 });
  });

  it('board cards are removed before, not counted as hero blockers', () => {
    const e = blockerEffect(b('2c3c'), parseRange('AA'), b('As7d8h'));
    expect(e.before).toBe(3);
    expect(e.after).toBe(3);
  });
});

describe('showdownVsRange', () => {
  it('top set beats everything but ties nothing and loses to nothing on a dry board', () => {
    const s = showdownVsRange(b('KsKd') as [number, number], parseRange('QQ+, AK'), b('Kh7c2d'));
    expect(s.beats).toBeCloseTo(1, 9);
    expect(s.beatenBy).toEqual([]);
  });

  it('shares sum to 1 and lists what beats you', () => {
    const s = showdownVsRange(b('AhQd') as [number, number], parseRange('AA, KK, AQ, 77'), b('Qc7s2h'));
    expect(s.beats + s.ties + s.loses).toBeCloseTo(1, 9);
    expect(s.beatenBy.map((x) => x.label).sort()).toEqual(['77', 'AA', 'KK']);
    expect(s.beatenBy.find((x) => x.label === 'KK')!.combos).toBe(6);
    // AA: Ah is gone -> 3 combos. 77: 7s on board -> 3 combos.
    expect(s.beatenBy.find((x) => x.label === 'AA')!.combos).toBe(3);
    expect(s.beatenBy.find((x) => x.label === '77')!.combos).toBe(3);
  });
});

describe('scenario links', () => {
  const s: LabScenario = {
    name: 'Set over set',
    players: [
      { kind: 'hand', text: 'AhKd' },
      { kind: 'range', text: 'QQ+, AKs, A5s-A2s' },
      { kind: 'range', text: 'random' },
    ],
    board: ['Kh', '7h', '2c'],
    dead: ['3s'],
  };
  it('round-trips', () => {
    const q = encodeScenario(s);
    expect(decodeScenario(q)).toEqual(s);
    expect(decodeScenario(`?${q}`)).toEqual(s);
  });
  it('rejects bad links', () => {
    expect(decodeScenario('')).toBeNull();
    expect(decodeScenario('p=h:AhAh~r:QQ%2B')).toBeNull();
    expect(decodeScenario('p=h:AhKd')).toBeNull(); // one player
    expect(decodeScenario('p=x:AhKd~r:QQ')).toBeNull();
  });
  it('validation catches shared cards', () => {
    expect(() => validateScenario({ players: [{ kind: 'hand', text: 'AhKd' }, { kind: 'hand', text: 'AhQs' }], board: [], dead: [] })).toThrow(/twice/);
  });
});

describe('runLab / nextCardGrid', () => {
  it('equity for a known matchup, and hero-vs-range extras', () => {
    const r = runLab({ players: [{ kind: 'hand', text: 'AsAd' }, { kind: 'range', text: 'KK' }], board: [], dead: [] });
    // AA vs KK preflop is about 82%.
    expect(r.equity.players[0]!.equity).toBeGreaterThan(0.8);
    expect(r.equity.players[0]!.equity).toBeLessThan(0.84);
    const f = runLab({ players: [{ kind: 'hand', text: 'AsAd' }, { kind: 'range', text: 'KK, 77' }], board: ['Kh', '7c', '2d'], dead: [] });
    expect(f.showdown!.beatenBy.length).toBe(2);
    expect(f.buckets!.length).toBe(2);
  });

  it('range vs range gives an advantage line', () => {
    const r = runLab({ players: [{ kind: 'range', text: 'QQ+, AK' }, { kind: 'range', text: '22-99, 76s, 65s' }], board: ['As', 'Kd', '3c'], dead: [] });
    expect(r.advantage!.equityA).toBeGreaterThan(0.5);
    expect(r.advantage!.line).toMatch(/Player 1 has the range advantage/);
  });

  it('next-card grid: blocked cards are null, the flush card is best for a flush draw', () => {
    const g = nextCardGrid({ players: [{ kind: 'hand', text: 'AhQh' }, { kind: 'hand', text: 'KsKc' }], board: ['9h', '5h', '2c', '3d'], dead: [] }, { iterations: 2000 });
    expect(g.cards.filter((c) => c.equity === null).length).toBe(8);
    expect(g.best[0]!.card.endsWith('h') || g.best[0]!.card[0] === 'A' || g.best[0]!.card[0] === 'Q').toBe(true);
    expect(g.best[0]!.equity).toBe(1);
  });
});

describe('equity guess', () => {
  it('grades by distance', () => {
    expect(gradeEquityGuess(0.5, 0.53).grade).toBe('best');
    expect(gradeEquityGuess(0.5, 0.58).grade).toBe('acceptable');
    expect(gradeEquityGuess(0.3, 0.58).grade).toBe('mistake');
  });
  it('bands', () => {
    expect(bandOf(0)).toBe(0);
    expect(bandOf(0.45)).toBe(2);
    expect(bandOf(1)).toBe(4);
  });
  it('question has exactly one best band', () => {
    const chart = buildCharts({ [home.id]: home as unknown as ChartJson })[home.id]!;
    const q = equityQuestion(chart, createRng(5), 'bronze', 'q');
    expect(q.choices.filter((c) => c.grade === 'best').length).toBe(1);
    expect(q.kind).toBe('equity.guess');
  });
});

describe('chartRangeOptions', async () => {
  const { chartRangeOptions } = await import('./lab');
  it('lists opens, defends, 3-bet/4-bet and home-game spots with non-empty ranges', () => {
    const chart = buildCharts({ [home.id]: home as unknown as ChartJson })[home.id]!;
    const opts = chartRangeOptions(chart);
    expect(opts.find((o) => o.label === 'BTN open')).toBeTruthy();
    expect(opts.some((o) => o.label.includes('iso-raise'))).toBe(true);
    expect(opts.some((o) => o.label.includes('squeeze'))).toBe(true);
    for (const o of opts) expect(o.range.weights.some((w) => w > 0)).toBe(true);
  });
});
