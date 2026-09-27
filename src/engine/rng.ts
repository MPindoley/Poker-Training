/**
 * Seedable pseudo-random numbers so drills and simulations can be replayed exactly.
 * Mulberry32: tiny, fast, good enough statistical quality for card dealing.
 */
import { fullDeck, type Card } from './cards';

export type Rng = () => number;

/** Returns a function producing floats in [0, 1). Same seed, same sequence. */
export function createRng(seed: number = Date.now()): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable 32-bit seed from a string (FNV-1a), e.g. a daily drill id. */
export function seedFromString(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Uniform integer in [0, n). */
export function randomInt(rng: Rng, n: number): number {
  return Math.floor(rng() * n);
}

/** Fisher–Yates shuffle in place. */
export function shuffleInPlace<T>(items: T[], rng: Rng): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = randomInt(rng, i + 1);
    const tmp = items[i]!;
    items[i] = items[j]!;
    items[j] = tmp;
  }
  return items;
}

/** Shuffled copy; the input is untouched. */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  return shuffleInPlace([...items], rng);
}

/** A freshly shuffled 52-card deck. */
export function shuffledDeck(rng: Rng): Card[] {
  return shuffleInPlace(fullDeck(), rng);
}
