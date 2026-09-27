/** Card primitives. Pure logic — no React imports anywhere in /src/engine. */

export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'] as const;
export const SUITS = ['s', 'h', 'd', 'c'] as const;

export type Rank = (typeof RANKS)[number];
export type Suit = (typeof SUITS)[number];

export interface Card {
  rank: Rank;
  suit: Suit;
}

export const SUIT_NAMES: Record<Suit, string> = {
  s: 'spades',
  h: 'hearts',
  d: 'diamonds',
  c: 'clubs',
};

/** Numeric rank value: 2..14 (ace high). */
export function rankValue(rank: Rank): number {
  return RANKS.indexOf(rank) + 2;
}

export function isRank(value: string): value is Rank {
  return (RANKS as readonly string[]).includes(value);
}

export function isSuit(value: string): value is Suit {
  return (SUITS as readonly string[]).includes(value);
}

/** Parse a two-character card code like "As", "Td", "9h". Case-insensitive rank, lowercase suit. */
export function parseCard(code: string): Card {
  const rank = code.charAt(0).toUpperCase();
  const suit = code.charAt(1).toLowerCase();
  if (code.length !== 2 || !isRank(rank) || !isSuit(suit)) {
    throw new Error(`Invalid card code: "${code}"`);
  }
  return { rank, suit };
}

export function cardToString(card: Card): string {
  return card.rank + card.suit;
}

/** A fresh, ordered 52-card deck. */
export function fullDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) deck.push({ rank, suit });
  }
  return deck;
}
