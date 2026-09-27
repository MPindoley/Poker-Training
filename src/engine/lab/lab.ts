/**
 * RANGE LAB: set up 2–6 players (a hand or a range each), a board and dead cards, and study the
 * spot: equity, how each range breaks down into hand buckets, what beats you, blockers, range and
 * nut advantage, and how every possible next card changes your equity. Pure; the UI runs `runLab`
 * and `nextCardGrid` in the worker.
 */
import { indexToString, parseCardIndices } from '../cards';
import { calculateEquity, type EquityResult } from '../equity';
import { CATEGORY_NAMES, evaluateIndices, type HandCategory } from '../evaluator';
import { BUCKETS, classifyHand, type Bucket } from '../postflop/buckets';
import { describeCardChanges } from '../postflop/turnCard';
import { COMBOS, parseRange, type Range } from '../range';
import type { Grade } from '../grading';
import type { Chart } from '../preflop/charts';

export const LAB_MIN_PLAYERS = 2;
export const LAB_MAX_PLAYERS = 6;
const HAND_RE = /^([2-9TJQKA][shdc]){2}$/i;

export interface LabPlayer {
  kind: 'hand' | 'range';
  /** "AhKd" for a hand, range notation ("QQ+, AKs") for a range. */
  text: string;
  /** Where the range came from, e.g. "BTN open · home-40bb" (display only). */
  source?: string;
}

export interface LabScenario {
  name?: string;
  players: LabPlayer[];
  board: string[];
  dead: string[];
}

export class LabError extends Error {}

const compact = (s: string) => s.replace(/\s+/g, '');

/** Validate and normalise; throws LabError with a readable message. */
export function validateScenario(s: LabScenario): LabScenario {
  if (s.players.length < LAB_MIN_PLAYERS || s.players.length > LAB_MAX_PLAYERS) throw new LabError(`Use ${LAB_MIN_PLAYERS} to ${LAB_MAX_PLAYERS} players.`);
  if (![0, 3, 4, 5].includes(s.board.length)) throw new LabError('The board needs 0, 3, 4 or 5 cards.');
  const seen = new Set<number>();
  const take = (codes: string[], what: string) => {
    for (const c of codes) {
      const [i] = parseCardIndices(c);
      if (i === undefined) throw new LabError(`${what}: “${c}” isn’t a card.`);
      if (seen.has(i)) throw new LabError(`${indexToString(i)} is used twice.`);
      seen.add(i);
    }
  };
  take(s.board, 'Board');
  take(s.dead, 'Dead cards');
  s.players.forEach((p, i) => {
    if (p.kind === 'hand') {
      if (!HAND_RE.test(compact(p.text))) throw new LabError(`Player ${i + 1}: pick two cards.`);
      take(compact(p.text).match(/../g)!, `Player ${i + 1}`);
    } else {
      try {
        parseRange(p.text);
      } catch (e) {
        throw new LabError(`Player ${i + 1}: ${(e as Error).message}`);
      }
    }
  });
  return s;
}

// ---------------------------------------------------------------------------
// Share links: the whole scenario lives in the URL query.

/** URL query (without "?") for a scenario. Players: h:AhKd or r:<notation>, joined by "~". */
export function encodeScenario(s: LabScenario): string {
  const q = new URLSearchParams();
  q.set('p', s.players.map((p) => `${p.kind === 'hand' ? 'h' : 'r'}:${p.kind === 'hand' ? compact(p.text) : p.text.trim()}`).join('~'));
  if (s.board.length) q.set('b', s.board.join(''));
  if (s.dead.length) q.set('d', s.dead.join(''));
  if (s.name) q.set('n', s.name);
  return q.toString();
}

