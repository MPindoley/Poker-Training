/**
 * Builds realistic drawing spots: hero holds a draw, villain holds (or ranges over) made hands.
 * Every number about the spot (outs, equity) is computed afterwards by the engine.
 */
import { RANKS } from '../cards';
import { calculateOuts, type OutsResult } from '../outs';
import type { Rng } from '../rng';
import { Dealer, NoCardError, codes } from './deal';

export type DrawKind = 'flush' | 'oesd' | 'gutshot' | 'combo' | 'overcards';

export const DRAW_NAMES: Record<DrawKind, string> = {
  flush: 'flush draw',
  oesd: 'open-ended straight draw',
  gutshot: 'gutshot',
  combo: 'flush + straight draw',
  overcards: 'two overcards',
};

export interface DrawSpot {
  hero: number[];
  board: number[];
  /** Range notation or a specific combo like "KsQd". */
  villainRange: string;
  /** Human label, may contain card tokens. */
  villainLabel: string;
  /** Villain's exact cards when villain is a single hand. */
  villainCards: number[] | null;
  draw: DrawKind;
  outs: OutsResult;
}

export interface DrawSpotOptions {
  street: 'flop' | 'turn';
  draws: readonly DrawKind[];
  villain: 'hand' | 'range';
  minOuts?: number;
  maxOuts?: number;
  requireDirty?: boolean;
}

function buildDraw(d: Dealer, kind: DrawKind): { hero: number[]; board: number[] } {
  const hero: number[] = [];
  const board: number[] = [];
  const blankRank = (avoid: number[]) => d.pick([...Array(13).keys()].filter((r) => !avoid.includes(r)));
  switch (kind) {
    case 'flush': {
      const s = d.int(0, 3);
      hero.push(d.take(undefined, s), d.take(undefined, s));
      board.push(d.take(undefined, s), d.take(undefined, s), d.takeWhere((c) => (c & 3) !== s));
      break;
    }
    case 'oesd':
    case 'gutshot': {
      const r = kind === 'oesd' ? d.int(1, 8) : d.int(0, 8);
      const run = kind === 'oesd' ? [r, r + 1, r + 2, r + 3] : [r, r + 1, r + 3, r + 4];
      const order = [...run].sort(() => (d.int(0, 1) ? 1 : -1));
      hero.push(d.take(order[0]), d.take(order[1]));
      board.push(d.take(order[2]), d.take(order[3]));
      board.push(d.take(blankRank([r - 1, r, r + 1, r + 2, r + 3, r + 4, r + 5])));
      break;
    }
    case 'combo': {
      const s = d.int(0, 3);
      const r = d.int(1, 8);
      const run = [r, r + 1, r + 2, r + 3];
      hero.push(d.take(run[0], s), d.take(run[2], s));
      board.push(d.take(run[1], s), d.takeWhere((c) => c >> 2 === run[3] && (c & 3) !== s));
      board.push(d.takeWhere((c) => (c & 3) === s && !run.includes(c >> 2) && Math.abs((c >> 2) - r) > 1 && (c >> 2) !== r + 4));
      break;
    }
    case 'overcards': {
      const ranks = new Set<number>();
      while (ranks.size < 3) ranks.add(d.int(0, 8)); // board 2..T
      const top = Math.max(...ranks);
      for (const r of ranks) board.push(d.take(r));
      const h1 = d.int(Math.max(top + 1, 9), 12);
      let h2 = d.int(Math.max(top + 1, 9), 12);
      if (h2 === h1) h2 = h1 === 12 ? 11 : h1 + 1;
      const c1 = d.take(h1);
      hero.push(c1, d.takeWhere((c) => c >> 2 === h2 && (c & 3) !== (c1 & 3)));
      break;
    }
  }
  return { hero, board };
}

function villainHand(d: Dealer, board: number[], hero: number[], kind: DrawKind): { cards: number[]; label: string } {
  const top = Math.max(...board.map((c) => c >> 2));
  const heroRanks = hero.map((c) => c >> 2);
  const canOverpair = top < 12 && kind !== 'overcards';
  if (canOverpair && d.int(0, 9) < 3) {
    const pr = d.int(top + 1, 12);
    const cards = [d.take(pr), d.take(pr)];
    return { cards, label: `an overpair ${codes(cards).map((c) => `{${c}}`).join(' ')}` };
  }
  const kickers = [...Array(13).keys()].filter((r) => r !== top && r >= 6 && !heroRanks.includes(r));
  const cards = [d.take(top), d.take(d.pick(kickers.length ? kickers : [top === 12 ? 11 : 12]))];
  return { cards, label: `top pair ${codes(cards).map((c) => `{${c}}`).join(' ')}` };
}

/** Made-hand range for the board: top pair (T+ kicker), overpairs, two pair and sets. */
export function madeHandRange(board: number[], withSetsAndTwoPair: boolean): { notation: string; label: string } {
  const ranks = [...new Set(board.map((c) => c >> 2))].sort((a, b) => b - a);
  const top = ranks[0]!;
  const R = (r: number) => RANKS[r]!;
  const parts: string[] = [];
  for (let k = 8; k <= 12; k++) if (k !== top) parts.push(R(top) + R(k));
  for (let p = top + 1; p <= 12; p++) parts.push(R(p) + R(p));
  if (withSetsAndTwoPair) {
    for (const r of ranks) parts.push(R(r) + R(r));
    for (let i = 0; i < ranks.length; i++) for (let j = i + 1; j < ranks.length; j++) parts.push(R(ranks[i]!) + R(ranks[j]!));
  }
  const label = withSetsAndTwoPair ? 'top pair (T+ kicker), overpairs, two pair and sets' : 'top pair (T+ kicker) and overpairs';
  return { notation: [...new Set(parts)].join(', '), label };
}

export function buildDrawSpot(rng: Rng, opts: DrawSpotOptions): DrawSpot {
  const minOuts = opts.minOuts ?? 2;
  const maxOuts = opts.maxOuts ?? 17;
  for (let attempt = 0; attempt < 400; attempt++) {
    const d = new Dealer(rng);
    try {
      const draw = d.pick(opts.draws);
      const { hero, board } = buildDraw(d, draw);
      // Avoid accidental 4-flushes on non-flush draws (they'd mislabel the draw).
      const suitCount = [0, 0, 0, 0];
      [...hero, ...board].forEach((c) => suitCount[c & 3]!++);
      if (draw !== 'flush' && draw !== 'combo' && Math.max(...suitCount) >= 4) continue;
      if (opts.street === 'turn') board.push(d.take());
      let villainRange: string;
      let villainLabel: string;
      let villainCards: number[] | null = null;
      if (opts.villain === 'hand') {
        const v = villainHand(d, board, hero, draw);
        villainCards = v.cards;
        villainRange = codes(v.cards).join('');
        villainLabel = v.label;
      } else {
        const r = madeHandRange(board, true);
        villainRange = r.notation;
        villainLabel = r.label;
      }
      const outs = calculateOuts(codes(hero).join(''), codes(board).join(''), villainRange);
      if (outs.shareNow >= 0.5) continue;
      if (outs.outs.length < minOuts || outs.outs.length > maxOuts) continue;
      if (opts.requireDirty && outs.dirty.length === 0) continue;
      return { hero, board, villainRange, villainLabel, villainCards, draw, outs };
    } catch (e) {
      if (e instanceof NoCardError) continue;
      if (e instanceof Error && /no live combos/.test(e.message)) continue;
      throw e;
    }
  }
  throw new Error('Could not build a drawing spot');
}
