/** N-player logged hands: migration, blinds/straddle, turn order, 3–4-way pots, side pots, multiway analysis. */
import { describe, expect, it } from 'vitest';
import home from '../../data/ranges/home-40bb.json';
import six from '../../data/ranges/cash-6max-100bb.json';
import nine from '../../data/ranges/cash-9max-100bb.json';
import { buildCharts, type ChartJson } from '../preflop/charts';
import { REGULAR_MODEL } from '../strategy/villainModel';
import { archetypeModel } from '../exploit/profiles';
import { calculateEquity } from '../equity';
import { evaluateIndices } from '../evaluator';
import { createRng } from '../rng';
import { parseCardIndices } from '../cards';
import { analyzeLoggedHand, computePots, migrateLoggedHand, preflopOrder, replayAmounts, type LoggedAction, type LoggedHand, type LoggedHandV1 } from './handLog';

const charts = buildCharts(Object.fromEntries([six, nine, home].map((j) => [j.id, j as unknown as ChartJson])));
const nineChart = charts['cash-9max-100bb']!;

const act = (street: LoggedAction['street'], actor: string, type: LoggedAction['type'], amount: number | null = null): LoggedAction => ({ street, actor, type, amount });
const make = (over: Partial<LoggedHand>): LoggedHand => ({
  version: 2,
  id: 'm1',
  date: '2026-09-27',
  heroCards: ['Ah', 'Kh'],
  board: ['Kd', '7c', '2s', '9d', '3h'],
  players: [],
  stackBb: 100,
  bigBlind: 0.5,
  actions: [],
  notes: '',
  ...over,
});

describe('migration from the old two-player shape', () => {
  // A record exactly as v1 saved it in IndexedDB.
  const OLD = JSON.parse(
    '{"id":"h-lx2k9","date":"2026-09-20","heroCards":["Qs","Qd"],"board":["Jh","8c","3d"],"heroSeat":"CO","villainSeat":"BB","villainProfileId":"p-seth","stackBb":40,"bigBlind":0.5,"notes":"Seth called light","actions":[{"street":"preflop","actor":"hero","type":"raise","amount":4},{"street":"preflop","actor":"villain","type":"call","amount":null},{"street":"flop","actor":"villain","type":"check","amount":null},{"street":"flop","actor":"hero","type":"bet","amount":5},{"street":"flop","actor":"villain","type":"call","amount":null}]}',
  ) as LoggedHandV1;

  it('becomes a players[] hand with the same actions and profile', () => {
    const h = migrateLoggedHand(OLD);
    expect(h.version).toBe(2);
    expect(h.players).toEqual([
      { id: 'hero', seat: 'CO', hero: true },
      { id: 'villain', seat: 'BB', profileId: 'p-seth' },
    ]);
    expect(h.actions.map((a) => a.actor)).toEqual(['hero', 'villain', 'villain', 'hero', 'villain']);
    expect(h.notes).toBe('Seth called light');
    expect(migrateLoggedHand(h)).toBe(h);
  });

  it('replays to the same pot as before: 4 + 4 + 0.5 dead SB, then 5 + 5 on the flop', () => {
    const r = replayAmounts(OLD);
    expect(r.finalPot).toBe(18.5);
    expect(r.heroInvested).toBe(9);
  });
});

