/**
 * Preflop chart model. Charts are plain JSON (src/data/ranges) using the engine's range notation;
 * this module resolves inheritance, seat aliases and user overrides, and answers
 * "what does the chart do with this hand here?".
 */
import { HAND_GRID } from '../hands';
import { parseRange, rangeFraction, countCombos, classComboIndices, type Range } from '../range';

export interface FacingOpenJson {
  '3bet': string;
  call: string;
}
export interface Facing3betJson {
  '4bet': string;
  call: string;
}

/** Actions vs limpers: iso-raise (`raise`) or overlimp (`limp`; completing from the SB). */
export interface VsLimpersJson {
  raise: string;
  limp: string;
}
export interface SqueezeJson {
  '3bet': string;
  call: string;
}
export interface Facing4betJson {
  '5bet': string;
  call: string;
}

export interface ChartJson {
  id: string;
  name: string;
  description: string;
  stackBb: number;
  seats: string[];
  openSizeBb: Record<string, number> & { default: number };
  rfi: Record<string, string>;
  vsOpen?: Record<string, Record<string, FacingOpenJson>>;
  vs3bet?: Record<string, Facing3betJson>;
  /** Take vsOpen / vs3bet from another chart when missing here. */
  inherit?: string;
  /** Seat -> key used for vsOpen / vs3bet lookups (e.g. MP -> UTG, or HJ -> LP). */
  seatAlias?: Record<string, string>;
  /**
   * Seat -> group used by the home-game spots below (EP, MP, CO, BTN, SB, BB). Seats not listed use
   * their own name. Inherited charts keep their own `groups` so 9-handed seats map onto 6-max data.
   */
  groups?: Record<string, string>;
  /** Hero acts after limpers (no raise yet). Keyed by group, then limper count "1", "2" or "3" (3 = 3+). */
  vsLimpers?: Record<string, Record<string, VsLimpersJson>>;
  /** An open plus callers before hero. Keyed by group, then callers "1" or "2" (2 = 2+). */
  squeeze?: Record<string, Record<string, SqueezeJson>>;
  /** Hero limped (or overlimped) and someone raised behind. Keyed by group. */
  vsLimpRaise?: Record<string, SqueezeJson>;
  /** Hero 3-bet and faces a 4-bet. Keyed by group. */
  vs4bet?: Record<string, Facing4betJson>;
  /** Plain-English notes explaining the assumptions behind each section (JSON has no comments). */
  notes?: Record<string, string>;
}

export type SpotKind = 'rfi' | 'vsOpen' | 'vs3bet' | 'vsLimpers' | 'squeeze' | 'vsLimpRaise' | 'vs4bet';
export type PreflopAction = 'raise' | 'limp' | 'fold' | 'call' | '3bet' | '4bet' | '5bet' | 'check';

/** Limper counts are bucketed 1, 2, 3+ and squeeze callers 1, 2+. */
export const limperKey = (n: number) => String(Math.min(3, Math.max(1, Math.floor(n))));
export const callerKey = (n: number) => String(Math.min(2, Math.max(1, Math.floor(n))));

export interface PreflopSpot {
  kind: SpotKind;
  /** Hero's seat. */
  seat: string;
  /** The opener (vsOpen) or the 3-bettor's side is implied (vs3bet). */
  opener?: string;
  /** Limpers before hero (vsLimpers). */
  limpers?: number;
  /** Callers of the open before hero (squeeze). */
  callers?: number;
}

export interface ActionRanges {
  /** Action -> range (weights are frequencies). Fold is whatever is left. */
  ranges: Partial<Record<PreflopAction, Range>>;
  /** Notation source for each action, for display and editing. */
  notation: Partial<Record<PreflopAction, string>>;
  /** Path used for overrides, e.g. "rfi.UTG" or "vsOpen.BB.UTG". */
  path: string;
  /** What hands outside every range do: fold (default), or check (big blind vs limpers). */
  rest?: PreflopAction;
}

const parseCache = new Map<string, Range>();
function cachedRange(text: string): Range {
  let r = parseCache.get(text);
  if (!r) {
    r = parseRange(text);
    parseCache.set(text, r);
  }
  return r;
}

/** Overrides are keyed by path + action, e.g. "rfi.UTG.raise", "vsOpen.BB.UTG.call". */
export type ChartOverrides = Record<string, string>;

export class Chart {
  readonly json: ChartJson;
  constructor(
    json: ChartJson,
    private readonly library: Record<string, ChartJson>,
    private readonly overrides: ChartOverrides = {},
    /** Override keys that came from a solver import (not hand edits). */
    private readonly imported: ReadonlySet<string> = new Set(),
  ) {
    this.json = json;
  }

  /** Where a spot's ranges come from: an imported solver strategy, or the built-in / edited chart. */
  sourceOf(path: string): 'solver' | 'chart' {
    for (const k of this.imported) if (k.startsWith(`${path}.`) && this.overrides[k] !== undefined) return 'solver';
    return 'chart';
  }

