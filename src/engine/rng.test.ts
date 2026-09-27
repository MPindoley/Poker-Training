import { describe, expect, it } from 'vitest';
import { cardToString } from './cards';
import { createRng, randomInt, seedFromString, shuffle, shuffledDeck } from './rng';

describe('seedable rng', () => {
  it('replays the same sequence for the same seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    const c = createRng(43);
    const seqA = Array.from({ length: 10 }, a);
    expect(Array.from({ length: 10 }, b)).toEqual(seqA);
    expect(Array.from({ length: 10 }, c)).not.toEqual(seqA);
  });

  it('stays in [0, 1) and is roughly uniform', () => {
    const rng = createRng(7);
    const buckets = new Array(10).fill(0);
    for (let i = 0; i < 100_000; i++) {
      const x = rng();
      expect(x >= 0 && x < 1).toBe(true);
      buckets[Math.floor(x * 10)]++;
    }
    for (const n of buckets) expect(Math.abs(n - 10_000)).toBeLessThan(500);
  });

  it('randomInt covers its range', () => {
    const rng = createRng(1);
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i++) seen.add(randomInt(rng, 6));
    expect([...seen].sort()).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('string seeds are stable', () => {
    expect(seedFromString('daily-2026-09-27')).toBe(seedFromString('daily-2026-09-27'));
    expect(seedFromString('a')).not.toBe(seedFromString('b'));
  });
});

describe('shuffle', () => {
  it('shuffled deck is a permutation and replayable', () => {
    const d1 = shuffledDeck(createRng(99)).map(cardToString);
    const d2 = shuffledDeck(createRng(99)).map(cardToString);
    expect(d1).toEqual(d2);
    expect(new Set(d1).size).toBe(52);
  });

  it('does not mutate the input', () => {
    const items = [1, 2, 3, 4, 5];
    const out = shuffle(items, createRng(5));
    expect(items).toEqual([1, 2, 3, 4, 5]);
    expect([...out].sort()).toEqual(items);
  });

  it('is unbiased: each position of a 3-item shuffle appears ~1/6 of the time', () => {
    const rng = createRng(2024);
    const counts = new Map<string, number>();
    for (let i = 0; i < 60_000; i++) {
      const k = shuffle(['a', 'b', 'c'], rng).join('');
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    expect(counts.size).toBe(6);
    for (const n of counts.values()) expect(Math.abs(n - 10_000)).toBeLessThan(400);
  });
});
