import { describe, expect, it } from 'vitest';
import { parseCardIndices } from '../cards';
import { createRng } from '../rng';
import { applyAction, legalActions, potSize, startHand, type HandState, type SeatConfig } from './holdem';

const seats = (...stacks: number[]): SeatConfig[] => stacks.map((stack, i) => ({ name: `P${i}`, stack, hero: i === 0 }));

/** Replace hole cards and stack the deck so the board comes out as given. */
function rig(s: HandState, holes: string[], board: string): HandState {
  const b = parseCardIndices(board);
  const used = new Set([...holes.flatMap(parseCardIndices), ...b]);
  const spare = Array.from({ length: 52 }, (_, i) => i).filter((c) => !used.has(c));
  const burn = () => spare.pop()!;
  // Pops happen from the end: burn, flop x3, burn, turn, burn, river.
  const order = [burn(), b[0]!, b[1]!, b[2]!, burn(), b[3]!, burn(), b[4]!];
  return {
    ...s,
    seats: s.seats.map((x, i) => ({ ...x, hole: holes[i] ? parseCardIndices(holes[i]!) : x.hole })),
    deck: [...spare, ...order.reverse()],
  };
}

const act = (s: HandState, ...actions: Parameters<typeof applyAction>[1][]) => actions.reduce(applyAction, s);
const chips = (s: HandState) => s.seats.reduce((a, x) => a + x.stack, 0) + potSize(s);

describe('dealing and blinds', () => {
  it('posts blinds left of the button and deals two cards each', () => {
    const s = startHand(seats(100, 100, 100, 100), 0, { sb: 0.5, bb: 1 }, createRng(1));
    expect(s.sbSeat).toBe(1);
    expect(s.bbSeat).toBe(2);
    expect(s.seats[1]!.bet).toBe(0.5);
    expect(s.seats[2]!.bet).toBe(1);
    expect(s.toAct).toBe(3); // UTG
    expect(s.seats.every((x) => x.hole.length === 2)).toBe(true);
    expect(new Set(s.seats.flatMap((x) => x.hole)).size).toBe(8);
  });
  it('heads-up: the button is the small blind and acts first preflop, last postflop', () => {
    let s = startHand(seats(100, 100), 0, { sb: 0.5, bb: 1 }, createRng(2));
    expect(s.sbSeat).toBe(0);
    expect(s.bbSeat).toBe(1);
    expect(s.toAct).toBe(0);
    s = act(s, { type: 'call' }, { type: 'check' });
    expect(s.street).toBe('flop');
    expect(s.toAct).toBe(1);
  });
  it('skips busted seats', () => {
    const s = startHand(seats(100, 0, 100, 100), 0, { sb: 0.5, bb: 1 }, createRng(3));
    expect(s.sbSeat).toBe(2);
    expect(s.bbSeat).toBe(3);
    expect(s.seats[1]!.hole).toEqual([]);
  });
});

describe('betting rules', () => {
  it('min-raise is the last raise size', () => {
    let s = startHand(seats(100, 100, 100), 0, { sb: 0.5, bb: 1 }, createRng(4));
    // Button (seat 0) acts first 3-handed.
    expect(legalActions(s)!.minTo).toBe(2);
    s = act(s, { type: 'raise', to: 3 });
    expect(legalActions(s)!.minTo).toBe(5); // 3 + (3 - 1)
    s = act(s, { type: 'raise', to: 9 });
    expect(legalActions(s)!.minTo).toBe(15);
  });
  it('the big blind gets its option when limped to', () => {
    let s = startHand(seats(100, 100, 100), 0, { sb: 0.5, bb: 1 }, createRng(5));
    s = act(s, { type: 'call' }, { type: 'call' });
    expect(s.toAct).toBe(2);
    expect(legalActions(s)!.canCheck).toBe(true);
    s = act(s, { type: 'check' });
    expect(s.street).toBe('flop');
    expect(s.toAct).toBe(1); // first active left of the button
  });
  it('everyone folds to a raise: raiser wins the blinds and the uncalled bet comes back', () => {
    let s = startHand(seats(100, 100, 100), 0, { sb: 0.5, bb: 1 }, createRng(6));
    s = act(s, { type: 'raise', to: 3 }, { type: 'fold' }, { type: 'fold' });
    expect(s.finished).toBe(true);
    expect(s.result!.showdown).toBe(false);
    expect(s.result!.net).toEqual({ 0: 1.5, 1: -0.5, 2: -1 });
    expect(s.seats[0]!.stack).toBe(101.5);
    expect(s.result!.returned).toEqual({ seat: 0, amount: 2 });
  });
  it('folding when a check is possible is treated as a check', () => {
    let s = startHand(seats(100, 100), 0, { sb: 0.5, bb: 1 }, createRng(7));
    s = act(s, { type: 'call' }, { type: 'fold' });
    expect(s.finished).toBe(false);
    expect(s.street).toBe('flop');
  });
});

