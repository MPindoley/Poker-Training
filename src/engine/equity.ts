/**
 * Equity calculator: hand vs hand, hand vs range, range vs range, 2–9 players, any board.
 *
 * - Exact enumeration when (live combo assignments × board run-outs) is small enough.
 * - Otherwise Monte Carlo with a seedable RNG, reporting a 95% margin of error.
 *
 * Win = sole best hand, tie = shares the best hand, equity = win + (tie share of the pot).
 * Pure and synchronous; the UI calls it through the Web Worker in src/workers.
 */
import { type Card } from './cards';
import { evaluateIndices } from './evaluator';
import { choose } from './math';
import { COMBOS, parseRange, toIndices, type Range } from './range';
import { createRng } from './rng';

/** A hand like "AsKd" / "As Kd", range notation like "QQ+, AKs", "random", or a Range. */
export type PlayerSpec = string | Range;

export interface EquityOptions {
  /** 0, 3, 4 or 5 cards. */
  board?: string | readonly Card[];
  /** Cards known to be out of play (e.g. mucked). */
  dead?: string | readonly Card[];
  /** Use exact enumeration when the work (assignments × run-outs) is at most this. Default 2,000,000. */
  maxExactBoards?: number;
  /** Monte Carlo trials. Default 100,000. */
  iterations?: number;
  seed?: number;
  forceMonteCarlo?: boolean;
}

export interface PlayerEquity {
  /** The spec as given (or "range" for Range objects). */
  input: string;
  /** Fraction of outcomes this player wins outright (0..1). */
  win: number;
  /** Fraction of outcomes this player ties for the best hand (0..1). */
  tie: number;
  /** Share of the pot won on average (0..1). */
  equity: number;
  /** Standard error of `equity` (0 for exact results). */
  stdError: number;
  /** 95% margin of error of `equity`: equity ± margin95. 0 when exact. */
  margin95: number;
  /** Weighted combos live after removing board and dead cards. */
  combos: number;
}

export interface EquityResult {
  players: PlayerEquity[];
  method: 'exact' | 'monte-carlo';
  /** Run-outs evaluated (exact: every weighted outcome; Monte Carlo: trials). */
  samples: number;
  /** Largest 95% margin across players (0 when exact). */
  maxMargin95: number;
  /** Confidence level the margins are quoted at (1 = exact). */
  confidence: number;
  elapsedMs: number;
}

const HAND_RE = /^([2-9TJQKA][shdc]){2}$/i;

export class EquityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EquityError';
  }
}

function specToRange(spec: PlayerSpec): Range {
  if (typeof spec !== 'string') return spec;
  const compact = spec.replace(/[\s,]+/g, '');
  // A bare hand is a single-combo range; parseRange handles both forms.
  return parseRange(HAND_RE.test(compact) ? compact : spec);
}