describe('N-player replay', () => {
  const players = [
    { id: 'hero', seat: 'BTN', hero: true },
    { id: 'co', seat: 'CO' },
    { id: 'sb', seat: 'SB' },
    { id: 'bb', seat: 'BB' },
  ];

  it('3-way pot: CO opens 3, BTN and BB call (SB folds) = 9.5; flop bet 5 called twice = 24.5', () => {
    const h = make({
      players,
      actions: [act('preflop', 'co', 'raise', 3), act('preflop', 'hero', 'call'), act('preflop', 'sb', 'fold'), act('preflop', 'bb', 'call'), act('flop', 'bb', 'check'), act('flop', 'co', 'bet', 5), act('flop', 'hero', 'call'), act('flop', 'bb', 'call')],
    });
    const r = replayAmounts(h);
    expect(r.actions[3]!.potBefore).toBe(3 + 3 + 0.5 + 1);
    expect(r.actions[4]!.potBefore).toBe(9.5);
    expect(r.finalPot).toBe(24.5);
    expect(r.next!.street).toBe('turn');
    expect(r.next!.actor).toBe('bb'); // first to act postflop
    expect(r.needsBoard).toBe(4);
  });

  it('whose turn: after the CO opens it is the BTN, who can call 3 or raise to at least 5', () => {
    const r = replayAmounts(make({ players, actions: [act('preflop', 'co', 'raise', 3)] }));
    expect(r.next).toMatchObject({ actor: 'hero', toCall: 3, canCheck: false, canRaise: true, minTo: 5, street: 'preflop' });
  });

  it('4-way limped pot with an iso: the pot adds up and the BB gets its option', () => {
    const p4 = [...players, { id: 'utg', seat: 'UTG' }];
    const h = make({ players: p4, actions: [act('preflop', 'utg', 'call'), act('preflop', 'co', 'call'), act('preflop', 'hero', 'call'), act('preflop', 'sb', 'call')] });
    const r = replayAmounts(h);
    expect(r.finalPot).toBe(5);
    expect(r.next).toMatchObject({ actor: 'bb', canCheck: true });
    const h2 = make({ players: p4, actions: [...h.actions, act('preflop', 'bb', 'raise', null)] });
    // Unknown iso: 3bb + 1 per limper (4 limpers) = 7, estimated.
    const r2 = replayAmounts(h2);
    expect(r2.actions[4]!.resolvedTo).toBe(7);
    expect(r2.actions[4]!.estimated).toBe(true);
    expect(r2.next!.actor).toBe('utg');
  });

  it('straddle: UTG posts 2, UTG+1 acts first, the straddler acts last with an option', () => {
    const ps = [
      { id: 'hero', seat: 'CO', hero: true },
      { id: 'utg', seat: 'UTG' },
      { id: 'u1', seat: 'UTG+1' },
      { id: 'bb', seat: 'BB' },
    ];
    const h = make({ players: ps, straddle: true });
    expect(preflopOrder(h)).toEqual(['u1', 'hero', 'bb', 'utg']);
    const r = replayAmounts(h);
    expect(r.finalPot).toBe(3.5); // 0.5 dead SB + 1 + 2
    expect(r.next).toMatchObject({ actor: 'u1', toCall: 2, minTo: 4 });
    const done = replayAmounts({ ...h, actions: [act('preflop', 'u1', 'call'), act('preflop', 'hero', 'call'), act('preflop', 'bb', 'call')] });
    expect(done.next).toMatchObject({ actor: 'utg', canCheck: true });
  });

  it('side pots when a short stack is all-in', () => {
    const ps = [
      { id: 'short', seat: 'UTG', stackBb: 10 },
      { id: 'b', seat: 'BTN' },
      { id: 'hero', seat: 'BB', hero: true },
    ];
    const h = make({
      players: ps,
      actions: [act('preflop', 'short', 'raise', 10), act('preflop', 'b', 'call'), act('preflop', 'hero', 'call'), act('flop', 'hero', 'check'), act('flop', 'b', 'bet', 20), act('flop', 'hero', 'call')],
    });
    const r = replayAmounts(h);
    expect(r.allIn).toContain('short');
    expect(r.pots).toEqual([
      { amount: 30.5, eligible: ['short', 'b', 'hero'] }, // 10 × 3 + the dead 0.5 SB
      { amount: 40, eligible: ['b', 'hero'] },
    ]);
    // The all-in player isn't asked to act again.
    expect(r.next?.actor).not.toBe('short');
  });

  it('computePots: a folded player’s chips stay in the pot they reached', () => {
    const pots = computePots({ a: 5, b: 20, c: 20, d: 12 }, new Set(['d']));
    expect(pots).toEqual([
      { amount: 20, eligible: ['a', 'b', 'c'] },
      { amount: 37, eligible: ['b', 'c'] },
    ]);
    expect(pots.reduce((s, p) => s + p.amount, 0)).toBe(57);
  });
});

