/**
 * Fast 5/6/7-card hand evaluator.
 *
 * Works on integer card indices (see cardIndex) with rank bitmasks. The returned score is a
 * single comparable integer: higher is better, equal means a split pot.
 *   score = category << 20 | r1 << 16 | r2 << 12 | r3 << 8 | r4 << 4 | r5
 * where r1..r5 are rank indices (0 = deuce … 12 = ace) in significance order.
 */
import { RANKS, cardFromIndex, cardIndex, type Card, type Rank } from './cards';

export const HandCategory = {
  HighCard: 0,
  Pair: 1,
  TwoPair: 2,
  ThreeOfAKind: 3,
  Straight: 4,
  Flush: 5,
  FullHouse: 6,
  FourOfAKind: 7,
  StraightFlush: 8,
} as const;
export type HandCategory = (typeof HandCategory)[keyof typeof HandCategory];

export const CATEGORY_NAMES: Record<HandCategory, string> = {
  0: 'High card',
  1: 'Pair',
  2: 'Two pair',
  3: 'Three of a kind',
  4: 'Straight',
  5: 'Flush',
  6: 'Full house',
  7: 'Four of a kind',
  8: 'Straight flush',
};

const WHEEL_MASK = 0b1_0000_0000_1111; // A,5,4,3,2

/** STRAIGHT_HIGH[mask] = rank index of the top card of the best straight in mask, or -1. */
const STRAIGHT_HIGH = new Int8Array(1 << 13).fill(-1);
/** TOP_BITS[mask] = the highest set bit index, or -1. */
const TOP_BIT = new Int8Array(1 << 13).fill(-1);
for (let mask = 1; mask < 1 << 13; mask++) {
  TOP_BIT[mask] = 31 - Math.clz32(mask);
  for (let high = 12; high >= 4; high--) {
    const run = 0b11111 << (high - 4);
    if ((mask & run) === run) {
      STRAIGHT_HIGH[mask] = high;
      break;
    }
  }
  if (STRAIGHT_HIGH[mask] === -1 && (mask & WHEEL_MASK) === WHEEL_MASK) STRAIGHT_HIGH[mask] = 3; // five-high
}

function score(category: number, r1 = 0, r2 = 0, r3 = 0, r4 = 0, r5 = 0): number {
  return (category << 20) | (r1 << 16) | (r2 << 12) | (r3 << 8) | (r4 << 4) | r5;
}

/** Take the top `n` ranks from a mask, packed as nibbles (most significant first). */
function topRanks(mask: number, n: number): number[] {
  const out: number[] = [];
  let m = mask;
  while (out.length < n && m) {
    const top = TOP_BIT[m]!;
    out.push(top);
    m &= ~(1 << top);
  }
  return out;
}

// Scratch buffers reused across calls (the evaluator is not re-entrant, which is fine in JS).
const counts = new Uint8Array(13);
const suitMask = new Int32Array(4);
const suitCount = new Uint8Array(4);

/**
 * Score the best 5-card hand from `n` card indices (5 ≤ n ≤ 7 is the supported range,
 * but any n ≥ 5 works). Reads cards[0..n-1].
 */
