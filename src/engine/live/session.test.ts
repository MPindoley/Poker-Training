import { describe, expect, it } from 'vitest';
import { DRIFT_K, newProfile } from '../exploit/profiles';
import { topExploits } from '../exploit/advice';
import { ARCHETYPES } from '../exploit/profiles';
import { addEvent, addPlayer, applySession, bookmarkHand, computeObservedStats, createLiveSession, handsFor, liveRead, removePlayer, undoLast, type LiveEventType, type LiveSession } from './session';

const base = () =>
  createLiveSession(
    {
      venue: 'home',
      smallBlind: 0.25,
      bigBlind: 0.5,
      buyIn: 20,
      heroSeat: 'BTN',
      players: [
        { id: 'seth', seat: 'BB', name: 'Seth', profileId: 'p-seth' },
        { id: 'ana', seat: 'CO', name: 'Ana' },
      ],
    },
    1000,
  );
const play = (s: LiveSession, taps: [LiveEventType, string?][]) => taps.reduce((acc, [t, p]) => addEvent(acc, t, p ?? ''), s);

describe('live session stats', () => {
  it('computes stats with sample sizes from a scripted log', () => {
    let s = base();
    // 10 hands dealt; Seth plays 4 (1 raise), folds to 0 of 6 turn bets over the night.
    for (let h = 0; h < 10; h++) {
      if (h < 4) s = addEvent(s, 'vpip', 'seth');
      if (h === 0) s = addEvent(s, 'pfr', 'seth');
      s = addEvent(s, 'hand');
    }
    s = play(s, [['callTurn', 'seth'], ['callTurn', 'seth'], ['callTurn', 'seth'], ['callTurn', 'seth'], ['callTurn', 'seth'], ['callTurn', 'seth'], ['foldCbet', 'seth'], ['callCbet', 'seth'], ['showdown', 'seth']]);
    const o = computeObservedStats(s, 'seth');
    expect(handsFor(s, 'seth')).toBe(10);
    expect(o.vpip).toEqual({ value: 0.4, hits: 4, n: 10, confident: true });
    expect(o.pfr!.value).toBeCloseTo(0.1);
    expect(o.foldToTurnBet).toEqual({ value: 0, hits: 0, n: 6, confident: false });
    expect(o.foldToCbet).toEqual({ value: 0.5, hits: 1, n: 2, confident: false });
    expect(o.wtsd).toEqual({ value: 0.25, hits: 1, n: 4, confident: false });
    expect(o.foldToRiverBet).toBeUndefined();
    expect(liveRead('Seth', o)).toBe('Seth: folded to 0 of 6 turn bets. Keep value betting big; never bluff them on the turn.');
  });

  it('undo removes the last tap (and a dealt hand)', () => {
    let s = play(base(), [['vpip', 'ana'], ['hand'], ['pfr', 'ana']]);
    expect(s.handNo).toBe(2);
    s = undoLast(s);
    expect(s.events.map((e) => e.type)).toEqual(['vpip', 'hand']);
    s = undoLast(s);
    expect(s.handNo).toBe(1);
    s = undoLast(s, 'ana');
    expect(s.events).toEqual([]);
    expect(undoLast(s)).toBe(s);
  });

  it('players who join or leave only count the hands they sat for', () => {
    let s = play(base(), [['hand'], ['hand']]);
    s = addPlayer(s, { id: 'new', seat: 'UTG', name: 'New guy' });
    s = play(s, [['hand']]);
    s = removePlayer(s, 'ana');
    s = play(s, [['hand']]);
    expect(handsFor(s, 'new')).toBe(2);
    expect(handsFor(s, 'ana')).toBe(3);
    expect(handsFor(s, 'seth')).toBe(4);
  });

  it('bookmarks save the seats at that hand', () => {
    const s = bookmarkHand(play(base(), [['hand']]), 5);
    expect(s.bookmarks[0]).toMatchObject({ hand: 2, players: [{ seat: 'BB', name: 'Seth', profileId: 'p-seth' }, { seat: 'CO', name: 'Ana' }] });
  });
});

describe('applying a session to a profile', () => {
  const prof = () => newProfile('Seth', 'tag', 'p-seth', 0);
  it('moves each stat by its own sample size: n / (n + DRIFT_K)', () => {
    const before = prof();
    const obs = { foldToTurnBet: { value: 0, hits: 0, n: 3, confident: false } };
    const small = applySession(before, obs, 20, 1);
    const expectedSmall = before.stats.foldToTurnBet * (1 - 3 / (3 + DRIFT_K));
    expect(small.stats.foldToTurnBet).toBeCloseTo(expectedSmall, 9);
    const big = applySession(before, { foldToTurnBet: { value: 0, hits: 0, n: 30, confident: true } }, 60, 1);
    expect(big.stats.foldToTurnBet).toBeCloseTo(before.stats.foldToTurnBet * (1 - 30 / (30 + DRIFT_K)), 9);
    // 3 observations barely move it; 30 move it a lot.
    expect(before.stats.foldToTurnBet - small.stats.foldToTurnBet).toBeLessThan(0.15 * before.stats.foldToTurnBet);
    expect(before.stats.foldToTurnBet - big.stats.foldToTurnBet).toBeGreaterThan(0.5 * before.stats.foldToTurnBet);
    expect(big.samples!.foldToTurnBet).toBe(30);
    expect(big.observations).toBe(60);
    // Stats that weren't observed don't move.
    expect(big.stats.vpip).toBe(before.stats.vpip);
  });
  it('a session with no events changes nothing', () => {
    const p = prof();
    const s = base();
    expect(computeObservedStats(s, 'seth')).toEqual({});
    expect(applySession(p, computeObservedStats(s, 'seth'), 0)).toBe(p);
    expect(liveRead('Seth', {})).toBe('Seth: no reads recorded.');
  });
});

describe('top exploits', () => {
  it('ranks the biggest deviations from a solid regular first', () => {
    const ex = topExploits(ARCHETYPES.efls.stats);
    expect(ex).toHaveLength(3);
    expect(ex[0]!.text).toMatch(/river/);
    expect(topExploits(ARCHETYPES.tag.stats)).toEqual([]);
    expect(topExploits(ARCHETYPES.station.stats)[0]!.text).toMatch(/Don't bluff|Plays/);
  });
});

describe('untracked players', () => {
  it('a player with no taps has no observed stats even after hands are dealt', () => {
    const s = play(base(), [['hand'], ['hand'], ['vpip', 'seth']]);
    expect(computeObservedStats(s, 'ana')).toEqual({});
    expect(computeObservedStats(s, 'seth').vpip).toMatchObject({ hits: 1, n: 2 });
  });
});