/** Scenario from a URL query, or null if it isn't a valid lab link. */
export function decodeScenario(search: string): LabScenario | null {
  const q = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const p = q.get('p');
  if (!p) return null;
  const cards = (x: string | null) => (x ? (x.match(/[2-9TJQKA][shdc]/gi) ?? []).map((c) => c[0]!.toUpperCase() + c[1]!.toLowerCase()) : []);
  const players: LabPlayer[] = [];
  for (const part of p.split('~')) {
    const m = /^([hr]):(.*)$/.exec(part);
    if (!m) return null;
    players.push({ kind: m[1] === 'h' ? 'hand' : 'range', text: m[2]! });
  }
  const s: LabScenario = { players, board: cards(q.get('b')), dead: cards(q.get('d')), ...(q.get('n') ? { name: q.get('n')! } : {}) };
  try {
    return validateScenario(s);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Pure analysis pieces

export function playerRange(p: LabPlayer): Range {
  return parseRange(p.kind === 'hand' ? compact(p.text) : p.text);
}

const idx = (codes: readonly string[]) => codes.flatMap((c) => parseCardIndices(c));

/** Live weighted combos of a range, excluding any combo that uses a blocked card. */
function liveCombos(range: Range, blocked: ReadonlySet<number>) {
  const out: { c1: number; c2: number; label: string; w: number }[] = [];
  COMBOS.forEach((c, i) => {
    const w = range.weights[i]!;
    if (w > 0 && !blocked.has(c.c1) && !blocked.has(c.c2)) out.push({ c1: c.c1, c2: c.c2, label: c.label, w });
  });
  return out;
}

export interface BucketBreakdown {
  /** Share of the range's live combos in each bucket (sums to 1 when combos > 0). */
  shares: Record<Bucket, number>;
  combos: number;
}

/** How a range splits into the postflop hand buckets on this board (board must have 3+ cards). */
export function bucketBreakdown(range: Range, board: readonly number[], dead: readonly number[] = []): BucketBreakdown {
  const shares = Object.fromEntries(BUCKETS.map((b) => [b, 0])) as Record<Bucket, number>;
  const live = liveCombos(range, new Set([...board, ...dead]));
  let total = 0;
  for (const c of live) {
    shares[classifyHand(c.c1, c.c2, board).bucket] += c.w;
    total += c.w;
  }
  if (total > 0) for (const b of BUCKETS) shares[b] /= total;
  return { shares, combos: total };
}

export interface BeatenBy {
  label: string;
  hand: string;
  combos: number;
}

export interface ShowdownNow {
  beats: number;
  ties: number;
  loses: number;
  combos: number;
  /** Villain hands that are ahead of hero right now, biggest groups first. */
  beatenBy: BeatenBy[];
}

/** Hero's hand vs every villain combo on the current board (who is ahead right now). */
export function showdownVsRange(hero: readonly [number, number], range: Range, board: readonly number[], dead: readonly number[] = []): ShowdownNow {
  const live = liveCombos(range, new Set([...hero, ...board, ...dead]));
  const mine = evaluateIndices([...hero, ...board]);
  let beats = 0;
  let ties = 0;
  let loses = 0;
  const groups = new Map<string, BeatenBy>();
  for (const c of live) {
    const theirs = evaluateIndices([c.c1, c.c2, ...board]);
    if (theirs < mine) beats += c.w;
    else if (theirs === mine) ties += c.w;
    else {
      loses += c.w;
      const hand = CATEGORY_NAMES[(theirs >> 20) as HandCategory];
      const key = `${c.label}|${hand}`;
      const g = groups.get(key) ?? { label: c.label, hand, combos: 0 };
      g.combos += c.w;
      groups.set(key, g);
    }
  }
  const total = beats + ties + loses;
  const f = (x: number) => (total ? x / total : 0);
  return { beats: f(beats), ties: f(ties), loses: f(loses), combos: total, beatenBy: [...groups.values()].sort((a, b) => b.combos - a.combos) };
}

export interface BlockerEffect {
  /** Villain combos with only the board and dead cards removed. */
  before: number;
  /** ...and hero's cards removed too. */
  after: number;
  /** Hand classes that lost combos because of hero's cards. */
  removed: { label: string; before: number; after: number }[];
}

export function blockerEffect(hero: readonly number[], range: Range, board: readonly number[], dead: readonly number[] = []): BlockerEffect {
  const base = liveCombos(range, new Set([...board, ...dead]));
  const heroSet = new Set(hero);
  const byLabel = new Map<string, { label: string; before: number; after: number }>();
  let before = 0;
  let after = 0;
  for (const c of base) {
    const g = byLabel.get(c.label) ?? { label: c.label, before: 0, after: 0 };
    g.before += c.w;
    before += c.w;
    if (!heroSet.has(c.c1) && !heroSet.has(c.c2)) {
      g.after += c.w;
      after += c.w;
    }
    byLabel.set(c.label, g);
  }
  return { before, after, removed: [...byLabel.values()].filter((g) => g.after < g.before).sort((a, b) => b.before - b.after - (a.before - a.after)) };
}

/** Nut advantage: share of each range made of monsters (sets, two pair+, straights…) on this board. */
export function nutShare(range: Range, board: readonly number[], dead: readonly number[] = []): number {
  return bucketBreakdown(range, board, dead).shares.monster;
}

/** One plain-English line about range and nut advantage between two players. */
export function advantageLine(names: [string, string], equityA: number, nutA: number, nutB: number): string {
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const [a, b] = names;
  const leader = equityA >= 0.5 ? a : b;
  const range = Math.abs(equityA - 0.5) < 0.03 ? `The ranges are close (${pct(equityA)} vs ${pct(1 - equityA)})` : `${leader} has the range advantage (${pct(Math.max(equityA, 1 - equityA))} equity)`;
  const nutLeader = nutA > nutB ? a : b;
  const nut = Math.abs(nutA - nutB) < 0.02 ? 'neither has many more nutted hands' : `${nutLeader} has more of the nuts (${pct(Math.max(nutA, nutB))} vs ${pct(Math.min(nutA, nutB))} monsters)`;
  const hint =
    nutA - nutB >= 0.02 ? `, so ${a} can bet big` : nutB - nutA >= 0.02 ? `, so ${b} can bet big` : equityA >= 0.53 ? `, so ${a} can bet small and often` : equityA <= 0.47 ? `, so ${b} can bet small and often` : '';
  return `${range}, and ${nut}${hint}.`;
}

// ---------------------------------------------------------------------------
// Full analysis (worker)

export interface LabResult {
  equity: EquityResult;
  /** Per player, when the board has 3+ cards. */
  buckets: BucketBreakdown[] | null;
  /** Player 1 (a hand) vs player 2 (a range), when the board has 3+ cards. */
  showdown: ShowdownNow | null;
  blockers: BlockerEffect | null;
  /** Players 1 and 2 as ranges, board 3+ cards. */
  advantage: { equityA: number; nutA: number; nutB: number; line: string } | null;
}

export interface LabOptions {
  iterations?: number;
  seed?: number;
}

export function runLab(s: LabScenario, opts: LabOptions = {}): LabResult {
  validateScenario(s);
  const board = idx(s.board);
  const dead = idx(s.dead);
  const specs = s.players.map((p) => (p.kind === 'hand' ? compact(p.text) : p.text));
  const equity = calculateEquity(specs, { board: s.board.join(''), dead: s.dead.join(''), iterations: opts.iterations ?? 60_000, seed: opts.seed ?? 7 });
  if (board.length < 3) return { equity, buckets: null, showdown: null, blockers: null, advantage: null };
  const ranges = s.players.map(playerRange);
  // Each range is read without the other players' known cards (hands) so cards can't be shared.
  const handCards = s.players.flatMap((p) => (p.kind === 'hand' ? idx(compact(p.text).match(/../g)!) : []));
  const buckets = ranges.map((r, i) => bucketBreakdown(r, board, [...dead, ...(s.players[i]!.kind === 'range' ? handCards : [])]));
  const [p0, p1] = s.players as [LabPlayer, LabPlayer];
  let showdown: ShowdownNow | null = null;
  let blockers: BlockerEffect | null = null;
  if (p0.kind === 'hand' && p1.kind === 'range') {
    const hero = idx(compact(p0.text).match(/../g)!) as [number, number];
    showdown = showdownVsRange(hero, ranges[1]!, board, dead);
    blockers = blockerEffect(hero, ranges[1]!, board, dead);
  }
  let advantage: LabResult['advantage'] = null;
  if (p0.kind === 'range' && p1.kind === 'range') {
    const equityA = s.players.length === 2 ? equity.players[0]!.equity : calculateEquity([specs[0]!, specs[1]!], { board: s.board.join(''), dead: s.dead.join(''), iterations: 40_000, seed: 7 }).players[0]!.equity;
    const nutA = buckets[0]!.shares.monster;
    const nutB = buckets[1]!.shares.monster;
    advantage = { equityA, nutA, nutB, line: advantageLine(['Player 1', 'Player 2'], equityA, nutA, nutB) };
  }
  return { equity, buckets, showdown, blockers, advantage };
}

export interface NextCard {
  card: string;
  /** Player 1's equity after this card, or null if the card is not available. */
  equity: number | null;
  change: string;
}

export interface NextCardGrid {
  /** 52 entries in card-index order. */
  cards: NextCard[];
  best: NextCard[];
  worst: NextCard[];
  /** Player 1's equity on the current board, for comparison. */
  now: number;
}

/** Player 1's equity after each possible next card (board must have 3 or 4 cards). */
export function nextCardGrid(s: LabScenario, opts: LabOptions = {}): NextCardGrid {
  validateScenario(s);
  if (s.board.length !== 3 && s.board.length !== 4) throw new LabError('The next-card explorer needs a flop or a turn.');
  const board = idx(s.board);
  const blocked = new Set([...board, ...idx(s.dead), ...s.players.flatMap((p) => (p.kind === 'hand' ? idx(compact(p.text).match(/../g)!) : []))]);
  const specs = s.players.map((p) => (p.kind === 'hand' ? compact(p.text) : p.text));
  const run = (b: string) => calculateEquity(specs, { board: b, dead: s.dead.join(''), iterations: opts.iterations ?? 6000, seed: opts.seed ?? 7 }).players[0]!.equity;
  const now = run(s.board.join(''));
  const cards: NextCard[] = [];
  for (let c = 0; c < 52; c++) {
    const card = indexToString(c);
    if (blocked.has(c)) {
      cards.push({ card, equity: null, change: '' });
      continue;
    }
    let equity: number | null;
    try {
      equity = run(s.board.join('') + card);
    } catch {
      equity = null; // e.g. a range with no combos left after this card
    }
    cards.push({ card, equity, change: describeCardChanges(board, c) });
  }
  const live = cards.filter((c) => c.equity !== null).sort((a, b) => b.equity! - a.equity!);
  return { cards, best: live.slice(0, 3), worst: live.slice(-3).reverse(), now };
}

// ---------------------------------------------------------------------------
// Guess mode

/** Within this of the real equity = Best; within EQUITY_GUESS_OK = Acceptable. */
export const EQUITY_GUESS_BEST = 0.05;
export const EQUITY_GUESS_OK = 0.1;

export function gradeEquityGuess(guess: number, actual: number): { grade: Grade; error: number } {
  const error = Math.abs(guess - actual);
  return { grade: error <= EQUITY_GUESS_BEST ? 'best' : error <= EQUITY_GUESS_OK ? 'acceptable' : 'mistake', error };
}

// ---------------------------------------------------------------------------
// Range sources

export interface RangeOption {
  id: string;
  label: string;
  range: Range;
}

/** Every range a chart can supply, e.g. "BTN open", "BB call vs CO", "CO iso vs 1 limper". */
export function chartRangeOptions(chart: Chart): RangeOption[] {
  const out: RangeOption[] = [];
  const add = (id: string, label: string, r: Range | undefined) => {
    if (r && r.weights.some((w) => w > 0)) out.push({ id: `${chart.id}:${id}`, label, range: r });
  };
  for (const s of chart.openingSeats) add(`rfi.${s}`, `${s} open`, chart.rfi(s)?.ranges.raise);
  for (const { seat, opener } of chart.facingOpenPairs()) {
    const a = chart.vsOpen(seat, opener);
    add(`vsOpen.${seat}.${opener}.call`, `${seat} call vs ${opener} open`, a?.ranges.call);
    add(`vsOpen.${seat}.${opener}.3bet`, `${seat} 3-bet vs ${opener} open`, a?.ranges['3bet']);
  }
  for (const s of chart.facing3betSeats()) {
    const a = chart.vs3bet(s);
    add(`vs3bet.${s}.call`, `${s} call vs a 3-bet`, a?.ranges.call);
    add(`vs3bet.${s}.4bet`, `${s} 4-bet`, a?.ranges['4bet']);
  }
  for (const { seat, limpers } of chart.limperSpots()) add(`iso.${seat}.${limpers}`, `${seat} iso-raise vs ${limpers === 3 ? '3+' : limpers} limper${limpers > 1 ? 's' : ''}`, chart.vsLimpers(seat, limpers)?.ranges.raise);
  for (const { seat, callers } of chart.squeezeSpots()) add(`sq.${seat}.${callers}`, `${seat} squeeze vs open + ${callers === 2 ? '2+' : 1} caller${callers > 1 ? 's' : ''}`, chart.squeeze(seat, callers)?.ranges['3bet']);
  return out;
}
