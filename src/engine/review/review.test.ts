import { describe, expect, it } from 'vitest';
import six from '../../data/ranges/cash-6max-100bb.json';
import { buildCharts, type ChartJson } from '../preflop/charts';
import { REGULAR_MODEL } from '../strategy/villainModel';
import { archetypeModel } from '../exploit/profiles';
import { analyzeLoggedHand, replayAmounts, type LoggedHand } from './handLog';
import { sessionProfit, sessionStats, type RealSession } from './sessions';
import { findLeaks } from './leaks';
import type { DecisionReview } from '../game/coach';

const chart = buildCharts({ [six.id]: six as unknown as ChartJson })[six.id]!;

const hand = (over: Partial<LoggedHand> = {}): LoggedHand => ({
  id: 'h1',
  date: '2026-09-27',
  heroCards: ['Ah', 'Kd'],
  board: ['Kh', '7c', '2s', '9d', '3h'],
  heroSeat: 'BTN',
  villainSeat: 'BB',
  stackBb: 100,
  bigBlind: 0.5,
  notes: '',
  actions: [
    { street: 'preflop', actor: 'hero', type: 'raise', amount: 2.5 },
    { street: 'preflop', actor: 'villain', type: 'call', amount: null },
    { street: 'flop', actor: 'villain', type: 'check', amount: null },
    { street: 'flop', actor: 'hero', type: 'bet', amount: null },
    { street: 'flop', actor: 'villain', type: 'call', amount: null },
    { street: 'turn', actor: 'villain', type: 'check', amount: null },
    { street: 'turn', actor: 'hero', type: 'bet', amount: 6 },
    { street: 'turn', actor: 'villain', type: 'call', amount: null },
    { street: 'river', actor: 'villain', type: 'bet', amount: 15 },
    { street: 'river', actor: 'hero', type: 'call', amount: null },
  ],
  ...over,
});

describe('logged hand amounts', () => {
  it('fills calls and estimates forgotten bets (2/3 pot), and tracks the pot', () => {
    const r = replayAmounts(hand());
    // Preflop: blinds 1.5, hero raises to 2.5, BB calls 1.5 more -> pot 5.5
    expect(r.actions[1]!.added).toBe(1.5);
    const flopBet = r.actions[3]!;
    expect(flopBet.estimated).toBe(true);
    expect(flopBet.resolvedTo).toBeCloseTo(5.5 * (2 / 3), 2);
    expect(r.anyEstimated).toBe(true);
    // Pot after the river call.
    const flop = flopBet.resolvedTo * 2;
    expect(r.finalPot).toBeCloseTo(5.5 + flop + 12 + 30, 2);
  });
  it('estimates preflop opens as 3bb + 1 per limper', () => {
    const r = replayAmounts(hand({ actions: [{ street: 'preflop', actor: 'hero', type: 'raise', amount: null }] }));
    expect(r.actions[0]!.resolvedTo).toBe(3);
  });
});

describe('logged hand analysis', () => {
  it('analyses every hero decision with a verdict and summary', () => {
    const a = analyzeLoggedHand(hand(), chart, REGULAR_MODEL);
    expect(a.error).toBeNull();
    expect(a.line).toBe('hero-open');
    expect(a.decisions.map((d) => d.street)).toEqual(['preflop', 'flop', 'turn', 'river']);
    expect(a.decisions[0]!.review.grade).toBe('best'); // AKo opens from the BTN
    const river = a.decisions[3]!;
    expect(river.potOddsNeeded).toBeCloseTo(15 / (river.heroAction.potBefore + 15), 6);
    expect(river.summary).toMatch(/equity and needed/);
    for (const d of a.decisions.slice(1)) expect(d.review.equity).toBeGreaterThan(0);
  });
  it('uses the opponent profile', () => {
    const nit = analyzeLoggedHand(hand(), chart, archetypeModel('nit'));
    expect(nit.decisions[3]!.summary).toMatch(/Nit/);
  });
});

describe('sessions', () => {
  const s = (date: string, location: 'home' | 'casino', buyIn: number, rebuys: number, cashOut: number, hours: number, bb: number): RealSession => ({
    id: date,
    date,
    location,
    buyIn,
    rebuys,
    cashOut,
    hours,
    smallBlind: bb / 2,
    bigBlind: bb,
    notes: '',
  });
  it('computes profit, running total, hourly and bb/hour', () => {
    const list = [s('2026-09-02', 'home', 20, 20, 65, 4, 0.5), s('2026-09-01', 'casino', 200, 0, 150, 5, 2)];
    expect(sessionProfit(list[0]!)).toBe(25);
    const st = sessionStats(list);
    expect(st.running.map((r) => r.total)).toEqual([-50, -25]);
    expect(st.profit).toBe(-25);
    expect(st.hourly).toBeCloseTo(-25 / 9, 12);
    // home: +25 / 0.5 = +50bb, casino: −50 / 2 = −25bb -> +25bb over 9h
    expect(st.bbPerHour).toBeCloseTo(25 / 9, 12);
    expect(st.byLocation.home.hourly).toBeCloseTo(25 / 4, 12);
  });
});

