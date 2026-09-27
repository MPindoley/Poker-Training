/**
 * Classify a two-card holding on a board into a strategic bucket:
 * monster > strong > medium > draw > weak > air. Used to model how players continue,
 * bet and bluff, and to describe hands in explanations.
 */
import { evaluateIndices, HandCategory } from '../evaluator';

export type Bucket = 'monster' | 'strong' | 'medium' | 'draw' | 'weak' | 'air';
export const BUCKETS: readonly Bucket[] = ['monster', 'strong', 'medium', 'draw', 'weak', 'air'];
export const BUCKET_NAMES: Record<Bucket, string> = {
  monster: 'Monsters (two pair+, sets)',
  strong: 'Strong (overpairs, top pair good kicker)',
  medium: 'Medium (weak top pair, middle pair)',
  draw: 'Draws',
  weak: 'Weak showdown value',
  air: 'Air',
};

export interface HandInfo {
  bucket: Bucket;
  description: string;
  category: HandCategory;
  flushDraw: boolean;
  straightDraw: 'oesd' | 'gutshot' | null;
  /** Flush draw + straight draw, flush draw + pair, or OESD + pair. */
  strongDraw: boolean;
  /** 1-based pair rank relative to the board, e.g. 1 = top pair (0 = overpair). */
  pairRank: number | null;
}

const WHEEL = [12, 0, 1, 2, 3];
const WINDOWS: number[][] = [WHEEL, ...Array.from({ length: 9 }, (_, i) => [i, i + 1, i + 2, i + 3, i + 4])];

function straightDraw(ranks: Set<number>, heroRanks: number[], boardMade: boolean): 'oesd' | 'gutshot' | null {
  if (boardMade) return null;
  // Count windows with exactly 4 of 5 ranks present, using at least one hole card.
  const completing = new Set<number>();
  for (const w of WINDOWS) {
    const missing = w.filter((r) => !ranks.has(r));
    if (missing.length === 1 && w.some((r) => heroRanks.includes(r))) completing.add(missing[0]!);
  }
  if (completing.size >= 2) return 'oesd';
  if (completing.size === 1) return 'gutshot';
  return null;
}

export function classifyHand(c1: number, c2: number, board: readonly number[]): HandInfo {
  const all = [c1, c2, ...board];
  const score = evaluateIndices(all);
  const category = (score >> 20) as HandCategory;
  const boardScore = board.length >= 5 ? evaluateIndices(board) : -1;
  const hole = [c1 >> 2, c2 >> 2];
  const boardRanks = board.map((c) => c >> 2);
  const distinctBoard = [...new Set(boardRanks)].sort((a, b) => b - a);
  const cardsToCome = board.length < 5;

  // Draws
  const suitCount = [0, 0, 0, 0];
  all.forEach((c) => suitCount[c & 3]!++);
  const flushDraw =
    cardsToCome && category < HandCategory.Flush && [0, 1, 2, 3].some((s) => suitCount[s] === 4 && ((c1 & 3) === s || (c2 & 3) === s));
  const sd = cardsToCome && category < HandCategory.Straight ? straightDraw(new Set(all.map((c) => c >> 2)), hole, false) : null;

  // Made hands
  const heroPlays = boardScore < 0 || score > boardScore;
  let bucket: Bucket = 'air';
  let description = 'No pair';
  let pairRank: number | null = null;

  const pocketPair = hole[0] === hole[1];
  const boardPairs = boardRanks.length - distinctBoard.length;

  if (category >= HandCategory.Straight && heroPlays) {
    bucket = 'monster';
    description = ['Straight', 'Flush', 'Full house', 'Quads', 'Straight flush'][category - HandCategory.Straight]!;
  } else if (category === HandCategory.ThreeOfAKind) {
    if (pocketPair && boardRanks.includes(hole[0]!)) {
      bucket = 'monster';
      description = 'Set';
    } else if (hole.some((r) => boardRanks.filter((b) => b === r).length === 2)) {
      bucket = 'strong';
      description = 'Trips';
    } else {
      bucket = 'weak';
      description = 'Trips on the board';
    }
  } else if (category === HandCategory.TwoPair && hole[0] !== hole[1] && hole.every((r) => boardRanks.includes(r!))) {
    bucket = 'monster';
    description = 'Two pair';
  } else if (category >= HandCategory.Pair) {
    // Find the best pair that uses a hole card.
    const pairedHole = hole.filter((r) => boardRanks.includes(r!)).sort((a, b) => b! - a!);
    if (pocketPair && !boardRanks.includes(hole[0]!)) {
      const above = distinctBoard.filter((r) => r > hole[0]!).length;
      pairRank = above;
      if (above === 0) {
        bucket = 'strong';
        description = 'Overpair';
      } else if (above === 1) {
        bucket = 'medium';
        description = 'Pocket pair below the top card';
      } else {
        bucket = 'weak';
        description = 'Small pocket pair';
      }
    } else if (pairedHole.length) {
      const r = pairedHole[0]!;
      const idx = distinctBoard.indexOf(r);
      pairRank = idx + 1;
      const kicker = hole.find((h) => h !== r) ?? r;
      if (idx === 0) {
        const goodKicker = kicker >= 9 || (r === 12 && kicker >= 8) || (r >= 11 && kicker >= 8);
        bucket = goodKicker ? 'strong' : 'medium';
        description = goodKicker ? 'Top pair, good kicker' : 'Top pair, weak kicker';
      } else if (idx === 1) {
        bucket = 'medium';
        description = 'Second pair';
      } else {
        bucket = 'weak';
        description = 'Bottom pair';
      }
    } else if (boardPairs > 0) {
      bucket = hole.includes(12) ? 'weak' : 'air';
      description = hole.includes(12) ? 'Ace high (paired board)' : 'No pair (paired board)';
    }
  }
  if (bucket === 'air' && (hole.includes(12) || (hole.includes(11) && board.length === 5))) {
    bucket = 'weak';
    description = hole.includes(12) ? 'Ace high' : 'King high';
  }

  const pair = bucket === 'medium' || bucket === 'weak' || (bucket === 'strong' && description !== 'Trips');
  const strongDraw = (flushDraw && sd !== null) || (flushDraw && pair) || (sd === 'oesd' && pair && bucket !== 'weak');
  if ((bucket === 'air' || bucket === 'weak') && (flushDraw || sd)) {
    bucket = 'draw';
    description = flushDraw && sd ? 'Flush + straight draw' : flushDraw ? 'Flush draw' : sd === 'oesd' ? 'Open-ended straight draw' : 'Gutshot';
  } else if (flushDraw || sd) {
    description += flushDraw ? ' + flush draw' : sd === 'oesd' ? ' + straight draw' : ' + gutshot';
  }
  return { bucket, description, category, flushDraw, straightDraw: sd, strongDraw, pairRank };
}