interface LiveCombo {
  c1: number;
  c2: number;
  weight: number;
}

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export function calculateEquity(specs: readonly PlayerSpec[], options: EquityOptions = {}): EquityResult {
  const start = now();
  const n = specs.length;
  if (n < 2 || n > 9) throw new EquityError('Equity needs 2 to 9 players');

  const board = toIndices(options.board);
  const dead = toIndices(options.dead);
  if (![0, 3, 4, 5].includes(board.length)) throw new EquityError('Board must have 0, 3, 4 or 5 cards');
  const blocked = new Uint8Array(52);
  for (const c of [...board, ...dead]) {
    if (blocked[c]) throw new EquityError('The same card appears twice in board/dead cards');
    blocked[c] = 1;
  }

  // Live combos per player (card removal against board + dead).
  const players: LiveCombo[][] = specs.map((spec, p) => {
    const range = specToRange(spec);
    const live: LiveCombo[] = [];
    range.weights.forEach((w, i) => {
      if (w <= 0) return;
      const { c1, c2 } = COMBOS[i]!;
      if (!blocked[c1] && !blocked[c2]) live.push({ c1, c2, weight: w });
    });
    if (!live.length) throw new EquityError(`Player ${p + 1} has no possible hands with these cards`);
    return live;
  });

  // Fixed hands of different players must not collide.
  const fixed = players.filter((l) => l.length === 1).map((l) => l[0]!);
  const fixedCards = fixed.flatMap((c) => [c.c1, c.c2]);
  if (new Set(fixedCards).size !== fixedCards.length) throw new EquityError('Two players hold the same card');
  // Known hands block other players' ranges too (so combo counts reflect every blocker).
  players.forEach((live, p) => {
    if (live.length === 1) return;
    const kept = live.filter((c) => !fixedCards.includes(c.c1) && !fixedCards.includes(c.c2));
    if (!kept.length) throw new EquityError(`Player ${p + 1} has no possible hands with these cards`);
    players[p] = kept;
  });

  const toDeal = 5 - board.length;
  const available = 52 - board.length - dead.length - 2 * n;
  if (available < toDeal) throw new EquityError('Not enough cards left in the deck');

  const assignments = players.reduce((prod, l) => prod * l.length, 1);
  const work = assignments * choose(available, toDeal);
  const exact = !options.forceMonteCarlo && work <= (options.maxExactBoards ?? 2_000_000);

  const acc = exact ? runExact(players, board, blocked, toDeal) : runMonteCarlo(players, board, blocked, toDeal, options);
  if (acc.total <= 0) throw new EquityError('No valid deal: every combination of hands collides');

  const z = 1.96;
  const result: PlayerEquity[] = players.map((live, p) => {
    const equity = acc.equity[p]! / acc.total;
    const stdError = exact ? 0 : Math.sqrt(Math.max(0, acc.equitySq[p]! / acc.total - equity * equity) / acc.total);
    return {
      input: typeof specs[p] === 'string' ? (specs[p] as string) : 'range',
      win: acc.win[p]! / acc.total,
      tie: acc.tie[p]! / acc.total,
      equity,
      stdError,
      margin95: z * stdError,
      combos: live.reduce((s, c) => s + c.weight, 0),
    };
  });

  return {
    players: result,
    method: exact ? 'exact' : 'monte-carlo',
    samples: acc.samples,
    maxMargin95: Math.max(...result.map((r) => r.margin95)),
    confidence: exact ? 1 : 0.95,
    elapsedMs: now() - start,
  };
}

interface Accumulator {
  win: Float64Array;
  tie: Float64Array;
  equity: Float64Array;
  equitySq: Float64Array;
  total: number;
  samples: number;
}

function newAccumulator(n: number): Accumulator {
  return {
    win: new Float64Array(n),
    tie: new Float64Array(n),
    equity: new Float64Array(n),
    equitySq: new Float64Array(n),
    total: 0,
    samples: 0,
  };
}

/**
 * Score one run-out. `hands` holds 2 cards per player; `seven` is a scratch buffer whose slots
 * 2..6 already hold the full board. Adds weight `w` to the accumulator.
 */
function showdown(acc: Accumulator, hands: Int32Array, n: number, seven: Int32Array, scores: Int32Array, w: number) {
  let best = -1;
  let winners = 0;
  for (let p = 0; p < n; p++) {
    seven[0] = hands[2 * p]!;
    seven[1] = hands[2 * p + 1]!;
    const s = evaluateIndices(seven, 7);
    scores[p] = s;
    if (s > best) {
      best = s;
      winners = 1;
    } else if (s === best) winners++;
  }
  const share = 1 / winners;
  for (let p = 0; p < n; p++) {
    if (scores[p] !== best) continue;
    if (winners === 1) acc.win[p]! += w;
    else acc.tie[p]! += w;
    acc.equity[p]! += w * share;
    acc.equitySq[p]! += w * share * share;
  }
  acc.total += w;
  acc.samples++;
}