  get id() {
    return this.json.id;
  }
  get name() {
    return this.json.name;
  }
  get seats() {
    return this.json.seats;
  }
  /** Seats that can open (everyone but the big blind). */
  get openingSeats() {
    return this.json.seats.filter((s) => s !== 'BB');
  }

  alias(seat: string): string {
    return this.json.seatAlias?.[seat] ?? seat;
  }

  openSize(seat: string): number {
    return this.json.openSizeBb[seat] ?? this.json.openSizeBb.default;
  }

  /** Seats after `seat` in preflop order (who still has to act). */
  seatsBehind(seat: string): string[] {
    const i = this.json.seats.indexOf(seat);
    return i < 0 ? [] : this.json.seats.slice(i + 1);
  }

  private vsOpenJson() {
    return this.json.vsOpen ?? (this.json.inherit ? this.library[this.json.inherit]?.vsOpen : undefined);
  }
  private vs3betJson() {
    return this.json.vs3bet ?? (this.json.inherit ? this.library[this.json.inherit]?.vs3bet : undefined);
  }

  /** A chart section, from this chart or the one it inherits from. */
  private section<K extends 'vsLimpers' | 'squeeze' | 'vsLimpRaise' | 'vs4bet'>(key: K): ChartJson[K] {
    return this.json[key] ?? (this.json.inherit ? this.library[this.json.inherit]?.[key] : undefined);
  }

  /** Seat group for the home-game spots (EP, MP, CO, BTN, SB, BB). */
  group(seat: string): string {
    return this.json.groups?.[seat] ?? seat;
  }

  /** Players who act before `seat` preflop (limpers or openers/callers can only come from them). */
  seatsBefore(seat: string): number {
    return Math.max(0, this.json.seats.indexOf(seat));
  }

  private build(path: string, pairs: [PreflopAction, string][], rest?: PreflopAction): ActionRanges {
    const ranges: ActionRanges['ranges'] = {};
    const notation: ActionRanges['notation'] = {};
    for (const [action, fallback] of pairs) {
      const t = this.text(path, action, fallback);
      ranges[action] = cachedRange(t);
      notation[action] = t;
    }
    return rest ? { ranges, notation, path, rest } : { ranges, notation, path };
  }

  /** Hero in `seat` after `limpers` limpers (no raise). SB can complete; BB checks its option. */
  vsLimpers(seat: string, limpers: number): ActionRanges | null {
    if (limpers < 1 || this.seatsBefore(seat) < Math.min(limpers, 3)) return null;
    const g = this.group(seat);
    const n = limperKey(limpers);
    const j = this.section('vsLimpers')?.[g]?.[n];
    if (!j) return null;
    return this.build(`vsLimpers.${g}.${n}`, [['raise', j.raise], ['limp', j.limp]], seat === 'BB' ? 'check' : undefined);
  }

  /** An open and `callers` callers before hero in `seat`. */
  squeeze(seat: string, callers: number): ActionRanges | null {
    if (callers < 1 || this.seatsBefore(seat) < Math.min(callers, 2) + 1) return null;
    const g = this.group(seat);
    const n = callerKey(callers);
    const j = this.section('squeeze')?.[g]?.[n];
    if (!j) return null;
    return this.build(`squeeze.${g}.${n}`, [['3bet', j['3bet']], ['call', j.call]]);
  }

  /** Hero limped from `seat` and faces a raise. */
  vsLimpRaise(seat: string): ActionRanges | null {
    if (seat === 'BB' || this.seatsBefore(seat) < 1) return null;
    const g = this.group(seat);
    const j = this.section('vsLimpRaise')?.[g];
    if (!j) return null;
    return this.build(`vsLimpRaise.${g}`, [['3bet', j['3bet']], ['call', j.call]]);
  }

  /** Hero 3-bet from `seat` and faces a 4-bet. */
  vs4bet(seat: string): ActionRanges | null {
    if (this.seatsBefore(seat) < 1) return null;
    const g = this.group(seat);
    const j = this.section('vs4bet')?.[g];
    if (!j) return null;
    return this.build(`vs4bet.${g}`, [['5bet', j['5bet']], ['call', j.call]]);
  }

  /** Every (seat, limpers) pair with data. */
  limperSpots(): { seat: string; limpers: number }[] {
    const out: { seat: string; limpers: number }[] = [];
    for (const seat of this.json.seats) for (const n of [1, 2, 3]) if (this.vsLimpers(seat, n)) out.push({ seat, limpers: n });
    return out;
  }

  squeezeSpots(): { seat: string; callers: number }[] {
    const out: { seat: string; callers: number }[] = [];
    for (const seat of this.json.seats) for (const n of [1, 2]) if (this.squeeze(seat, n)) out.push({ seat, callers: n });
    return out;
  }

  limpRaiseSeats(): string[] {
    return this.json.seats.filter((s) => this.vsLimpRaise(s));
  }

  facing4betSeats(): string[] {
    return this.json.seats.filter((s) => this.vs4bet(s));
  }

  private text(path: string, action: string, fallback: string): string {
    return this.overrides[`${path}.${action}`] ?? fallback;
  }

