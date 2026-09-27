import { describe, expect, it } from 'vitest';
import six from '../../data/ranges/cash-6max-100bb.json';
import nine from '../../data/ranges/cash-9max-100bb.json';
import home from '../../data/ranges/home-40bb.json';
import { buildQuestion } from '../drills/round';
import { DIFFICULTIES, bestChoice } from '../drills/types';
import { parseRange, rangeFraction, countCombos } from '../range';
import { buildCharts, overlappingCombos, strategyFor, type ChartJson } from './charts';
import { handGroup } from './groups';
import { makePreflopDrills } from './drills';
import { scorePaint } from './paint';
import { bigBlindPrice, sizingRule } from './sizing';

const library = Object.fromEntries([six, nine, home].map((j) => [j.id, j as unknown as ChartJson]));
const charts = buildCharts(library);
const c6 = charts['cash-6max-100bb']!;
const c9 = charts['cash-9max-100bb']!;
const ch = charts['home-40bb']!;

describe('chart data sanity', () => {
  for (const chart of Object.values(charts)) {
    it(`${chart.id}: every range parses and no combo is over 100%`, () => {
      for (const seat of chart.openingSeats) {
        const r = chart.rfi(seat)!;
        expect(countCombos(r.ranges.raise!)).toBeGreaterThan(0);
      }
      for (const { seat, opener } of chart.facingOpenPairs()) expect(overlappingCombos(chart.vsOpen(seat, opener)!)).toEqual([]);
      for (const seat of chart.facing3betSeats()) expect(overlappingCombos(chart.vs3bet(seat)!)).toEqual([]);
    });

    it(`${chart.id}: opening ranges widen from first seat to the button`, () => {
      const seats = chart.openingSeats.filter((s) => s !== 'SB');
      for (let i = 1; i < seats.length; i++) {
        const tight = chart.rfi(seats[i - 1]!)!.ranges.raise!;
        const wide = chart.rfi(seats[i]!)!.ranges.raise!;
        tight.weights.forEach((w, k) => expect(wide.weights[k]!).toBeGreaterThanOrEqual(w));
        expect(rangeFraction(wide)).toBeGreaterThan(rangeFraction(tight));
      }
    });
  }

  it('opening frequencies sit in plausible bands', () => {
    const pct = (c: typeof c9, s: string) => rangeFraction(c.rfi(s)!.ranges.raise!);
    expect(pct(c9, 'UTG')).toBeGreaterThan(0.08);
    expect(pct(c9, 'UTG')).toBeLessThan(0.14);
    expect(pct(c6, 'UTG')).toBeGreaterThan(0.15);
    expect(pct(c6, 'UTG')).toBeLessThan(0.22);
    for (const c of [c6, c9]) {
      expect(pct(c, 'BTN')).toBeGreaterThan(0.4);
      expect(pct(c, 'BTN')).toBeLessThan(0.55);
    }
  });

  it('home game opens are tighter than full-ring cash from every seat', () => {
    for (const seat of ch.openingSeats) {
      expect(rangeFraction(ch.rfi(seat)!.ranges.raise!)).toBeLessThan(rangeFraction(c9.rfi(seat)!.ranges.raise!));
    }
  });

  it('home game 3-bets fewer light bluffs than 6-max (vs a late open)', () => {
    const homeBB = ch.vsOpen('BB', 'CO')!;
    const cashBB = c6.vsOpen('BB', 'CO')!;
    const bluffs = parseRange('A2s-A5s, K9s, 76s, 65s');
    const bluffShare = (r: typeof homeBB) =>
      bluffs.weights.reduce((s, w, i) => s + (w ? r.ranges['3bet']!.weights[i]! : 0), 0);
    expect(bluffShare(homeBB)).toBeLessThan(bluffShare(cashBB));
  });
});

