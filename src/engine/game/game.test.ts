import { describe, expect, it } from 'vitest';
import six from '../../data/ranges/cash-6max-100bb.json';
import { buildCharts, type ChartJson } from '../preflop/charts';
import { createRng } from '../rng';
import { parseCardIndices } from '../cards';
import { countCombos } from '../range';
import { analyzeSpot } from '../strategy/analyze';
import { ARCHETYPES } from '../exploit/profiles';
import { applyAction, legalActions, startHand, type HandState } from './holdem';
import { botDecision, handPercentile, makeBot, type BotProfile } from './bots';
import { initialRanges, updateRanges } from './tracker';
import { allInAdjusted, gradePreflop, matchOption, preflopAdvice, spotFromGame, summarizeSession } from './coach';
import { positionsFor } from './positions';

const chart = buildCharts({ [six.id]: six as unknown as ChartJson })[six.id]!;

describe('positions', () => {
  it('names seats from the button', () => {
    expect(positionsFor([0, 1, 2, 3, 4, 5], 0, 6)).toEqual({ 0: 'BTN', 1: 'SB', 2: 'BB', 3: 'UTG', 4: 'HJ', 5: 'CO' });
    expect(positionsFor([0, 2, 4], 2, 6)).toEqual({ 2: 'BTN', 4: 'SB', 0: 'BB' });
    expect(positionsFor([1, 3], 3, 6)).toEqual({ 3: 'BTN', 1: 'BB' });
  });
});

describe('bots', () => {
  it('hand percentile: AA near 0, 72o near 1', () => {
    expect(handPercentile('AA')).toBeLessThan(0.01);
    expect(handPercentile('72o')).toBeGreaterThan(0.9);
  });

  function playOrbit(bots: BotProfile[], seed: number): HandState {
    const cfg = bots.map((b) => ({ name: b.name, stack: 100 }));
    let s = startHand(cfg, 0, { sb: 0.5, bb: 1 }, createRng(seed));
    const rng = createRng(seed + 1);
    let guard = 0;
    while (!s.finished && guard++ < 100) s = applyAction(s, botDecision(s, bots[s.toAct!]!, rng));
    return s;
  }

  it('always make legal decisions and finish hands', () => {
    const bots = Object.values(ARCHETYPES).map((a) => makeBot(a.short, a.stats, a.id));
    for (let i = 0; i < 150; i++) expect(playOrbit(bots, i).finished).toBe(true);
  });

  it('loose archetypes voluntarily play more hands than nits', () => {
    const vpipOf = (id: 'station' | 'nit') => {
      let played = 0;
      let dealt = 0;
      for (let i = 0; i < 200; i++) {
        const bots = [makeBot('X', ARCHETYPES[id].stats, id), makeBot('T', ARCHETYPES.tag.stats, 'tag'), makeBot('T2', ARCHETYPES.tag.stats, 'tag')];
        const s = startHand(bots.map((b) => ({ name: b.name, stack: 100 })), 1, { sb: 0.5, bb: 1 }, createRng(i));
        // Seat 0 acts first 3-handed with the button on seat 1? Find its first action.
        let t = s;
        const rng = createRng(1000 + i);
        while (!t.finished && t.toAct !== 0) t = applyAction(t, botDecision(t, bots[t.toAct!]!, rng));
        if (t.finished) continue;
        dealt++;
        const a = botDecision(t, bots[0]!, rng);
        if (a.type === 'call' || a.type === 'raise' || a.type === 'bet') played++;
      }
      return played / dealt;
    };
    expect(vpipOf('station')).toBeGreaterThan(vpipOf('nit') * 2);
  });
});

describe('range tracker', () => {
  it('narrows a raiser to its PFR range and a flop caller further', () => {
    const bots: Record<number, BotProfile> = { 1: makeBot('Nit', ARCHETYPES.nit.stats, 'nit') };
    let s = startHand([{ name: 'Hero', stack: 100, hero: true }, { name: 'Nit', stack: 100 }], 1, { sb: 0.5, bb: 1 }, createRng(5));
    let ranges = initialRanges(s);
    const step = (a: Parameters<typeof applyAction>[1]) => {
      const next = applyAction(s, a);
      ranges = updateRanges(ranges, s, next.log[next.log.length - 1]!, bots);
      s = next;
    };
    // Heads-up: seat 1 (button/SB) acts first.
    step({ type: 'raise', to: 3 });
    expect(countCombos(ranges[1]!)).toBeCloseTo(0.09 * 1326, 0);
    step({ type: 'call' });
    step({ type: 'check' });
    const before = countCombos(ranges[1]!);
    step({ type: 'bet', to: 3 });
    expect(countCombos(ranges[1]!)).toBeLessThan(before);
  });
});