function runExact(players: LiveCombo[][], board: number[], blocked: Uint8Array, toDeal: number): Accumulator {
  const n = players.length;
  const acc = newAccumulator(n);
  const used = new Uint8Array(blocked);
  const hands = new Int32Array(2 * n);
  const seven = new Int32Array(7);
  const scores = new Int32Array(n);
  board.forEach((c, i) => (seven[2 + i] = c));
  const deck = new Int32Array(52);

  const enumerateBoards = (weight: number) => {
    let m = 0;
    for (let c = 0; c < 52; c++) if (!used[c]) deck[m++] = c;
    const base = 2 + board.length;
    if (toDeal === 0) return showdown(acc, hands, n, seven, scores, weight);
    // Nested loops over k-subsets of the remaining deck (k = 1..5).
    const idx = new Int32Array(toDeal);
    for (let i = 0; i < toDeal; i++) idx[i] = i;
    for (;;) {
      for (let i = 0; i < toDeal; i++) seven[base + i] = deck[idx[i]!]!;
      showdown(acc, hands, n, seven, scores, weight);
      let i = toDeal - 1;
      while (i >= 0 && idx[i] === m - toDeal + i) i--;
      if (i < 0) break;
      idx[i]!++;
      for (let j = i + 1; j < toDeal; j++) idx[j] = idx[j - 1]! + 1;
    }
  };

  const assign = (p: number, weight: number) => {
    if (p === n) return enumerateBoards(weight);
    for (const combo of players[p]!) {
      if (used[combo.c1] || used[combo.c2]) continue;
      used[combo.c1] = used[combo.c2] = 1;
      hands[2 * p] = combo.c1;
      hands[2 * p + 1] = combo.c2;
      assign(p + 1, weight * combo.weight);
      used[combo.c1] = used[combo.c2] = 0;
    }
  };
  assign(0, 1);
  return acc;
}

function runMonteCarlo(
  players: LiveCombo[][],
  board: number[],
  blocked: Uint8Array,
  toDeal: number,
  options: EquityOptions,
): Accumulator {
  const n = players.length;
  const acc = newAccumulator(n);
  const rng = createRng(options.seed ?? Math.floor(Math.random() * 2 ** 32));
  const iterations = options.iterations ?? 100_000;
  const cumulative = players.map((live) => {
    const cum = new Float64Array(live.length);
    let s = 0;
    live.forEach((c, i) => (cum[i] = s += c.weight));
    return cum;
  });
  const pick = (p: number): LiveCombo => {
    const cum = cumulative[p]!;
    const x = rng() * cum[cum.length - 1]!;
    let lo = 0;
    let hi = cum.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cum[mid]! > x) hi = mid;
      else lo = mid + 1;
    }
    return players[p]![lo]!;
  };

  // stamp[c] === iteration means the card is taken this trial (avoids clearing each time).
  const stamp = new Int32Array(52).fill(-1);
  const hands = new Int32Array(2 * n);
  const seven = new Int32Array(7);
  const scores = new Int32Array(n);
  board.forEach((c, i) => (seven[2 + i] = c));
  const base = 2 + board.length;

  let trial = 0;
  let rejections = 0;
  while (acc.samples < iterations) {
    trial++;
    let ok = true;
    for (let p = 0; p < n && ok; p++) {
      const combo = pick(p);
      if (stamp[combo.c1] === trial || stamp[combo.c2] === trial) {
        ok = false;
        break;
      }
      stamp[combo.c1] = stamp[combo.c2] = trial;
      hands[2 * p] = combo.c1;
      hands[2 * p + 1] = combo.c2;
    }
    if (!ok) {
      // Restarting the whole deal keeps the sample distributed exactly like the weighted ranges.
      if (++rejections > 1000 * (acc.samples + 1)) break;
      continue;
    }
    for (let i = 0; i < toDeal; i++) {
      let c: number;
      do c = Math.floor(rng() * 52);
      while (blocked[c] || stamp[c] === trial);
      stamp[c] = trial;
      seven[base + i] = c;
    }
    showdown(acc, hands, n, seven, scores, 1);
  }
  return acc;
}
