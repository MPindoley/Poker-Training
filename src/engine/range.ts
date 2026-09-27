/**
 * Weighted hand ranges.
 *
 * A Range stores a weight (0..1) for each of the 1326 specific two-card combos, so it can express
 * class-level ranges ("AKs"), specific combos ("AsKs"), partial weights ("AKo@50") and card removal.
 * Ranges are plain objects holding a typed array, so they survive postMessage to a Web Worker.
 */
import { RANKS, cardFromIndex, cardIndex, cardToString, isRank, parseCards, type Card, type Rank } from './cards';
import { HAND_GRID, TOTAL_COMBOS } from './hands';

export interface Range {
  readonly weights: Float64Array;
}

export interface Combo {
  /** Card indices, c1 > c2. */
  c1: number;
  c2: number;
  /** Hand class label, e.g. "AKs". */
  label: string;
}

export interface WeightedCombo extends Combo {
  index: number;
  weight: number;
}

// ---------------------------------------------------------------------------
// Combo tables

/** All 1326 combos, in a fixed order. */
export const COMBOS: readonly Combo[] = (() => {
  const list: Combo[] = [];
  for (let a = 51; a >= 0; a--) {
    for (let b = a - 1; b >= 0; b--) list.push({ c1: a, c2: b, label: labelForCards(a, b) });
  }
  return list;
})();

const COMBO_INDEX = new Int16Array(52 * 52).fill(-1);
COMBOS.forEach((c, i) => {
  COMBO_INDEX[c.c1 * 52 + c.c2] = i;
  COMBO_INDEX[c.c2 * 52 + c.c1] = i;
});

/** Combo indices for each hand-class label. */
const CLASS_COMBOS = new Map<string, number[]>();
COMBOS.forEach((c, i) => {
  const list = CLASS_COMBOS.get(c.label) ?? [];
  list.push(i);
  CLASS_COMBOS.set(c.label, list);
});

function labelForCards(a: number, b: number): string {
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  const rHi = RANKS[hi >> 2]!;
  const rLo = RANKS[lo >> 2]!;
  if (rHi === rLo) return rHi + rLo;
  return rHi + rLo + ((hi & 3) === (lo & 3) ? 's' : 'o');
}

export function comboIndex(a: number, b: number): number {
  const i = COMBO_INDEX[a * 52 + b]!;
  if (i < 0) throw new Error('A combo needs two different cards');
  return i;
}

export function comboToString(i: number): string {
  const c = COMBOS[i]!;
  return cardToString(cardFromIndex(c.c1)) + cardToString(cardFromIndex(c.c2));
}

export function classComboIndices(label: string): readonly number[] {
  const list = CLASS_COMBOS.get(label);
  if (!list) throw new Error(`Unknown hand class: "${label}"`);
  return list;
}

// ---------------------------------------------------------------------------
// Construction

export function emptyRange(): Range {
  return { weights: new Float64Array(TOTAL_COMBOS) };
}

export function fullRange(): Range {
  return { weights: new Float64Array(TOTAL_COMBOS).fill(1) };
}

export function cloneRange(range: Range): Range {
  return { weights: new Float64Array(range.weights) };
}

/** A range holding exactly one specific combo. */
export function rangeFromCards(cards: readonly Card[]): Range {
  if (cards.length !== 2) throw new Error('A hand needs exactly two cards');
  const r = emptyRange();
  r.weights[comboIndex(cardIndex(cards[0]!), cardIndex(cards[1]!))] = 1;
  return r;
}

export function setClassWeight(range: Range, label: string, weight: number): void {
  for (const i of classComboIndices(label)) range.weights[i] = weight;
}

// ---------------------------------------------------------------------------
// Parsing

export class RangeParseError extends Error {
  constructor(
    public readonly token: string,
    message: string,
  ) {
    super(`"${token}": ${message}`);
    this.name = 'RangeParseError';
  }
}

