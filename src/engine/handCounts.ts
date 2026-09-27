/**
 * How many of the C(52,5) = 2,598,960 five-card hands fall in each category, derived with
 * combinatorics (the evaluator test checks the same numbers by brute force).
 */
import { choose } from './math';
import { HandCategory } from './evaluator';

export function fiveCardCategoryCounts(): Record<HandCategory, number> {
  const straightFlush = 10 * 4; // 10 straights (A-5 … T-A) × 4 suits, royals included
  const quads = 13 * 48;
  const fullHouse = 13 * choose(4, 3) * 12 * choose(4, 2);
  const flush = 4 * choose(13, 5) - straightFlush;
  const straight = 10 * 4 ** 5 - straightFlush;
  const trips = 13 * choose(4, 3) * choose(12, 2) * 4 * 4;
  const twoPair = choose(13, 2) * choose(4, 2) ** 2 * 11 * 4;
  const pair = 13 * choose(4, 2) * choose(12, 3) * 4 ** 3;
  const total = choose(52, 5);
  const high = total - straightFlush - quads - fullHouse - flush - straight - trips - twoPair - pair;
  return {
    [HandCategory.HighCard]: high,
    [HandCategory.Pair]: pair,
    [HandCategory.TwoPair]: twoPair,
    [HandCategory.ThreeOfAKind]: trips,
    [HandCategory.Straight]: straight,
    [HandCategory.Flush]: flush,
    [HandCategory.FullHouse]: fullHouse,
    [HandCategory.FourOfAKind]: quads,
    [HandCategory.StraightFlush]: straightFlush,
  } as Record<HandCategory, number>;
}