describe('lookups', () => {
  it('9-max reuses 6-max facing ranges through seat aliases', () => {
    const r = c9.vsOpen('BB', 'MP')!;
    expect(r.notation).toEqual(c6.vsOpen('BB', 'UTG')!.notation);
    expect(c9.vs3bet('UTG+1')!.notation).toEqual(c6.vs3bet('UTG')!.notation);
  });
  it('impossible orders return null', () => {
    expect(c6.vsOpen('CO', 'BTN')).toBeNull();
    expect(c6.vsOpen('BTN', 'BTN')).toBeNull();
  });
  it('strategy lookups', () => {
    expect(strategyFor(c9.rfi('UTG')!, 'AA')).toEqual({ freq: { raise: 1, fold: 0 }, main: 'raise' });
    expect(strategyFor(c9.rfi('UTG')!, '72o').main).toBe('fold');
    const mixed = strategyFor(c6.vsOpen('BB', 'HJ')!, 'KQs');
    expect(mixed.freq['3bet']).toBeCloseTo(0.5);
    expect(mixed.freq.call).toBeCloseTo(0.5);
    expect(mixed.freq.fold).toBeCloseTo(0);
  });
  it('overrides replace a range', () => {
    const edited = buildCharts(library, { 'cash-6max-100bb': { 'rfi.UTG.raise': 'AA' } })['cash-6max-100bb']!;
    expect(countCombos(edited.rfi('UTG')!.ranges.raise!)).toBe(6);
    expect(strategyFor(edited.rfi('UTG')!, 'KK').main).toBe('fold');
  });
});

describe('hand groups', () => {
  it.each([
    ['QQ', 'pairs'],
    ['A5s', 'suited-aces'],
    ['KQo', 'broadways'],
    ['AKs', 'suited-aces'],
    ['JTs', 'broadways'],
    ['76s', 'suited-connectors'],
    ['96s', 'suited-connectors'],
    ['K4s', 'suited-other'],
    ['A7o', 'offsuit-aces'],
    ['83o', 'offsuit-junk'],
  ])('%s is %s', (label, group) => expect(handGroup(label)).toBe(group));
});

describe('sizing rules', () => {
  it('casino and home defaults', () => {
    expect(sizingRule('casino', 'CO', 0).best).toBe(2.5);
    expect(sizingRule('casino', 'SB', 0).best).toBe(3);
    expect(sizingRule('casino', 'BTN', 2).best).toBe(5);
    expect(sizingRule('home', 'CO', 0).best).toBe(4);
    expect(sizingRule('home', 'CO', 3).best).toBe(7);
  });
  it('big blind price', () => {
    expect(bigBlindPrice(2.5)).toBeCloseTo(1.5 / 5.5, 12);
    expect(bigBlindPrice(4)).toBeCloseTo(3 / 8.5, 12);
    // SB raises to 3bb: pot 3 + 1, BB calls 2 -> 2/6
    expect(bigBlindPrice(3, 0, 0)).toBeCloseTo(2 / 6, 12);
    expect(bigBlindPrice(4)).toBeGreaterThan(bigBlindPrice(2.5));
  });
});

describe('paint scoring', () => {
  const range = parseRange('QQ+, AKs');
  it('perfect, empty and sloppy paints', () => {
    expect(scorePaint(new Set(['QQ', 'KK', 'AA', 'AKs']), range).accuracy).toBe(1);
    expect(scorePaint(new Set(), range).accuracy).toBe(0);
    const s = scorePaint(new Set(['QQ', 'KK', 'AA', 'AKs', 'AKo']), range);
    expect(s.extra).toBe(12);
    expect(s.accuracy).toBeCloseTo(22 / 34, 12);
    expect(s.extraLabels).toEqual(['AKo']);
    const m = scorePaint(new Set(['AA']), range);
    expect(m.missedLabels.sort()).toEqual(['AKs', 'KK', 'QQ']);
  });
});

describe('preflop drills', () => {
  for (const chart of Object.values(charts)) {
    const drills = makePreflopDrills({ chart, skills: {} });
    for (const drill of drills) {
      for (const difficulty of DIFFICULTIES) {
        it(`${chart.id} ${drill.kind} ${difficulty}`, () => {
          for (let i = 0; i < 8; i++) {
            const q = buildQuestion({ drills: [drill], difficulty, skills: {}, seed: 300 + i * 13 }, i);
            expect(q.choices.filter((c) => c.grade === 'best')).toHaveLength(1);
            expect(new Set(q.choices.map((c) => c.label)).size).toBe(q.choices.length);
            expect(q.explanation.summary).not.toMatch(/undefined|NaN/);
            expect(q.prompt).toMatch(/\?$/);
          }
        });
      }
    }
  }

  it('flash card best answer is the chart action', () => {
    const drill = makePreflopDrills({ chart: c9, skills: {} })[0]!;
    for (let i = 0; i < 30; i++) {
      const q = buildQuestion({ drills: [drill], difficulty: 'silver', skills: {}, seed: 5 + i }, i);
      const seat = q.skill.split(':')[2]!;
      const label = q.visual!.highlight!;
      const main = strategyFor(c9.rfi(seat)!, label).main;
      expect(bestChoice(q).label.toLowerCase()).toContain(main === 'raise' ? 'raise' : 'fold');
    }
  });
});