const rIdx = (r: Rank) => RANKS.indexOf(r);

/** Expand a single class-level token (no weight) into hand-class labels. */
function expandToken(token: string): string[] {
  const t = token;
  const bad = (msg: string): never => {
    throw new RangeParseError(token, msg);
  };

  // Dash ranges: "TT-77", "A5s-A2s", "76s-54s"
  if (t.includes('-')) {
    const [from, to, extra] = t.split('-');
    if (!from || !to || extra !== undefined) bad('expected FROM-TO');
    const a = parseClass(from!, token);
    const b = parseClass(to!, token);
    if (a.suffix !== b.suffix) bad('both ends must have the same suitedness');
    const gapA = rIdx(a.high) - rIdx(a.low);
    const gapB = rIdx(b.high) - rIdx(b.low);
    const out: string[] = [];
    if (a.high === a.low || b.high === b.low) {
      if (a.high !== a.low || b.high !== b.low) bad('cannot mix pairs and non-pairs');
      const [lo, hi] = [rIdx(a.high), rIdx(b.high)].sort((x, y) => x - y) as [number, number];
      for (let r = lo; r <= hi; r++) out.push(RANKS[r]! + RANKS[r]!);
    } else if (a.high === b.high) {
      // Same top card, kicker runs: A5s-A2s
      const [lo, hi] = [rIdx(a.low), rIdx(b.low)].sort((x, y) => x - y) as [number, number];
      for (let r = lo; r <= hi; r++) out.push(a.high + RANKS[r]! + a.suffix);
    } else if (gapA === gapB) {
      // Same gap, both cards slide: 76s-54s, KQo-T9o
      const [lo, hi] = [rIdx(a.low), rIdx(b.low)].sort((x, y) => x - y) as [number, number];
      for (let r = lo; r <= hi; r++) out.push(RANKS[r + gapA]! + RANKS[r]! + a.suffix);
    } else {
      bad('ends must share a top card or a gap');
    }
    return out.flatMap(expandSuffix);
  }

  const plus = t.endsWith('+');
  const c = parseClass(plus ? t.slice(0, -1) : t, token);
  if (!plus) return expandSuffix(c.high + c.low + c.suffix);
  if (c.high === c.low) {
    // 77+ -> 77..AA
    const out: string[] = [];
    for (let r = rIdx(c.high); r <= 12; r++) out.push(RANKS[r]! + RANKS[r]!);
    return out;
  }
  // A2s+ -> A2s..AKs (kicker climbs up to one below the top card)
  const out: string[] = [];
  for (let r = rIdx(c.low); r < rIdx(c.high); r++) out.push(c.high + RANKS[r]! + c.suffix);
  return out.flatMap(expandSuffix);
}

function parseClass(text: string, token: string): { high: Rank; low: Rank; suffix: '' | 's' | 'o' } {
  const m = /^([2-9TJQKA])([2-9TJQKA])([so]?)$/i.exec(text);
  if (!m) throw new RangeParseError(token, 'expected a hand like AKs, T9o, 77 or AK');
  let a = m[1]!.toUpperCase();
  let b = m[2]!.toUpperCase();
  const suffix = (m[3] ?? '').toLowerCase() as '' | 's' | 'o';
  if (!isRank(a) || !isRank(b)) throw new RangeParseError(token, 'bad rank');
  if (rIdx(a as Rank) < rIdx(b as Rank)) [a, b] = [b, a];
  if (a === b && suffix) throw new RangeParseError(token, 'pairs cannot be suited or offsuit');
  return { high: a as Rank, low: b as Rank, suffix };
}

/** "AK" (no suffix) means both AKs and AKo. */
function expandSuffix(label: string): string[] {
  if (label.length === 2 && label[0] !== label[1]) return [label + 's', label + 'o'];
  return [label];
}