describe('multi-way equity', () => {
  it('AA vs two random hands (~73%): engine equity matches an independent simulation within 1.5 points', () => {
    const engine = calculateEquity(['AsAh', 'random', 'random'], { iterations: 60000, seed: 3, forceMonteCarlo: true }).players[0]!.equity;
    // Independent reference: deal random opponents and boards and evaluate directly.
    const rng = createRng(99);
    const aa = parseCardIndices('AsAh');
    let share = 0;
    const n = 60000;
    for (let t = 0; t < n; t++) {
      const deck = Array.from({ length: 52 }, (_, i) => i).filter((c) => !aa.includes(c));
      for (let i = 0; i < 9; i++) {
        const j = i + Math.floor(rng() * (deck.length - i));
        [deck[i], deck[j]] = [deck[j]!, deck[i]!];
      }
      const board = deck.slice(4, 9);
      const scores = [evaluateIndices([...aa, ...board]), evaluateIndices([deck[0]!, deck[1]!, ...board]), evaluateIndices([deck[2]!, deck[3]!, ...board])];
      const best = Math.max(...scores);
      const winners = scores.filter((x) => x === best).length;
      if (scores[0] === best) share += 1 / winners;
    }
    const reference = share / n;
    expect(Math.abs(engine - reference)).toBeLessThan(0.015);
    expect(reference).toBeGreaterThan(0.7);
    expect(reference).toBeLessThan(0.76);
  });
});

describe('multi-way analysis', () => {
  const players = [
    { id: 'hero', seat: 'BTN', hero: true },
    { id: 'co', seat: 'CO', name: 'Seth' },
    { id: 'bb', seat: 'BB', shownCards: ['9s', '9h'] },
  ];
  const h = make({
    players,
    heroCards: ['Ah', 'Kh'],
    board: ['Kd', '7c', '2s'],
    actions: [act('preflop', 'co', 'raise', 3), act('preflop', 'hero', 'call'), act('preflop', 'bb', 'call'), act('flop', 'bb', 'check'), act('flop', 'co', 'bet', 5), act('flop', 'hero', 'call')],
  });

  it('grades hero against every opponent still in, tags the opponent count, and shows what they had', () => {
    const a = analyzeLoggedHand(h, nineChart, REGULAR_MODEL, { models: { co: archetypeModel('station') } });
    expect(a.error).toBeNull();
    const flop = a.decisions.find((d) => d.street === 'flop')!;
    expect(flop.opponents.map((o) => o.id).sort()).toEqual(['bb', 'co']);
    expect(flop.review.tags!.opponents).toBe(2);
    expect(flop.review.tags!.opponentArchetypes).toEqual(['station']);
    expect(flop.summary).toMatch(/2 opponents \(Seth, BB\)/);
    expect(flop.summary).toMatch(/Multi-way/);
    expect(flop.potOddsNeeded).toBeCloseTo(5 / (9.5 + 5 + 5), 6);
    expect(flop.actual!.shown[0]).toMatch(/BB: \{9s\}\{9h\}/);
    expect(flop.actual!.equity).toBeGreaterThan(0);
    // The grade is about the decision against ranges, so it doesn't depend on the shown cards.
    const noShow = analyzeLoggedHand({ ...h, players: players.map((p) => ({ ...p, shownCards: undefined })) }, nineChart, REGULAR_MODEL, { models: { co: archetypeModel('station') } });
    expect(noShow.decisions.find((d) => d.street === 'flop')!.review.grade).toBe(flop.review.grade);
  });

  it('narrows each opponent separately (the caller’s range is not the opener’s)', () => {
    const a = analyzeLoggedHand(h, nineChart, REGULAR_MODEL);
    const flop = a.decisions.find((d) => d.street === 'flop')!;
    expect(flop.analysis!.villainCombos).toBeGreaterThan(0);
    expect(a.decisions[0]!.review.tags!.preflopKind).toBe('vsOpen');
  });
});
