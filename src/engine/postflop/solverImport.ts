/**
 * POSTFLOP SOLVER IMPORT. A simple, documented format for flop strategies exported from a solver.
 * When a drill or reviewed flop spot matches an imported entry, it is graded from the frequencies
 * instead of the model: the most frequent action is Best, any action played at least
 * SOLVER_ACCEPTABLE_FREQ of the time is Acceptable, the rest are Mistakes.
 *
 * A spot = pot type + positions + stack depth + flop (+ the player to act, and the bet faced, if any).
 * Suit-isomorphic flops are the same spot (As7h2c = Ad7s2h), so one entry covers all of them.
 *
 * JSON:
 *   { "format": "felt-postflop-v1", "name": "My BTN vs BB sims",
 *     "spots": [ { "pot": "srp", "positions": "BB-BTN", "stack": 100, "flop": "As7h2c",
 *                  "actor": "BTN", "facing": null,
 *                  "strategy": { "AA": { "check": 0.25, "bet33": 0.75 }, "AhKd": { "bet75": 1 } } } ] }
 * CSV (header required; one row per hand and action; frequency 0..1 or 0..100 / "40%"):
 *   pot,positions,stack,flop,actor,facing,hand,action,frequency
 *   srp,BB-BTN,100,As7h2c,BTN,,AA,bet33,0.75
 *
 * Fields: pot = srp | 3bet | limped. positions = "OOP-IP" (first to act postflop, then the other).
 * actor = whose strategy this is (one of the two). facing = the bet the actor faces as % of the pot
 * (empty / null / none when first to act or checked to). hand = a class ("AKs", "QQ", "T9o") or an
 * exact combo ("AhKd"; exact combos win over classes). Actions: check, fold, call, betNN (NN = % of pot,
 * e.g. bet33, bet75, bet150), raise / raiseNNx (NN = raise-to as a multiple of the bet, e.g. raise3x).
 */
import { cardIndex, indexToString, parseCardIndices, parseCards } from '../cards';
import { HAND_GRID } from '../hands';
import { COMBOS } from '../range';
import type { Grade } from '../grading';
import type { Spot } from './scenario';
import type { SpotAnalysis } from '../strategy/analyze';

export const POSTFLOP_FORMAT = 'felt-postflop-v1';
/** An action played at least this often by the solver is Acceptable. */
export const SOLVER_ACCEPTABLE_FREQ = 0.2;
/** When the top action is played at least this often, the spot is "clear"; otherwise "close". */
export const SOLVER_CLEAR_FREQ = 0.8;
/** A faced bet matches an entry when the pot fractions differ by at most this. */
export const FACING_MATCH_TOLERANCE = 0.1;

export type SolverPot = 'srp' | '3bet' | 'limped';
const POTS: readonly SolverPot[] = ['srp', '3bet', 'limped'];

/** Normalised action: check | fold | call | bet:0.33 | raise:3 (raise:0 = any size). */
export type SolverAction = string;

export interface PostflopSolverEntry {
  pot: SolverPot;
  /** "OOP-IP", e.g. "BB-BTN". */
  positions: string;
  stack: number;
  /** Canonical flop key (see canonicalFlop). */
  flop: string;
  actor: string;
  /** Bet faced as a pot fraction, or null. */
  facing: number | null;
  /** Canonical hand key → action → frequency. */
  strategy: Record<string, Record<SolverAction, number>>;
}

export interface PostflopImportResult {
  name: string;
  entries: PostflopSolverEntry[];
  rows: number;
  warnings: string[];
  errors: string[];
}

// ---------------------------------------------------------------------------
// Suit isomorphism

const PERMS: number[][] = (() => {
  const out: number[][] = [];
  const go = (cur: number[]) => {
    if (cur.length === 4) out.push(cur);
    else for (let s = 0; s < 4; s++) if (!cur.includes(s)) go([...cur, s]);
  };
  go([]);
  return out;
})();

const applyPerm = (card: number, p: readonly number[]) => (card & ~3) | p[card & 3]!;
const sortedDesc = (cards: number[]) => [...cards].sort((a, b) => b - a);
const lexLess = (a: number[], b: number[]) => {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i]! < b[i]!;
  return false;
};