describe('leak finder', () => {
  const d = (over: Partial<DecisionReview>): DecisionReview => ({ street: 'turn', action: '', grade: 'mistake', evLost: 1, equity: 0.4, best: null, note: '', tags: { facingBet: true, actionType: 'fold' }, ...over });
  it('ranks leaks by estimated cost', () => {
    const leaks = findLeaks([
      d({ evLost: 2 }),
      d({ evLost: 3 }),
      d({ grade: 'best', evLost: 0 }),
      d({ street: 'river', tags: { facingBet: true, actionType: 'call' }, evLost: 8 }),
      d({ street: 'preflop', evLost: null, tags: { facingBet: true, actionType: 'call', heroPos: 'BB', preflopKind: 'vsOpen' } }),
    ]);
    expect(leaks.map((l) => l.rule.id)).toEqual(['river-calls', 'turn-folds', 'blind-calls']);
    const turn = leaks.find((l) => l.rule.id === 'turn-folds')!;
    expect(turn.count).toBe(2);
    expect(turn.opportunities).toBe(3);
    expect(turn.cost).toBe(5);
    expect(leaks.find((l) => l.rule.id === 'blind-calls')!.uncosted).toBe(1);
  });
});

describe('home-game preflop in logged hands and leaks', () => {
  const home = buildCharts({ [six.id]: six as unknown as ChartJson })[six.id]!;
  it('a raise behind limpers is graded as an iso-raise, not an open', () => {
    const h = hand({
      heroCards: ['As', 'Ad'],
      heroSeat: 'CO',
      villainSeat: 'HJ',
      actions: [
        { street: 'preflop', actor: 'villain', type: 'call', amount: null },
        { street: 'preflop', actor: 'hero', type: 'raise', amount: 3 },
        { street: 'preflop', actor: 'villain', type: 'call', amount: null },
      ],
    });
    const a = analyzeLoggedHand(h, home, REGULAR_MODEL);
    const pre = a.decisions.find((x) => x.street === 'preflop')!;
    expect(pre.review.tags!.preflopKind).toBe('vsLimpers');
    expect(pre.review.grade).toBe('best');
    expect(pre.review.tags!.isoSize).toEqual({ chosen: 3, recommended: 4 });
  });
  it('limper context counts unlogged limpers; overlimping AA is a mistake', () => {
    const h = hand({ heroCards: ['As', 'Ad'], heroSeat: 'BTN', villainSeat: 'BB', limpers: 2, actions: [{ street: 'preflop', actor: 'hero', type: 'call', amount: null }, { street: 'preflop', actor: 'villain', type: 'check', amount: null }] });
    const pre = analyzeLoggedHand(h, home, REGULAR_MODEL).decisions[0]!;
    expect(pre.review.tags!.preflopKind).toBe('vsLimpers');
    expect(pre.review.tags!.preflopCount).toBe(2);
    expect(pre.review.grade).toBe('mistake');
  });
  it('new leak rules: overlimping iso hands, small iso-raises, limp-calling', () => {
    const base = { street: 'preflop' as const, action: '', evLost: null, equity: null, note: '' };
    const leaks = findLeaks([
      { ...base, grade: 'mistake', best: 'Raise', tags: { facingBet: false, actionType: 'call', preflopKind: 'vsLimpers' } },
      { ...base, grade: 'best', best: 'Raise', tags: { facingBet: false, actionType: 'raise', preflopKind: 'vsLimpers', isoSize: { chosen: 3, recommended: 5 } } },
      { ...base, grade: 'best', best: 'Raise', tags: { facingBet: false, actionType: 'raise', preflopKind: 'vsLimpers', isoSize: { chosen: 5, recommended: 5 } } },
      { ...base, grade: 'mistake', best: 'Fold', tags: { facingBet: true, actionType: 'call', preflopKind: 'vsLimpRaise' } },
    ]);
    const ids = leaks.map((l) => l.rule.id);
    expect(ids).toEqual(expect.arrayContaining(['overlimp-iso', 'iso-small', 'limp-call']));
    expect(leaks.find((l) => l.rule.id === 'iso-small')!.count).toBe(1);
    expect(leaks.find((l) => l.rule.id === 'iso-small')!.opportunities).toBe(2);
  });
});