export function evaluateIndices(cards: ArrayLike<number>, n: number = cards.length): number {
  counts.fill(0);
  suitMask[0] = suitMask[1] = suitMask[2] = suitMask[3] = 0;
  suitCount[0] = suitCount[1] = suitCount[2] = suitCount[3] = 0;
  let all = 0;
  for (let i = 0; i < n; i++) {
    const c = cards[i]!;
    const r = c >> 2;
    const s = c & 3;
    counts[r]!++;
    suitMask[s]! |= 1 << r;
    suitCount[s]!++;
    all |= 1 << r;
  }

  let flushMask = 0;
  for (let s = 0; s < 4; s++) {
    if (suitCount[s]! >= 5) flushMask = suitMask[s]!;
  }
  if (flushMask) {
    const sf = STRAIGHT_HIGH[flushMask]!;
    if (sf >= 0) return score(HandCategory.StraightFlush, sf);
  }

  // Group ranks by multiplicity, high to low.
  let quad = -1;
  let trip1 = -1;
  let trip2 = -1;
  let pair1 = -1;
  let pair2 = -1;
  let pair3 = -1;
  for (let r = 12; r >= 0; r--) {
    const k = counts[r]!;
    if (k === 4) quad = r;
    else if (k === 3) {
      if (trip1 < 0) trip1 = r;
      else if (trip2 < 0) trip2 = r;
    } else if (k === 2) {
      if (pair1 < 0) pair1 = r;
      else if (pair2 < 0) pair2 = r;
      else if (pair3 < 0) pair3 = r;
    }
  }

  if (quad >= 0) {
    return score(HandCategory.FourOfAKind, quad, TOP_BIT[all & ~(1 << quad)]!);
  }
  if (trip1 >= 0 && (trip2 >= 0 || pair1 >= 0)) {
    return score(HandCategory.FullHouse, trip1, Math.max(trip2, pair1));
  }
  if (flushMask) {
    const [a, b, c, d, e] = topRanks(flushMask, 5);
    return score(HandCategory.Flush, a, b, c, d, e);
  }
  const straight = STRAIGHT_HIGH[all]!;
  if (straight >= 0) return score(HandCategory.Straight, straight);
  if (trip1 >= 0) {
    const [k1, k2] = topRanks(all & ~(1 << trip1), 2);
    return score(HandCategory.ThreeOfAKind, trip1, k1, k2);
  }
  if (pair2 >= 0) {
    // With three pairs the third pair's rank can play as the kicker.
    const kicker = TOP_BIT[all & ~(1 << pair1) & ~(1 << pair2)]!;
    return score(HandCategory.TwoPair, pair1, pair2, kicker);
  }
  if (pair1 >= 0) {
    const [k1, k2, k3] = topRanks(all & ~(1 << pair1), 3);
    return score(HandCategory.Pair, pair1, k1, k2, k3);
  }
  const [a, b, c, d, e] = topRanks(all, 5);
  return score(HandCategory.HighCard, a, b, c, d, e);
}

export function categoryOf(handScore: number): HandCategory {
  return (handScore >> 20) as HandCategory;
}

/** The five significant rank indices packed in a score. */
function scoreRanks(handScore: number): number[] {
  return [16, 12, 8, 4, 0].map((shift) => (handScore >> shift) & 0xf);
}

export interface HandEvaluation {
  category: HandCategory;
  categoryName: string;
  /** Comparable score: higher wins, equal ties. */
  score: number;
  /** The five cards that make the hand, most significant first. */
  best: Card[];
  /** Human description, e.g. "Full house, Kings full of Sevens". */
  description: string;
}

const PLURAL: Record<Rank, string> = {
  '2': 'Twos', '3': 'Threes', '4': 'Fours', '5': 'Fives', '6': 'Sixes', '7': 'Sevens', '8': 'Eights',
  '9': 'Nines', T: 'Tens', J: 'Jacks', Q: 'Queens', K: 'Kings', A: 'Aces',
};
const SINGULAR: Record<Rank, string> = {
  '2': 'Two', '3': 'Three', '4': 'Four', '5': 'Five', '6': 'Six', '7': 'Seven', '8': 'Eight',
  '9': 'Nine', T: 'Ten', J: 'Jack', Q: 'Queen', K: 'King', A: 'Ace',
};