/** Canonical form of a flop under suit relabelling, and every relabelling that produces it. */
export function canonicalFlop(cards: readonly number[]): { key: string; perms: number[][] } {
  let best: number[] | null = null;
  let perms: number[][] = [];
  for (const p of PERMS) {
    const mapped = sortedDesc(cards.map((c) => applyPerm(c, p)));
    if (!best || lexLess(mapped, best)) {
      best = mapped;
      perms = [p];
    } else if (mapped.every((c, i) => c === best![i])) perms.push(p);
  }
  return { key: best!.map(indexToString).join(''), perms };
}

const CLASS_LABELS = new Set(HAND_GRID.flat().map((h) => h.label));

/** Canonical key for a hand on this flop: classes stay as they are, exact combos are relabelled. */
export function canonicalHand(hand: string, perms: number[][]): string | null {
  const h = hand.trim();
  if (CLASS_LABELS.has(h)) return h;
  const norm = h.length === 4 ? `${h[0]!.toUpperCase()}${h[1]!.toLowerCase()}${h[2]!.toUpperCase()}${h[3]!.toLowerCase()}` : h;
  if (!/^([2-9TJQKA][shdc]){2}$/.test(norm)) return null;
  const cards = parseCardIndices(norm);
  if (cards[0] === cards[1]) return null;
  let best: string | null = null;
  for (const p of perms) {
    const k = sortedDesc(cards.map((c) => applyPerm(c, p))).map(indexToString).join('');
    if (best === null || k < best) best = k;
  }
  return best;
}

// ---------------------------------------------------------------------------
// Parsing

export function parseSolverAction(text: string): SolverAction | null {
  const t = text.trim().toLowerCase().replace(/[\s_%-]/g, '');
  if (t === 'check' || t === 'x' || t === 'k') return 'check';
  if (t === 'fold' || t === 'f') return 'fold';
  if (t === 'call' || t === 'c') return 'call';
  let m = /^(?:bet|b)(\d+(?:\.\d+)?)$/.exec(t);
  if (m) {
    const n = Number(m[1]);
    const frac = n > 5 ? n / 100 : n; // "bet33" = 33% of pot; "bet0.33" also accepted
    return frac > 0 ? `bet:${Math.round(frac * 100) / 100}` : null;
  }
  if (t === 'raise' || t === 'r') return 'raise:0';
  m = /^(?:raise|r)(\d+(?:\.\d+)?)x?$/.exec(t);
  if (m) return `raise:${Number(m[1])}`;
  if (t === 'allin' || t === 'jam' || t === 'shove') return 'raise:99';
  return null;
}

function parseFreq(v: unknown): number | null {
  if (typeof v === 'number') return v > 1 ? v / 100 : v;
  if (typeof v !== 'string') return null;
  const t = v.trim();
  const n = Number(t.replace('%', ''));
  if (!Number.isFinite(n) || t === '') return null;
  return t.endsWith('%') || n > 1 ? n / 100 : n;
}

function parseFacing(v: unknown): number | null | undefined {
  if (v === null || v === undefined || v === '' || (typeof v === 'string' && /^(none|null|-|first|checked)$/i.test(v.trim()))) return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/%|bet/gi, '').trim());
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return n > 5 ? n / 100 : n;
}

interface RawSpot {
  pot: unknown;
  positions: unknown;
  stack: unknown;
  flop: unknown;
  actor: unknown;
  facing?: unknown;
  strategy: Record<string, Record<string, unknown>>;
}