function parseWeight(raw: string, token: string): number {
  const pct = raw.endsWith('%');
  const n = Number(pct ? raw.slice(0, -1) : raw);
  if (!Number.isFinite(n)) throw new RangeParseError(token, 'bad weight');
  // "@50" and "50%" are percentages; ":0.5" is a fraction.
  const w = pct || token.includes('@') ? n / 100 : n;
  if (w < 0 || w > 1) throw new RangeParseError(token, 'weight must be between 0 and 1 (0%–100%)');
  return w;
}

/**
 * Parse standard range notation, e.g. "22+, A2s+, KTs+, AJo+, T9s, 76s-54s".
 * Also supports: "AK" (suited + offsuit), specific combos "AsKs", weights "AKo@50" / "AKo:0.5",
 * and "random" / "any" for every hand. Later tokens overwrite earlier ones.
 */
export function parseRange(text: string): Range {
  const range = emptyRange();
  const tokens = text
    .split(/[,\s]+/)
    .map((t) => t.trim())
    .filter(Boolean);
  for (const raw of tokens) {
    const [body, weightText] = raw.split(/[@:]/) as [string, string | undefined];
    const weight = weightText === undefined ? 1 : parseWeight(weightText, raw);
    const lower = body.toLowerCase();
    if (lower === 'random' || lower === 'any' || lower === '100%') {
      range.weights.fill(weight);
      continue;
    }
    if (/^([2-9TJQKA][shdc]){2}$/i.test(body)) {
      const cards = parseCards(body);
      range.weights[comboIndex(cardIndex(cards[0]!), cardIndex(cards[1]!))] = weight;
      continue;
    }
    for (const label of expandToken(body)) setClassWeight(range, label, weight);
  }
  return range;
}

// ---------------------------------------------------------------------------
// Counting and card removal

/** Card indices from cards or a string like "Kh7h2c". */
export function toIndices(cards: readonly Card[] | string | undefined): number[] {
  if (!cards) return [];
  return (typeof cards === 'string' ? parseCards(cards) : cards).map(cardIndex);
}

/** Combos in the range that don't touch any dead card, with their weights. */
export function rangeCombos(range: Range, dead: readonly Card[] | string = []): WeightedCombo[] {
  const deadSet = new Set(toIndices(dead));
  const out: WeightedCombo[] = [];
  range.weights.forEach((weight, index) => {
    if (weight <= 0) return;
    const c = COMBOS[index]!;
    if (deadSet.has(c.c1) || deadSet.has(c.c2)) return;
    out.push({ ...c, index, weight });
  });
  return out;
}

/** Weighted number of combos available after removing dead cards (blockers). */
export function countCombos(range: Range, dead: readonly Card[] | string = []): number {
  return rangeCombos(range, dead).reduce((sum, c) => sum + c.weight, 0);
}

/** Weighted combos as a fraction of all 1326 starting hands (0..1). */
export function rangeFraction(range: Range): number {
  return countCombos(range) / TOTAL_COMBOS;
}

/** Combo count of a hand or short notation ("AK", "AKs", "QQ+") after card removal. */
export function classCombos(notation: string, dead: readonly Card[] | string = []): number {
  return countCombos(parseRange(notation), dead);
}

// ---------------------------------------------------------------------------
// Grid conversion

/** 13x13 matrix of class weights (average weight of the class's combos), rows/cols A..2. */
export function rangeToGrid(range: Range): number[][] {
  return HAND_GRID.map((row) =>
    row.map((h) => {
      const idx = classComboIndices(h.label);
      return idx.reduce((s, i) => s + range.weights[i]!, 0) / idx.length;
    }),
  );
}

/** Build a range from a 13x13 weight matrix (as produced by rangeToGrid). */
export function gridToRange(grid: readonly (readonly number[])[]): Range {
  const r = emptyRange();
  HAND_GRID.forEach((row, ri) =>
    row.forEach((h, ci) => {
      const w = grid[ri]?.[ci] ?? 0;
      if (w > 0) setClassWeight(r, h.label, w);
    }),
  );
  return r;
}