describe('range tracker: calls and checks', () => {
  const play = (bots: Record<number, BotProfile>, actions: Parameters<typeof applyAction>[1][]) => {
    let s = startHand([{ name: 'A', stack: 100, hero: !bots[0] }, { name: 'B', stack: 100, hero: !bots[1] }], 1, { sb: 0.5, bb: 1 }, createRng(11));
    let ranges = initialRanges(s);
    const sizes: number[] = [countCombos(ranges[0]!), countCombos(ranges[1]!)];
    const history: number[][] = [];
    for (const a of actions) {
      const next = applyAction(s, a);
      ranges = updateRanges(ranges, s, next.log[next.log.length - 1]!, bots);
      s = next;
      history.push([countCombos(ranges[0]!), countCombos(ranges[1]!)]);
    }
    return { sizes, history };
  };

  it('a limp, a call of a raise, a flop call and a turn check each narrow the range', () => {
    // Station on the button (seat 1) limps, hero raises, station calls, then flop/turn.
    const bots = { 1: makeBot('Station', ARCHETYPES.station.stats, 'station') };
    const { sizes, history } = play(bots, [
      { type: 'call' }, // limp: seat 1's first-in calling range
      { type: 'raise', to: 4 },
      { type: 'call' }, // calls a raise: top VPIP minus top 3-bet range
      { type: 'bet', to: 4 }, // flop: hero (BB) bets
      { type: 'call' }, // station continues
      { type: 'check' }, // turn: hero checks
      { type: 'check' }, // station checks back
    ]);
    const station = [sizes[1]!, ...history.map((h) => h[1]!)];
    expect(station[1]!).toBeLessThan(1326); // limp
    expect(station[3]!).toBeLessThan(station[1]! + 1e-9); // call vs raise ⊆ tighter than limp range size
    expect(station[3]!).toBeGreaterThan(0);
    expect(station[5]!).toBeLessThanOrEqual(station[3]! + 1e-9); // flop call
    expect(station[7]!).toBeLessThanOrEqual(station[5]! + 1e-9); // turn check
    expect(station[7]!).toBeGreaterThan(0);
  });

  it('a big blind check after a limp removes its raising range', () => {
    const bots = { 0: makeBot('TAG', ARCHETYPES.tag.stats, 'tag') };
    const { sizes, history } = play(bots, [{ type: 'call' }, { type: 'check' }]);
    expect(history[1]![0]!).toBeLessThan(sizes[0]!);
    expect(history[1]![0]!).toBeGreaterThan(1326 * 0.5);
  });
});

describe('coach', () => {
  it('gives chart advice for an open and grades the action', () => {
    let s = startHand(Array.from({ length: 6 }, (_, i) => ({ name: `P${i}`, stack: 100, hero: i === 3 })), 0, { sb: 0.5, bb: 1 }, createRng(6));
    s = { ...s, seats: s.seats.map((x) => (x.index === 3 ? { ...x, hole: parseCardIndices('AsAd') } : x)) };
    const pos = positionsFor([0, 1, 2, 3, 4, 5], 0, 6);
    expect(s.toAct).toBe(3);
    const adv = preflopAdvice(s, 3, chart, pos);
    expect(adv.kind).toBe('rfi');
    expect(adv.best).toBe('raise');
    expect(gradePreflop(adv, 'raise')!.grade).toBe('best');
    expect(gradePreflop(adv, 'call')!.grade).toBe('mistake');
    expect(gradePreflop(adv, 'fold')!.grade).toBe('mistake');
  });

  it('turns a live postflop state into an analysable spot', () => {
    const bots: Record<number, BotProfile> = { 1: makeBot('TAG', ARCHETYPES.tag.stats, 'tag') };
    let s = startHand([{ name: 'Hero', stack: 100, hero: true }, { name: 'TAG', stack: 100 }], 1, { sb: 0.5, bb: 1 }, createRng(8));
    let ranges = initialRanges(s);
    for (const a of [{ type: 'raise', to: 3 }, { type: 'call' }, { type: 'check' }, { type: 'bet', to: 4 }] as const) {
      const next = applyAction(s, a);
      ranges = updateRanges(ranges, s, next.log[next.log.length - 1]!, bots);
      s = next;
    }
    const spot = spotFromGame(s, 0, ranges, bots, positionsFor([0, 1], 1, 2));
    expect(spot.facingBet).toBe(4);
    expect(spot.pot).toBe(6);
    const a = analyzeSpot(spot);
    expect(matchOption(a, 'call', 4)!.action).toBe('call');
    expect(legalActions(s)!.toCall).toBe(4);
  });

  it('all-in adjusted result uses equity at the moment of the all-in', () => {
    let s = startHand([{ name: 'Hero', stack: 50, hero: true }, { name: 'V', stack: 50 }], 1, { sb: 0.5, bb: 1 }, createRng(9));
    s = { ...s, seats: s.seats.map((x) => ({ ...x, hole: parseCardIndices(x.index === 0 ? 'AsAd' : 'KsKd') })) };
    s = applyAction(s, { type: 'raise', to: 50 });
    s = applyAction(s, { type: 'call' });
    const r = allInAdjusted(s, 0)!;
    expect(r.equity).toBeGreaterThan(0.8);
    expect(r.expected).toBeCloseTo(r.equity * 100 - 50, 1); // rounded to cents
    const sum = summarizeSession([{ handNo: 1, heroCards: [], board: [], net: r.actual, allIn: r, decisions: [] }]);
    expect(sum.adjustedNet).toBeCloseTo(r.expected, 2);
    expect(sum.luck).toBeCloseTo(r.actual - r.expected, 2);
  });
});