  rfi(seat: string): ActionRanges | null {
    const src = this.json.rfi[seat];
    if (src === undefined) return null;
    const path = `rfi.${seat}`;
    const raise = this.text(path, 'raise', src);
    return { ranges: { raise: cachedRange(raise) }, notation: { raise }, path };
  }

  /** Hero in `seat` facing an open from `opener`. Null if the chart has no data or the order is impossible. */
  vsOpen(seat: string, opener: string): ActionRanges | null {
    const seats = this.json.seats;
    if (seats.indexOf(seat) <= seats.indexOf(opener)) return null;
    const d = this.alias(seat);
    const o = this.alias(opener);
    const j = this.vsOpenJson()?.[d]?.[o];
    if (!j) return null;
    const path = `vsOpen.${d}.${o}`;
    const threeBet = this.text(path, '3bet', j['3bet']);
    const call = this.text(path, 'call', j.call);
    return { ranges: { '3bet': cachedRange(threeBet), call: cachedRange(call) }, notation: { '3bet': threeBet, call }, path };
  }

  /** Hero opened from `seat` and faces a 3-bet. */
  vs3bet(seat: string): ActionRanges | null {
    const k = this.alias(seat);
    const j = this.vs3betJson()?.[k];
    if (!j) return null;
    const path = `vs3bet.${k}`;
    const fourBet = this.text(path, '4bet', j['4bet']);
    const call = this.text(path, 'call', j.call);
    return { ranges: { '4bet': cachedRange(fourBet), call: cachedRange(call) }, notation: { '4bet': fourBet, call }, path };
  }

  spot(s: PreflopSpot): ActionRanges | null {
    switch (s.kind) {
      case 'rfi':
        return this.rfi(s.seat);
      case 'vsOpen':
        return this.vsOpen(s.seat, s.opener ?? '');
      case 'vs3bet':
        return this.vs3bet(s.seat);
      case 'vsLimpers':
        return this.vsLimpers(s.seat, s.limpers ?? 1);
      case 'squeeze':
        return this.squeeze(s.seat, s.callers ?? 1);
      case 'vsLimpRaise':
        return this.vsLimpRaise(s.seat);
      case 'vs4bet':
        return this.vs4bet(s.seat);
    }
  }

  /** Every valid (defender, opener) pair this chart has data for. */
  facingOpenPairs(): { seat: string; opener: string }[] {
    const out: { seat: string; opener: string }[] = [];
    for (const seat of this.json.seats) for (const opener of this.openingSeats) if (this.vsOpen(seat, opener)) out.push({ seat, opener });
    return out;
  }

  facing3betSeats(): string[] {
    return this.openingSeats.filter((s) => this.vs3bet(s));
  }
}

export function buildCharts(
  library: Record<string, ChartJson>,
  overrides: Record<string, ChartOverrides> = {},
  /** Per chart: override keys set by solver imports (for source labels). */
  imported: Record<string, readonly string[]> = {},
): Record<string, Chart> {
  return Object.fromEntries(Object.values(library).map((j) => [j.id, new Chart(j, library, overrides[j.id] ?? {}, new Set(imported[j.id] ?? []))]));
}

export interface HandStrategy {
  /** Frequency per action (0..1), including 'fold'. */
  freq: Partial<Record<PreflopAction, number>>;
  /** The most frequent action. */
  main: PreflopAction;
}

/** Average frequency of each action for a hand class (e.g. "AJo"). */
export function strategyFor(spot: ActionRanges, label: string): HandStrategy {
  const idx = classComboIndices(label);
  const freq: Partial<Record<PreflopAction, number>> = {};
  let used = 0;
  for (const [action, range] of Object.entries(spot.ranges) as [PreflopAction, Range][]) {
    const f = idx.reduce((s, i) => s + range.weights[i]!, 0) / idx.length;
    freq[action] = f;
    used += f;
  }
  const rest = spot.rest ?? 'fold';
  freq[rest] = Math.max(0, 1 - used);
  let main: PreflopAction = rest;
  for (const [a, f] of Object.entries(freq) as [PreflopAction, number][]) if (f > (freq[main] ?? 0) + 1e-9) main = a;
  return { freq, main };
}

/** All 169 classes with their strategy, for drawing a strategy grid. */
export function strategyGrid(spot: ActionRanges): Record<string, HandStrategy> {
  return Object.fromEntries(HAND_GRID.flat().map((h) => [h.label, strategyFor(spot, h.label)]));
}

/** % of hands and combos an action range contains. */
export function actionStats(range: Range): { fraction: number; combos: number } {
  return { fraction: rangeFraction(range), combos: countCombos(range) };
}

/** Sum of action weights per combo must never exceed 1. Returns offending combos (for validation). */
export function overlappingCombos(spot: ActionRanges): number[] {
  const ranges = Object.values(spot.ranges) as Range[];
  const bad: number[] = [];
  for (let i = 0; i < 1326; i++) {
    let s = 0;
    for (const r of ranges) s += r.weights[i]!;
    if (s > 1 + 1e-9) bad.push(i);
  }
  return bad;
}