function buildEntry(raw: RawSpot, where: string, errors: string[], warnings: string[]): PostflopSolverEntry | null {
  const pot = String(raw.pot ?? '').trim().toLowerCase().replace('3bp', '3bet') as SolverPot;
  if (!POTS.includes(pot)) {
    errors.push(`${where}: pot must be ${POTS.join(', ')} (got “${String(raw.pot)}”).`);
    return null;
  }
  const positions = String(raw.positions ?? '').trim().toUpperCase();
  const seats = positions.split(/[-/ ]|vs/i).filter(Boolean);
  if (seats.length !== 2) {
    errors.push(`${where}: positions must be "OOP-IP", e.g. "BB-BTN" (got “${String(raw.positions)}”).`);
    return null;
  }
  const actor = String(raw.actor ?? '').trim().toUpperCase();
  if (!seats.includes(actor)) {
    errors.push(`${where}: actor “${String(raw.actor)}” must be one of ${seats.join(' / ')}.`);
    return null;
  }
  const stack = Number(raw.stack);
  if (!Number.isFinite(stack) || stack <= 0) {
    errors.push(`${where}: stack must be a number of big blinds (got “${String(raw.stack)}”).`);
    return null;
  }
  let flopCards: number[];
  try {
    flopCards = parseCards(String(raw.flop ?? '')).map(cardIndex);
  } catch (e) {
    errors.push(`${where}: flop: ${(e as Error).message}`);
    return null;
  }
  if (flopCards.length !== 3 || new Set(flopCards).size !== 3) {
    errors.push(`${where}: flop must be 3 different cards, e.g. "As7h2c".`);
    return null;
  }
  const facing = parseFacing(raw.facing);
  if (facing === undefined) {
    errors.push(`${where}: facing must be empty or a bet size in % of pot (got “${String(raw.facing)}”).`);
    return null;
  }
  const { key, perms } = canonicalFlop(flopCards);
  const strategy: PostflopSolverEntry['strategy'] = {};
  for (const [hand, acts] of Object.entries(raw.strategy ?? {})) {
    const hk = canonicalHand(hand, perms);
    if (!hk) {
      errors.push(`${where}: “${hand}” isn’t a hand class (AKs, QQ) or a combo (AhKd).`);
      continue;
    }
    if (hk.length === 4 && parseCardIndices(hk).some((c) => canonicalFlopHas(key, c))) {
      errors.push(`${where}: ${hand} uses a card on the flop.`);
      continue;
    }
    const out: Record<SolverAction, number> = {};
    for (const [a, f] of Object.entries(acts)) {
      const act = parseSolverAction(a);
      const freq = parseFreq(f);
      if (!act) {
        errors.push(`${where}: unknown action “${a}” for ${hand} (use check, fold, call, bet33, raise3x…).`);
        continue;
      }
      if (freq === null || freq < 0 || freq > 1) {
        errors.push(`${where}: frequency “${String(f)}” for ${hand} ${a} must be 0–1 or 0–100%.`);
        continue;
      }
      out[act] = (out[act] ?? 0) + freq;
    }
    const sum = Object.values(out).reduce((x, y) => x + y, 0);
    if (sum > 1.01) {
      warnings.push(`${where}: ${hand} frequencies add up to ${Math.round(sum * 100)}%; scaled to 100%.`);
      for (const k of Object.keys(out)) out[k] = out[k]! / sum;
    }
    if (Object.keys(out).length) strategy[hk] = { ...(strategy[hk] ?? {}), ...out };
  }
  if (!Object.keys(strategy).length) {
    errors.push(`${where}: no usable hands.`);
    return null;
  }
  return { pot, positions: seats.join('-'), stack, flop: key, actor, facing, strategy };
}

const canonicalFlopHas = (key: string, card: number) => parseCardIndices(key).includes(card);

function splitCsvLine(line: string): string[] {
  return line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
}