describe('straddle', () => {
  it('UTG posts 2bb, action starts after the straddler, and the straddler gets an option', () => {
    let s = startHand(Array.from({ length: 4 }, (_, i) => ({ name: `P${i}`, stack: 100 })), 0, { sb: 0.5, bb: 1, straddle: 2 }, createRng(21));
    expect(s.straddleSeat).toBe(3);
    expect(s.currentBet).toBe(2);
    expect(s.toAct).toBe(0);
    expect(legalActions(s)!.minTo).toBe(4);
    for (const a of [{ type: 'call' }, { type: 'call' }, { type: 'call' }] as const) s = applyAction(s, a);
    expect(s.toAct).toBe(3);
    expect(legalActions(s)!.canCheck).toBe(true);
    s = applyAction(s, { type: 'check' });
    expect(s.street).toBe('flop');
  });
});

describe('coach: home-game preflop spots', () => {
  const pos = positionsFor([0, 1, 2, 3, 4, 5], 0, 6); // 0 BTN, 1 SB, 2 BB, 3 UTG, 4 HJ, 5 CO
  const deal = (hero: number) => {
    const s = startHand(Array.from({ length: 6 }, (_, i) => ({ name: `P${i}`, stack: 100, hero: i === hero })), 0, { sb: 0.5, bb: 1 }, createRng(31));
    return { ...s, seats: s.seats.map((x) => (x.index === hero ? { ...x, hole: parseCardIndices('AsAd') } : x)) };
  };
  const play = (s: HandState, actions: Parameters<typeof applyAction>[1][]) => actions.reduce((st, a) => applyAction(st, a), s);

  it('two limpers → vsLimpers; iso-raise with AA is best, overlimping is a mistake', () => {
    const s = play(deal(5), [{ type: 'call' }, { type: 'call' }]);
    const adv = preflopAdvice(s, 5, chart, pos);
    expect(adv.kind).toBe('vsLimpers');
    expect(adv.count).toBe(2);
    expect(gradePreflop(adv, 'raise')!.grade).toBe('best');
    expect(gradePreflop(adv, 'call')!.grade).toBe('mistake');
  });
  it('an open and a caller → squeeze', () => {
    const s = play(deal(5), [{ type: 'raise', to: 2.5 }, { type: 'call' }]);
    const adv = preflopAdvice(s, 5, chart, pos);
    expect(adv.kind).toBe('squeeze');
    expect(adv.count).toBe(1);
    expect(adv.best).toBe('3bet');
  });
  it('hero limps and someone raises → vsLimpRaise', () => {
    const s = play(deal(4), [{ type: 'fold' }, { type: 'call' }, { type: 'raise', to: 4 }, { type: 'fold' }, { type: 'fold' }, { type: 'fold' }]);
    const adv = preflopAdvice(s, 4, chart, pos);
    expect(adv.kind).toBe('vsLimpRaise');
  });
  it('hero 3-bets and faces a 4-bet → vs4bet, and a jam maps to 5bet', () => {
    const s = play(deal(5), [{ type: 'raise', to: 2.5 }, { type: 'fold' }, { type: 'raise', to: 8 }, { type: 'fold' }, { type: 'fold' }, { type: 'fold' }, { type: 'raise', to: 20 }]);
    const adv = preflopAdvice(s, 5, chart, pos);
    expect(adv.kind).toBe('vs4bet');
    expect(adv.best).toBe('5bet');
    expect(gradePreflop(adv, 'raise')!.grade).toBe('best');
  });
});

describe('limping bots', () => {
  it('calling stations open-limp first in far more often than TAGs', () => {
    const firstInLimps = (id: 'station' | 'tag') => {
      let limps = 0;
      for (let i = 0; i < 400; i++) {
        const s = startHand(Array.from({ length: 6 }, (_, k) => ({ name: `P${k}`, stack: 100 })), 0, { sb: 0.5, bb: 1 }, createRng(1000 + i));
        const a = botDecision(s, makeBot('X', ARCHETYPES[id].stats, id), createRng(i));
        if (a.type === 'call') limps++;
      }
      return limps;
    };
    expect(firstInLimps('station')).toBeGreaterThan(firstInLimps('tag') * 3);
  });
});
