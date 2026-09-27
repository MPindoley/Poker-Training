/**
 * What a new board card (usually the turn) changed: overcards, board pairs, completed flushes and
 * straights, new flush draws, or nothing much (a "brick").
 */
import { RANKS } from '../cards';

export type CardChange = 'overcard' | 'pairs-board' | 'flush-possible' | 'four-flush' | 'flush-draw' | 'straight-possible' | 'brick';

export const CARD_CHANGE_TEXT: Record<CardChange, string> = {
  overcard: 'an overcard to the board',
  'pairs-board': 'pairs the board',
  'flush-possible': 'puts three of a suit on board (flushes possible)',
  'four-flush': 'puts four of a suit on board',
  'flush-draw': 'adds a new flush draw',
  'straight-possible': 'makes new straights possible',
  brick: 'changes little (a brick)',
};

const WINDOWS: number[][] = [[12, 0, 1, 2, 3], ...Array.from({ length: 9 }, (_, i) => [i, i + 1, i + 2, i + 3, i + 4])];

/** Straight windows where two hole cards can complete a straight (≥ 3 distinct board ranks inside). */
export function straightWindows(board: readonly number[]): number {
  const ranks = new Set(board.map((c) => c >> 2));
  return WINDOWS.filter((w) => w.filter((r) => ranks.has(r)).length >= 3).length;
}

export function cardChanges(before: readonly number[], card: number): CardChange[] {
  const out: CardChange[] = [];
  const rank = card >> 2;
  const suit = card & 3;
  const ranks = before.map((c) => c >> 2);
  if (rank > Math.max(...ranks)) out.push('overcard');
  if (ranks.includes(rank)) out.push('pairs-board');
  const sameSuit = before.filter((c) => (c & 3) === suit).length;
  if (sameSuit === 2) out.push('flush-possible');
  else if (sameSuit === 3) out.push('four-flush');
  else if (sameSuit === 1 && before.length < 4) out.push('flush-draw');
  if (straightWindows([...before, card]) > straightWindows(before)) out.push('straight-possible');
  if (!out.length) out.push('brick');
  return out;
}

export function describeCardChanges(before: readonly number[], card: number): string {
  const r = RANKS[card >> 2];
  return `The ${r === 'T' ? '10' : r} ${cardChanges(before, card).map((c) => CARD_CHANGE_TEXT[c]).join(', ')}.`;
}
