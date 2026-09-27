import { describe, expect, it } from 'vitest';
import { cardToString, fullDeck, parseCard, rankValue } from './cards';

describe('cards', () => {
  it('builds a 52-card deck with no duplicates', () => {
    const deck = fullDeck().map(cardToString);
    expect(deck).toHaveLength(52);
    expect(new Set(deck).size).toBe(52);
  });

  it('parses and prints card codes', () => {
    expect(parseCard('As')).toEqual({ rank: 'A', suit: 's' });
    expect(parseCard('td')).toEqual({ rank: 'T', suit: 'd' });
    expect(cardToString(parseCard('9h'))).toBe('9h');
  });

  it('rejects bad codes', () => {
    expect(() => parseCard('1s')).toThrow();
    expect(() => parseCard('Ax')).toThrow();
    expect(() => parseCard('10h')).toThrow();
  });

  it('ranks ace high', () => {
    expect(rankValue('2')).toBe(2);
    expect(rankValue('T')).toBe(10);
    expect(rankValue('A')).toBe(14);
  });
});
