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

// ---------------------------------------------------------------------------
// Integer card indices (0..51) for the fast paths: index = rankIndex * 4 + suitIndex,
// where rankIndex 0 = deuce … 12 = ace and suits follow SUITS order (s, h, d, c).

export function cardIndex(card: Card): number {
  return RANKS.indexOf(card.rank) * 4 + SUITS.indexOf(card.suit);
}

export function cardFromIndex(index: number): Card {
  const rank = RANKS[index >> 2];
  const suit = SUITS[index & 3];
  if (rank === undefined || suit === undefined || index < 0 || index > 51) {
    throw new Error(`Invalid card index: ${index}`);
  }
  return { rank, suit };
}

export function indexToString(index: number): string {
  return cardToString(cardFromIndex(index));
}

/**
 * Parse a run of cards such as "AsKd", "As Kd", "As,Kd,7h". Empty input gives [].
 * Throws on bad codes or duplicates.
 */
export function parseCards(text: string): Card[] {
  const compact = text.replace(/[\s,]+/g, '');
  if (compact.length % 2 !== 0) throw new Error(`Invalid card list: "${text}"`);
  const cards: Card[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < compact.length; i += 2) {
    const card = parseCard(compact.slice(i, i + 2));
    const key = cardToString(card);
    if (seen.has(key)) throw new Error(`Duplicate card: ${key}`);
    seen.add(key);
    cards.push(card);
  }
  return cards;
}

/** Like parseCards but returns integer indices. */
export function parseCardIndices(text: string): number[] {
  return parseCards(text).map(cardIndex);
}
