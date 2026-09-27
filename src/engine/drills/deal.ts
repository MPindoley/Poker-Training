/** Random card dealing with constraints, for building drill spots. */
import { indexToString } from '../cards';
import type { Rng } from '../rng';

export class Dealer {
  readonly used = new Set<number>();
  constructor(private readonly rng: Rng) {}

  /** Take a random unused card, optionally with a given rank index (0..12) and/or suit index (0..3). */
  take(rank?: number, suit?: number): number {
    const options: number[] = [];
    for (let c = 0; c < 52; c++) {
      if (this.used.has(c)) continue;
      if (rank !== undefined && c >> 2 !== rank) continue;
      if (suit !== undefined && (c & 3) !== suit) continue;
      options.push(c);
    }
    if (!options.length) throw new NoCardError();
    const c = options[Math.floor(this.rng() * options.length)]!;
    this.used.add(c);
    return c;
  }

  /** Take a card matching a predicate. */
  takeWhere(pred: (c: number) => boolean): number {
    const options: number[] = [];
    for (let c = 0; c < 52; c++) if (!this.used.has(c) && pred(c)) options.push(c);
    if (!options.length) throw new NoCardError();
    const c = options[Math.floor(this.rng() * options.length)]!;
    this.used.add(c);
    return c;
  }

  int(min: number, max: number): number {
    return min + Math.floor(this.rng() * (max - min + 1));
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.rng() * items.length)]!;
  }
}

export class NoCardError extends Error {
  constructor() {
    super('No card satisfies the constraint');
  }
}

export const codes = (cards: readonly number[]) => cards.map(indexToString);
/** "{Ah}{Kh}" token string for rich text. */
export const tokens = (cards: readonly number[]) => codes(cards).map((c) => `{${c}}`).join(' ');
