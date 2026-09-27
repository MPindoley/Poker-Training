/**
 * Outs calculator. For each unseen card, compare hero's made hand against every live combo in
 * villain's range before and after the card lands.
 *
 * - An OUT turns hero from behind (share < threshold) into ahead (share ≥ threshold).
 * - A DIRTY out is an out that also improves part of villain's range into a hand that still beats
 *   or ties hero (e.g. the flush card that pairs the board and gives a set a full house).
 * "Share" = weighted fraction of villain combos hero beats, ties counting half.
 */
import { cardFromIndex, cardIndex, parseCards, type Card } from './cards';
import { categoryOf, evaluateIndices } from './evaluator';
import { hitProbability } from './odds';
import { COMBOS, parseRange, type Range } from './range';

export interface OutCard {
  card: Card;
  /** Hero's share vs the range before this card (same for every card). */
  shareBefore: number;
  /** Hero's share vs the live range after this card. */
  shareAfter: number;
  /** Weighted fraction of villain's live range improved by the card into a hand that beats or ties hero. */
  villainHelped: number;
  isOut: boolean;
  dirty: boolean;
}

export interface OutsResult {
  /** Every unseen card that villain's range can coexist with, analysed. */
  cards: OutCard[];
  /** Cards that make hero the best hand. */
  outs: Card[];
  clean: Card[];
  dirty: Card[];
  /** Hero's share right now. */
  shareNow: number;
  /** Unseen cards from hero's point of view (52 − hand − board). */
  unseen: number;
  /** Chance the next card is an out: outs / unseen. */
  nextCardChance: number;
  /**
   * On the flop: chance of hitting at least one out by the river using the outs formula
   * 1 − C(unseen − outs, 2) / C(unseen, 2). Equal to nextCardChance on the turn.
   */
  byRiverChance: number;
  /** Σ shareAfter over improving cards — outs discounted for partial wins. */
  weightedOuts: number;
}

export interface OutsOptions {
  /** Share at which hero counts as "the best hand". Default 0.5. */
  threshold?: number;
}

function toCards(input: string | readonly Card[]): Card[] {
  return typeof input === 'string' ? parseCards(input) : [...input];
}

export function calculateOuts(
  heroHand: string | readonly Card[],
  boardInput: string | readonly Card[],
  villain: string | Range,
  options: OutsOptions = {},
): OutsResult {
  const threshold = options.threshold ?? 0.5;
  const hero = toCards(heroHand).map(cardIndex);
  const board = toCards(boardInput).map(cardIndex);
  if (hero.length !== 2) throw new Error('Hero needs exactly two cards');
  if (board.length !== 3 && board.length !== 4) throw new Error('Outs need a flop or turn board');
  const known = new Set([...hero, ...board]);
  if (known.size !== 5 + board.length - 3) throw new Error('Duplicate cards between hand and board');

  const range = typeof villain === 'string' ? parseRange(villain) : villain;
  const combos = COMBOS.map((c, i) => ({ ...c, weight: range.weights[i]! })).filter(
    (c) => c.weight > 0 && !known.has(c.c1) && !known.has(c.c2),
  );
  if (!combos.length) throw new Error("Villain's range has no live combos");

  const heroBefore = evaluateIndices([...hero, ...board]);
  const villainBefore = combos.map((c) => evaluateIndices([c.c1, c.c2, ...board]));

  let wBefore = 0;
  let sBefore = 0;
  combos.forEach((c, k) => {
    wBefore += c.weight;
    sBefore += c.weight * (heroBefore > villainBefore[k]! ? 1 : heroBefore === villainBefore[k] ? 0.5 : 0);
  });
  const shareBefore = sBefore / wBefore;

  const cards: OutCard[] = [];
  for (let card = 0; card < 52; card++) {
    if (known.has(card)) continue;
    const heroAfter = evaluateIndices([...hero, ...board, card]);
    let w = 0;
    let s = 0;
    let helped = 0;
    combos.forEach((c, k) => {
      if (c.c1 === card || c.c2 === card) return;
      const v = evaluateIndices([c.c1, c.c2, ...board, card]);
      w += c.weight;
      s += c.weight * (heroAfter > v ? 1 : heroAfter === v ? 0.5 : 0);
      if (categoryOf(v) > categoryOf(villainBefore[k]!) && v >= heroAfter) helped += c.weight;
    });
    if (w === 0) continue; // villain always holds this card
    const shareAfter = s / w;
    const villainHelped = helped / w;
    const isOut = shareBefore < threshold && shareAfter >= threshold && heroAfter > heroBefore;
    cards.push({ card: cardFromIndex(card), shareBefore, shareAfter, villainHelped, isOut, dirty: isOut && villainHelped > 0 });
  }

  const outs = cards.filter((c) => c.isOut);
  const unseen = 52 - known.size;
  const nextCardChance = outs.length / unseen;
  return {
    cards,
    outs: outs.map((c) => c.card),
    clean: outs.filter((c) => !c.dirty).map((c) => c.card),
    dirty: outs.filter((c) => c.dirty).map((c) => c.card),
    shareNow: shareBefore,
    unseen,
    nextCardChance,
    byRiverChance: board.length === 3 ? hitProbability(outs.length, unseen, 2) : nextCardChance,
    weightedOuts: cards.filter((c) => c.shareAfter > shareBefore).reduce((s, c) => s + c.shareAfter, 0),
  };
}