/** Parse a JSON or CSV postflop export. `allowExample` is only for tests of the FORMAT EXAMPLE file. */
export function importPostflopSolver(text: string, opts: { name?: string; allowExample?: boolean } = {}): PostflopImportResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const raws: { raw: RawSpot; where: string }[] = [];
  let name = opts.name ?? 'Postflop import';
  let rows = 0;
  const trimmed = text.trim();
  if (!trimmed) return { name, entries: [], rows: 0, warnings, errors: ['The file is empty.'] };

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    let data: unknown;
    try {
      data = JSON.parse(trimmed);
    } catch (e) {
      return { name, entries: [], rows: 0, warnings, errors: [`Not valid JSON: ${(e as Error).message}`] };
    }
    const obj = (Array.isArray(data) ? { spots: data } : data) as { format?: string; name?: string; example?: boolean; spots?: unknown };
    if (obj.example === true && !opts.allowExample) {
      return { name, entries: [], rows: 0, warnings, errors: ['This is the hand-made FORMAT EXAMPLE file, not solver output, so it can’t be imported. Export your own spots in this format.'] };
    }
    if (obj.format && obj.format !== POSTFLOP_FORMAT) warnings.push(`Format “${obj.format}” isn’t ${POSTFLOP_FORMAT}; reading it anyway.`);
    if (obj.name) name = String(obj.name);
    if (!Array.isArray(obj.spots)) return { name, entries: [], rows: 0, warnings, errors: ['Expected a "spots" array.'] };
    obj.spots.forEach((s, i) => {
      rows += Object.keys((s as RawSpot)?.strategy ?? {}).length;
      raws.push({ raw: s as RawSpot, where: `Spot ${i + 1}` });
    });
  } else {
    const lines = trimmed.split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith('#'));
    const header = splitCsvLine(lines[0]!.toLowerCase());
    const need = ['pot', 'positions', 'stack', 'flop', 'actor', 'hand', 'action', 'frequency'];
    const missing = need.filter((h) => !header.includes(h));
    if (missing.length) return { name, entries: [], rows: 0, warnings, errors: [`CSV header is missing: ${missing.join(', ')}. Expected: pot,positions,stack,flop,actor,facing,hand,action,frequency`] };
    const col = (cells: string[], h: string) => cells[header.indexOf(h)] ?? '';
    const groups = new Map<string, { raw: RawSpot; where: string }>();
    lines.slice(1).forEach((line, i) => {
      const cells = splitCsvLine(line);
      rows++;
      const gk = ['pot', 'positions', 'stack', 'flop', 'actor', 'facing'].map((h) => col(cells, h)).join('|');
      const g = groups.get(gk) ?? {
        raw: { pot: col(cells, 'pot'), positions: col(cells, 'positions'), stack: col(cells, 'stack'), flop: col(cells, 'flop'), actor: col(cells, 'actor'), facing: col(cells, 'facing'), strategy: {} },
        where: `Line ${i + 2}`,
      };
      const hand = col(cells, 'hand');
      (g.raw.strategy[hand] ??= {})[col(cells, 'action')] = col(cells, 'frequency');
      groups.set(gk, g);
    });
    raws.push(...groups.values());
  }

  const entries: PostflopSolverEntry[] = [];
  for (const { raw, where } of raws) {
    const e = buildEntry(raw, where, errors, warnings);
    if (e) entries.push(e);
  }
  return { name, entries, rows, warnings, errors };
}

// ---------------------------------------------------------------------------
// Lookup and grading

export type PostflopSolverDb = Map<string, PostflopSolverEntry[]>;

const dbKey = (pot: string, positions: string, stack: number, flop: string, actor: string) => `${pot}|${positions}|${stack}|${flop}|${actor}`;

/** Index entries for lookup (later entries win for the same spot and hand). */
export function buildPostflopDb(entries: readonly PostflopSolverEntry[]): PostflopSolverDb {
  const db: PostflopSolverDb = new Map();
  for (const e of entries) {
    const k = dbKey(e.pot, e.positions, e.stack, e.flop, e.actor);
    const list = db.get(k) ?? [];
    const same = list.find((x) => (x.facing === null) === (e.facing === null) && (x.facing === null || Math.abs(x.facing - e.facing!) < 1e-6));
    if (same) same.strategy = { ...same.strategy, ...e.strategy };
    else list.push({ ...e, strategy: { ...e.strategy } });
    db.set(k, list);
  }
  return db;
}

export interface SolverMatch {
  entry: PostflopSolverEntry;
  /** Action → frequency for hero's hand. */
  freqs: Record<SolverAction, number>;
  handKey: string;
}

/** Find imported frequencies for a flop spot (heads-up, not facing a raise), or null. */
export function lookupSolverSpot(db: PostflopSolverDb | undefined, spot: Spot): SolverMatch | null {
  if (!db || !db.size || spot.board.length !== 3 || spot.villains.length !== 1 || spot.facingRaise) return null;
  if (spot.potType !== 'srp' && spot.potType !== '3bet' && spot.potType !== 'limped') return null;
  const villain = spot.villains[0]!.seat;
  const positions = spot.heroIP ? `${villain}-${spot.heroSeat}` : `${spot.heroSeat}-${villain}`;
  const { key, perms } = canonicalFlop(spot.board);
  const list = db.get(dbKey(spot.potType, positions, spot.stackBb, key, spot.heroSeat));
  if (!list) return null;
  const facing = spot.facingBet === null ? null : spot.facingBet / spot.pot;
  const entry = list.find((e) => (facing === null ? e.facing === null : e.facing !== null && Math.abs(e.facing - facing) <= FACING_MATCH_TOLERANCE));
  if (!entry) return null;
  const combo = sortedDesc([...spot.hero]).map(indexToString).join('');
  const exact = canonicalHand(combo, perms);
  const label = COMBOS.find((c) => c.c1 === Math.max(...spot.hero) && c.c2 === Math.min(...spot.hero))!.label;
  const handKey = exact && entry.strategy[exact] ? exact : entry.strategy[label] ? label : null;
  if (!handKey) return null;
  return { entry, freqs: entry.strategy[handKey]!, handKey };
}