describe('showdowns and pots', () => {
  it('best hand wins the pot at showdown', () => {
    let s = rig(startHand(seats(100, 100), 0, { sb: 0.5, bb: 1 }, createRng(8)), ['AsAd', 'KsKd'], '2c7h9dJcQh');
    s = act(s, { type: 'call' }, { type: 'check' });
    for (let i = 0; i < 3; i++) s = act(s, { type: 'check' }, { type: 'check' });
    expect(s.finished).toBe(true);
    expect(s.result!.showdown).toBe(true);
    expect(s.result!.net).toEqual({ 0: 1, 1: -1 });
    expect(s.result!.handNames[0]).toMatch(/Aces/);
  });

  it('splits a chopped pot', () => {
    let s = rig(startHand(seats(100, 100, 100), 0, { sb: 0.5, bb: 1 }, createRng(9)), ['2c3d', '4c5d', '8s9s'], 'AhKhQhJhTh');
    s = act(s, { type: 'call' }, { type: 'call' }, { type: 'check' });
    for (let i = 0; i < 3; i++) s = act(s, { type: 'check' }, { type: 'check' }, { type: 'check' });
    expect(s.result!.pots[0]!.winners.sort()).toEqual([0, 1, 2]);
    expect(Object.values(s.result!.net).every((n) => Math.abs(n) < 0.02)).toBe(true);
  });

  it('builds side pots for short all-ins', () => {
    // Seat 0 has 10, seat 1 has 50, seat 2 has 100. Everyone all-in preflop.
    let s = rig(startHand(seats(10, 50, 100), 0, { sb: 0.5, bb: 1 }, createRng(10)), ['AsAd', 'KsKd', 'QsQd'], '2c7h9dJc3h');
    s = act(s, { type: 'raise', to: 10 }, { type: 'raise', to: 50 }, { type: 'raise', to: 100 });
    expect(s.finished).toBe(true);
    const pots = s.result!.pots;
    expect(pots.map((p) => p.amount)).toEqual([30, 80]);
    expect(pots[0]!.winners).toEqual([0]);
    expect(pots[1]!.winners).toEqual([1]);
    // Nobody can respond to seat 2, so its "raise" is just a call of 50: nothing to return.
    expect(s.result!.returned).toBeNull();
    expect(s.result!.net).toEqual({ 0: 20, 1: 30, 2: -50 });
    expect(s.seats.map((x) => x.stack)).toEqual([30, 80, 50]);
  });

  it('runs out the board when everyone is all-in', () => {
    let s = startHand(seats(20, 20), 0, { sb: 0.5, bb: 1 }, createRng(11));
    s = act(s, { type: 'raise', to: 20 }, { type: 'call' });
    expect(s.board).toHaveLength(5);
    expect(s.finished).toBe(true);
  });

  it('a short all-in call lets the big stack check it down without raising', () => {
    let s = startHand(seats(100, 5), 0, { sb: 0.5, bb: 1 }, createRng(12));
    s = act(s, { type: 'raise', to: 10 });
    const la = legalActions(s)!;
    expect(la.call).toBe(4);
    s = act(s, { type: 'call' });
    expect(s.finished).toBe(true);
    expect(s.result!.returned).toEqual({ seat: 0, amount: 5 });
  });
});

describe('invariants under random play', () => {
  it('chips are conserved and hands always finish', () => {
    const rng = createRng(99);
    for (let hand = 0; hand < 300; hand++) {
      const n = 2 + Math.floor(rng() * 8);
      const cfg = Array.from({ length: n }, (_, i) => ({ name: `P${i}`, stack: 5 + Math.floor(rng() * 200) }));
      let s = startHand(cfg, Math.floor(rng() * n), { sb: 0.5, bb: 1 }, createRng(hand));
      const total = chips(s);
      let guard = 0;
      while (!s.finished && guard++ < 200) {
        const la = legalActions(s)!;
        const r = rng();
        if (r < 0.2) s = applyAction(s, { type: 'fold' });
        else if (r < 0.65) s = applyAction(s, { type: 'call' });
        else s = applyAction(s, { type: 'raise', to: la.minTo + rng() * (la.maxTo - la.minTo) });
        if (!s.finished) expect(Math.abs(chips(s) - total)).toBeLessThan(1e-6);
      }
      expect(s.finished).toBe(true);
      const after = s.seats.reduce((a, x) => a + x.stack, 0);
      expect(Math.abs(after - total)).toBeLessThan(0.011);
      expect(Math.abs(Object.values(s.result!.net).reduce((a, b) => a + b, 0))).toBeLessThan(0.011);
    }
  });
});
