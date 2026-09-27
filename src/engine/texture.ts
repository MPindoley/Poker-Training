/**
 * Board texture classifier. Everything here is derived from the cards; the dry/wet score and the
 * "favours" label are documented heuristics, and rangeAdvantage() measures real equity when you
 * want a number instead of a label.
 */
import { RANKS, cardIndex, parseCards, type Card } from './cards';
import { calculateEquity, type EquityOptions, type PlayerSpec } from './equity';

export type Wetness = 'dry' | 'semi-wet' | 'wet';
export type SuitPattern = 'rainbow' | 'two-tone' | 'monotone' | 'three-flush' | 'four-flush';
export type Height = 'high' | 'middle' | 'low';
export type Pairing = 'unpaired' | 'paired' | 'two-pair' | 'trips' | 'full-house' | 'quads';
export type Favors = 'preflop-raiser' | 'caller' | 'neutral';

export interface BoardTexture {
  cards: Card[];
  wetness: Wetness;
  /** The number behind `wetness` (higher = wetter). */
  wetnessScore: number;
  suits: SuitPattern;
  /** Most cards of one suit. */
  maxSuitCount: number;
  flushPossible: boolean;
  /** A flush draw is possible (exactly two of a suit with cards to come). */
  flushDrawPossible: boolean;
  pairing: Pairing;
  paired: boolean;
  height: Height;
  highCard: Card['rank'];
  /** Most distinct board ranks inside any 5-rank straight window (ace plays high and low). */
  connectedness: number;
  straightPossible: boolean;
  /** Number of distinct two-rank holdings (e.g. "T9") that make a straight right now. */
  straightCombosRanks: number;
  /** Heuristic: which preflop range this board tends to favour. */
  favors: Favors;
  favorsReason: string;
  /** Short human summary, e.g. "K-high rainbow, dry". */
  summary: string;
}

/** Straight windows as rank-index sets: wheel A-5 through broadway T-A. */
const WINDOWS: number[][] = [[12, 0, 1, 2, 3], ...Array.from({ length: 9 }, (_, i) => [i, i + 1, i + 2, i + 3, i + 4])];

export function classifyBoard(input: string | readonly Card[]): BoardTexture {
  const cards = typeof input === 'string' ? parseCards(input) : [...input];
  if (cards.length < 3 || cards.length > 5) throw new Error('Board texture needs 3 to 5 cards');
  const idx = cards.map(cardIndex);
  if (new Set(idx).size !== idx.length) throw new Error('Duplicate board cards');
  const ranks = idx.map((c) => c >> 2);
  const distinct = [...new Set(ranks)];

  // Suits
  const suitCounts = [0, 0, 0, 0];
  idx.forEach((c) => suitCounts[c & 3]!++);
  const maxSuitCount = Math.max(...suitCounts);
  const toCome = cards.length < 5;
  let suits: SuitPattern;
  if (maxSuitCount >= 4) suits = 'four-flush';
  else if (maxSuitCount === 3) suits = cards.length === 3 ? 'monotone' : 'three-flush';
  else if (maxSuitCount === 2) suits = 'two-tone';
  else suits = 'rainbow';
  const flushPossible = maxSuitCount >= 3;
  const flushDrawPossible = maxSuitCount === 2 && toCome;

  // Pairing
  const counts = new Map<number, number>();
  ranks.forEach((r) => counts.set(r, (counts.get(r) ?? 0) + 1));
  const mult = [...counts.values()].sort((a, b) => b - a);
  let pairing: Pairing = 'unpaired';
  if (mult[0] === 4) pairing = 'quads';
  else if (mult[0] === 3 && mult[1] === 2) pairing = 'full-house';
  else if (mult[0] === 3) pairing = 'trips';
  else if (mult[0] === 2 && mult[1] === 2) pairing = 'two-pair';
  else if (mult[0] === 2) pairing = 'paired';

  // Height
  const top = Math.max(...ranks);
  const highCard = RANKS[top]!;
  const height: Height = top >= 10 ? 'high' : top >= 6 ? 'middle' : 'low'; // Q+ / 8–J / 7 and below

  // Connectedness
  const rankSet = new Set(distinct);
  const connectedness = Math.max(...WINDOWS.map((w) => w.filter((r) => rankSet.has(r)).length));
  const straightPossible = connectedness >= 3;
  let straightCombosRanks = 0;
  for (let a = 0; a < 13; a++) {
    for (let b = a; b < 13; b++) {
      const s = new Set([...rankSet, a, b]);
      if (WINDOWS.some((w) => w.every((r) => s.has(r))) && !WINDOWS.some((w) => w.every((r) => rankSet.has(r)))) {
        straightCombosRanks++;
      }
    }
  }

  // Wetness heuristic: flush potential + straight potential, minus a bit for pairing.
  let suitScore = 0;
  if (flushPossible) suitScore = 3;
  else if (flushDrawPossible) suitScore = 1.5;
  let straightScore = 0;
  if (connectedness >= 3) straightScore = 3;
  else {
    // Two ranks that fit one straight window: closer ranks allow open-enders.
    const sorted = [...distinct].sort((a, b) => a - b);
    const lowAce = rankSet.has(12) ? [-1, ...sorted] : sorted;
    for (let i = 1; i < lowAce.length; i++) {
      const gap = lowAce[i]! - lowAce[i - 1]!;
      if (gap <= 2) straightScore = Math.max(straightScore, 1);
      else if (gap <= 4) straightScore = Math.max(straightScore, 0.5);
    }
  }
  const pairPenalty = pairing === 'unpaired' ? 0 : 1;
  const wetnessScore = Math.max(0, suitScore + straightScore - pairPenalty);
  const wetness: Wetness = wetnessScore < 1.5 ? 'dry' : wetnessScore < 3 ? 'semi-wet' : 'wet';

  // Who it favours (heuristic): high dry boards help the preflop raiser's big cards; low or
  // middle connected boards help the caller's suited connectors and small pairs.
  let favors: Favors = 'neutral';
  let favorsReason = 'Medium board without a clear edge for either range.';
  if (height === 'high' && top >= 11 && wetness !== 'wet') {
    favors = 'preflop-raiser';
    favorsReason = `${highCard}-high ${wetness} boards hit the raiser's big aces and broadways more often.`;
  } else if (height === 'low' || (height === 'middle' && connectedness >= 3)) {
    favors = 'caller';
    favorsReason = 'Low or connected boards hit the caller’s small pairs and suited connectors.';
  }

  const summary = `${highCard}-high ${suits}${pairing !== 'unpaired' ? `, ${pairing}` : ''}, ${wetness}`;

  return {
    cards,
    wetness,
    wetnessScore,
    suits,
    maxSuitCount,
    flushPossible,
    flushDrawPossible,
    pairing,
    paired: pairing !== 'unpaired',
    height,
    highCard,
    connectedness,
    straightPossible,
    straightCombosRanks,
    favors,
    favorsReason,
    summary,
  };
}

/**
 * Measured range advantage: equity of range A vs range B on this board.
 * Returns A's equity (0..1); B's is 1 − A (heads-up).
 */
export function rangeAdvantage(
  board: string | readonly Card[],
  rangeA: PlayerSpec,
  rangeB: PlayerSpec,
  options: Omit<EquityOptions, 'board'> = {},
): number {
  return calculateEquity([rangeA, rangeB], { iterations: 40_000, ...options, board }).players[0]!.equity;
}