export interface GradableOption {
  action: 'check' | 'bet' | 'fold' | 'call' | 'raise';
  fraction: number | null;
  /** Raise-to as a multiple of the bet faced (raises only). */
  raiseMultiple?: number;
}

/** Spread solver frequencies over the options offered (each solver action goes to the nearest option of its type). */
export function frequenciesForOptions(freqs: Record<SolverAction, number>, options: readonly GradableOption[]): number[] {
  const out = options.map(() => 0);
  for (const [act, f] of Object.entries(freqs)) {
    const [type, sizeText] = act.split(':') as [string, string | undefined];
    const size = Number(sizeText ?? 0);
    let bestI = -1;
    let bestD = Infinity;
    options.forEach((o, i) => {
      if (o.action !== type) return;
      const d = type === 'bet' ? Math.abs((o.fraction ?? 0) - size) : type === 'raise' && size ? Math.abs((o.raiseMultiple ?? size) - size) : 0;
      if (d < bestD) {
        bestD = d;
        bestI = i;
      }
    });
    if (bestI >= 0) out[bestI] = out[bestI]! + f;
  }
  return out;
}

/** Best = most frequent; Acceptable = played ≥ SOLVER_ACCEPTABLE_FREQ; else Mistake. */
export function gradeFromFrequencies(freqs: readonly number[]): Grade[] {
  const top = Math.max(...freqs);
  const topI = freqs.indexOf(top);
  return freqs.map((f, i) => (i === topI ? 'best' : f >= SOLVER_ACCEPTABLE_FREQ ? 'acceptable' : 'mistake'));
}

export const solverConfidence = (freqs: readonly number[]): 'clear' | 'close' => (Math.max(...freqs) >= SOLVER_CLEAR_FREQ ? 'clear' : 'close');

export function describeSolverAction(a: SolverAction): string {
  const [t, s] = a.split(':');
  if (t === 'bet') return `bet ${Math.round(Number(s) * 100)}%`;
  if (t === 'raise') return Number(s) === 99 ? 'all-in' : Number(s) ? `raise ${s}x` : 'raise';
  return t!;
}


/**
 * If this spot matches imported solver data, re-grade the analysis from the frequencies (in place):
 * grades, confidence (clear when the top action is ≥ SOLVER_CLEAR_FREQ), source "solver", and a
 * frequency line at the top of the explanation. Returns true when it applied.
 */
export function applySolverGrades(a: SpotAnalysis, spot: Spot, db: PostflopSolverDb | undefined): boolean {
  const m = lookupSolverSpot(db, spot);
  if (!m) return false;
  const opts: GradableOption[] = a.options.map((o) => ({
    action: o.action,
    fraction: o.fraction,
    raiseMultiple: o.action === 'raise' && spot.facingBet ? o.amount / spot.facingBet : undefined,
  }));
  const freqs = frequenciesForOptions(m.freqs, opts);
  if (freqs.every((f) => f === 0)) return false;
  const grades = gradeFromFrequencies(freqs);
  a.options.forEach((o, i) => (o.grade = grades[i]!));
  a.best = a.options[grades.indexOf('best')]!;
  a.confidence = solverConfidence(freqs);
  a.source = 'solver';
  const mix = Object.entries(m.freqs)
    .sort((x, y) => y[1] - x[1])
    .map(([act, f]) => `${describeSolverAction(act)} ${Math.round(f * 100)}%`)
    .join(', ');
  a.confidenceNote = `Imported solver strategy for ${m.handKey}: ${mix}. Most frequent = Best; ≥ ${Math.round(SOLVER_ACCEPTABLE_FREQ * 100)}% = Acceptable.`;
  a.summary = `${a.best.label} is what the imported solver strategy plays most (${mix}).`;
  a.steps = [a.confidenceNote, ...a.steps.map((s) => s.replace(/^EVs are one-street/, 'Model EVs (for reference) are one-street'))];
  return true;
}
