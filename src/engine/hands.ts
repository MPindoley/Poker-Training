/**
 * The 169 starting-hand classes (AA, AKs, AKo, ...) and their combo counts.
 * Combo counts are derived by enumerating real card pairs, not typed in.
 */
import { SUITS, RANKS, type Card, type Rank } from './cards';
import { choose } from './math';

export type HandKind = 'pair' | 'suited' | 'offsuit';

export interface HandClass {
  /** e.g. "AA", "AKs", "T9o" */
  label: string;
  high: Rank;
  low: Rank;
  kind: HandKind;
  /** Position in the 13x13 grid (0 = Ace row/column). */
  row: number;
  col: number;
}

/** Ranks ordered for the grid: A at top-left down to 2. */
export const GRID_RANKS: readonly Rank[] = [...RANKS].reverse();

/** Every two-card starting hand: C(52, 2). */
export const TOTAL_COMBOS = choose(52, 2);

/**
 * Standard grid convention: pairs on the diagonal, suited hands above it
 * (row < col), offsuit hands below it (row > col).
 */
export function handClassAt(row: number, col: number): HandClass {
  const a = GRID_RANKS[row];
  const b = GRID_RANKS[col];
  if (a === undefined || b === undefined) throw new Error(`Grid cell out of range: ${row},${col}`);
  if (row === col) return { label: a + b, high: a, low: b, kind: 'pair', row, col };
  const high = row < col ? a : b;
  const low = row < col ? b : a;
  const kind: HandKind = row < col ? 'suited' : 'offsuit';
  return { label: high + low + (kind === 'suited' ? 's' : 'o'), high, low, kind, row, col };
}

/** All 169 hand classes, row-major. */
export const HAND_GRID: readonly HandClass[][] = GRID_RANKS.map((_, r) =>
  GRID_RANKS.map((__, c) => handClassAt(r, c)),
);

const BY_LABEL = new Map<string, HandClass>(HAND_GRID.flat().map((h) => [h.label, h]));

export function handClassByLabel(label: string): HandClass {
  const h = BY_LABEL.get(label);
  if (!h) throw new Error(`Unknown hand class: "${label}"`);
  return h;
}

/** Enumerate the specific card combos that make up a hand class. */
export function combosOf(hand: HandClass): [Card, Card][] {
  const combos: [Card, Card][] = [];
  for (let i = 0; i < SUITS.length; i++) {
    for (let j = 0; j < SUITS.length; j++) {
      const s1 = SUITS[i]!;
      const s2 = SUITS[j]!;
      if (hand.kind === 'pair' && j <= i) continue;
      if (hand.kind === 'suited' && s1 !== s2) continue;
      if (hand.kind === 'offsuit' && s1 === s2) continue;
      combos.push([
        { rank: hand.high, suit: s1 },
        { rank: hand.low, suit: s2 },
      ]);
    }
  }
  return combos;
}

export function comboCount(hand: HandClass): number {
  return combosOf(hand).length;
}

export interface RangeStats {
  hands: number;
  combos: number;
  /** Fraction of all 1326 starting combos (0..1). */
  fraction: number;
}

/** Summarise a set of hand-class labels. */
export function rangeStats(labels: Iterable<string>): RangeStats {
  let hands = 0;
  let combos = 0;
  for (const label of new Set(labels)) {
    hands++;
    combos += comboCount(handClassByLabel(label));
  }
  return { hands, combos, fraction: combos / TOTAL_COMBOS };
}
