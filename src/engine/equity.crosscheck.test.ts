/**
 * Quality check: 50 random spots, exact enumeration vs Monte Carlo. Every Monte Carlo result must sit
 * within 4 standard errors of the exact answer; gaps over 1 percentage point are reported.
 */
import { describe, expect, it } from 'vitest';
import { cardToString } from './cards';
import { calculateEquity, type PlayerSpec } from './equity';
import { createRng, shuffledDeck } from './rng';

interface Spot {
  label: string;
  players: PlayerSpec[];
  board: string;
}

const RANGES = ['QQ+,AKs,AKo', 'TT+,AQs+,AKo', '22+,A2s+,KTs+,ATo+', '77+,ATs+,KQs,AJo+'];

function makeSpots(): Spot[] {
  const rng = createRng(20260927);
  const spots: Spot[] = [];
  const deal = (players: number, boardCards: number, rangeVillain: boolean): Spot => {
    const deck = shuffledDeck(rng).map(cardToString);
    const hands: PlayerSpec[] = [];
    for (let i = 0; i < players; i++) hands.push(deck[2 * i]! + deck[2 * i + 1]!);
    if (rangeVillain) hands[players - 1] = RANGES[Math.floor(rng() * RANGES.length)]!;
    const board = deck.slice(2 * players, 2 * players + boardCards).join('');
    const street = boardCards === 0 ? 'preflop' : boardCards === 3 ? 'flop' : 'turn';
    return { label: `${street} ${hands.join(' vs ')}${board ? ` on ${board}` : ''}`, players: hands, board };
  };
  for (let i = 0; i < 15; i++) spots.push(deal(i % 3 === 0 ? 3 : 2, 3, false));
  for (let i = 0; i < 15; i++) spots.push(deal(i % 3 === 0 ? 3 : 2, 4, false));
  for (let i = 0; i < 10; i++) spots.push(deal(2, 3, true));
  for (let i = 0; i < 10; i++) spots.push(deal(2, 0, false));
  return spots;
}

describe('equity cross-check: exact vs Monte Carlo (50 spots)', () => {
  it('Monte Carlo agrees with exact enumeration', { timeout: 300_000 }, () => {
    const spots = makeSpots();
    expect(spots).toHaveLength(50);
    let worst = { gap: 0, label: '' };
    const over1: string[] = [];
    spots.forEach((spot, i) => {
      const exact = calculateEquity(spot.players, { board: spot.board });
      expect(exact.method).toBe('exact');
      const mc = calculateEquity(spot.players, { board: spot.board, forceMonteCarlo: true, iterations: 40_000, seed: 1000 + i });
      spot.players.forEach((_, p) => {
        const gap = Math.abs(mc.players[p]!.equity - exact.players[p]!.equity);
        // 4 standard errors: a real bug fails this, sampling noise essentially never does.
        expect(gap, spot.label).toBeLessThanOrEqual(4 * mc.players[p]!.stdError + 1e-9);
        if (gap > worst.gap) worst = { gap, label: spot.label };
        if (gap > 0.01) over1.push(`${spot.label}: player ${p + 1} exact ${(exact.players[p]!.equity * 100).toFixed(2)}% vs MC ${(mc.players[p]!.equity * 100).toFixed(2)}%`);
      });
    });
    console.log(`[equity cross-check] 50 spots, 40k trials each. Largest gap ${(worst.gap * 100).toFixed(2)} pts (${worst.label}). Gaps over 1 pt: ${over1.length ? over1.join('; ') : 'none'}`);
    expect(over1.length).toBeLessThanOrEqual(2);
  });
});