/** Map of class label -> weight for every class with weight > 0 (uniform classes only keep one value). */
export function rangeToClassWeights(range: Range): Map<string, number> {
  const grid = rangeToGrid(range);
  const out = new Map<string, number>();
  HAND_GRID.forEach((row, ri) =>
    row.forEach((h, ci) => {
      const w = grid[ri]![ci]!;
      if (w > 0) out.set(h.label, w);
    }),
  );
  return out;
}

/** Range from a set of class labels (e.g. the RangeGrid component's selection). */
export function rangeFromLabels(labels: Iterable<string>, weight = 1): Range {
  const r = emptyRange();
  for (const label of labels) setClassWeight(r, label, weight);
  return r;
}

// ---------------------------------------------------------------------------
// Back to notation

function formatWeight(w: number): string {
  return w === 1 ? '' : `@${Math.round(w * 1000) / 10}`;
}

/** Compress runs within one weight group into notation tokens. */
function compressClasses(labels: Set<string>): string[] {
  const tokens: string[] = [];
  // Pairs, high to low.
  let run: number[] = [];
  const flushPairs = () => {
    if (!run.length) return;
    const top = run[0]!;
    const bottom = run[run.length - 1]!;
    const P = (r: number) => RANKS[r]! + RANKS[r]!;
    if (top === 12 && run.length > 1) tokens.push(`${P(bottom)}+`);
    else if (run.length === 1) tokens.push(P(top));
    else tokens.push(`${P(top)}-${P(bottom)}`);
    run = [];
  };
  for (let r = 12; r >= 0; r--) {
    if (labels.has(RANKS[r]! + RANKS[r]!)) run.push(r);
    else flushPairs();
  }
  flushPairs();

  // Non-pairs: per top card and suitedness, runs of kickers.
  for (let hi = 12; hi >= 1; hi--) {
    const H = RANKS[hi]!;
    for (const suffix of ['s', 'o'] as const) {
      let kick: number[] = [];
      const flush = () => {
        if (!kick.length) return;
        const top = kick[0]!;
        const bottom = kick[kick.length - 1]!;
        const L = (r: number) => H + RANKS[r]! + suffix;
        if (top === hi - 1 && kick.length > 1) tokens.push(`${L(bottom)}+`);
        else if (kick.length === 1) tokens.push(L(top));
        else tokens.push(`${L(top)}-${L(bottom)}`);
        kick = [];
      };
      for (let lo = hi - 1; lo >= 0; lo--) {
        if (labels.has(H + RANKS[lo]! + suffix)) kick.push(lo);
        else flush();
      }
      flush();
    }
  }
  return tokens;
}

/**
 * Canonical notation for a range. Classes whose combos all share a weight are written at class
 * level; partially-included classes fall back to specific combos. parseRange(rangeToString(r))
 * reproduces r exactly (weights rounded to 0.1%).
 */
export function rangeToString(range: Range): string {
  const groups = new Map<number, Set<string>>();
  const specific: string[] = [];
  for (const h of HAND_GRID.flat()) {
    const idx = classComboIndices(h.label);
    const w0 = range.weights[idx[0]!]!;
    if (idx.every((i) => range.weights[i] === w0)) {
      if (w0 > 0) {
        const g = groups.get(w0) ?? new Set<string>();
        g.add(h.label);
        groups.set(w0, g);
      }
    } else {
      for (const i of idx) {
        const w = range.weights[i]!;
        if (w > 0) specific.push(comboToString(i) + formatWeight(w));
      }
    }
  }
  if (groups.size === 1 && groups.get(1)?.size === 169) return 'random';
  const tokens: string[] = [];
  for (const w of [...groups.keys()].sort((a, b) => b - a)) {
    tokens.push(...compressClasses(groups.get(w)!).map((t) => t + formatWeight(w)));
  }
  return [...tokens, ...specific].join(', ');
}