function describe(category: HandCategory, ranks: number[]): string {
  const R = (i: number) => RANKS[ranks[i]!]!;
  switch (category) {
    case HandCategory.StraightFlush:
      return ranks[0] === 12 ? 'Royal flush' : `Straight flush, ${SINGULAR[R(0)]} high`;
    case HandCategory.FourOfAKind:
      return `Four of a kind, ${PLURAL[R(0)]}`;
    case HandCategory.FullHouse:
      return `Full house, ${PLURAL[R(0)]} full of ${PLURAL[R(1)]}`;
    case HandCategory.Flush:
      return `Flush, ${SINGULAR[R(0)]} high`;
    case HandCategory.Straight:
      return `Straight, ${SINGULAR[R(0)]} high`;
    case HandCategory.ThreeOfAKind:
      return `Three of a kind, ${PLURAL[R(0)]}`;
    case HandCategory.TwoPair:
      return `Two pair, ${PLURAL[R(0)]} and ${PLURAL[R(1)]}`;
    case HandCategory.Pair:
      return `Pair of ${PLURAL[R(0)]}`;
    default:
      return `High card, ${SINGULAR[R(0)]}`;
  }
}

/** Pick the actual five cards behind a score. */
function bestFive(indices: number[], handScore: number): number[] {
  const category = categoryOf(handScore);
  const ranks = scoreRanks(handScore);
  const sorted = [...indices].sort((a, b) => b - a);
  const taken = new Set<number>();
  const take = (rank: number, count: number, suit = -1): number[] => {
    const got: number[] = [];
    for (const c of sorted) {
      if (got.length === count) break;
      if (taken.has(c) || c >> 2 !== rank || (suit >= 0 && (c & 3) !== suit)) continue;
      got.push(c);
      taken.add(c);
    }
    return got;
  };

  let flushSuit = -1;
  for (let s = 0; s < 4; s++) {
    if (indices.filter((c) => (c & 3) === s).length >= 5) flushSuit = s;
  }
  const straightRanks = (high: number) =>
    high === 3 ? [3, 2, 1, 0, 12] : [high, high - 1, high - 2, high - 3, high - 4];

  switch (category) {
    case HandCategory.StraightFlush:
      return straightRanks(ranks[0]!).flatMap((r) => take(r, 1, flushSuit));
    case HandCategory.Straight:
      return straightRanks(ranks[0]!).flatMap((r) => take(r, 1));
    case HandCategory.Flush:
      return ranks.flatMap((r) => take(r, 1, flushSuit));
    case HandCategory.FourOfAKind:
      return [...take(ranks[0]!, 4), ...take(ranks[1]!, 1)];
    case HandCategory.FullHouse:
      return [...take(ranks[0]!, 3), ...take(ranks[1]!, 2)];
    case HandCategory.ThreeOfAKind:
      return [...take(ranks[0]!, 3), ...take(ranks[1]!, 1), ...take(ranks[2]!, 1)];
    case HandCategory.TwoPair:
      return [...take(ranks[0]!, 2), ...take(ranks[1]!, 2), ...take(ranks[2]!, 1)];
    case HandCategory.Pair:
      return [...take(ranks[0]!, 2), ...ranks.slice(1, 4).flatMap((r) => take(r, 1))];
    default:
      return ranks.flatMap((r) => take(r, 1));
  }
}

/** Full evaluation of 5–7 cards, with the best five and a description. */
export function evaluateHand(cards: readonly Card[]): HandEvaluation {
  if (cards.length < 5 || cards.length > 7) throw new Error(`Need 5 to 7 cards, got ${cards.length}`);
  const indices = cards.map(cardIndex);
  if (new Set(indices).size !== indices.length) throw new Error('Duplicate cards in hand');
  const s = evaluateIndices(indices);
  const category = categoryOf(s);
  return {
    category,
    categoryName: CATEGORY_NAMES[category],
    score: s,
    best: bestFive(indices, s).map(cardFromIndex),
    description: describe(category, scoreRanks(s)),
  };
}

/** Compare two hands: positive if a wins, negative if b wins, 0 for a tie. */
export function compareHands(a: readonly Card[], b: readonly Card[]): number {
  return Math.sign(evaluateIndices(a.map(cardIndex)) - evaluateIndices(b.map(cardIndex)));
}
