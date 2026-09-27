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
}

export type SpotKind = 'rfi' | 'vsOpen' | 'vs3bet';
export type PreflopAction = 'raise' | 'limp' | 'fold' | 'call' | '3bet' | '4bet';

export interface Spot {
  kind: SpotKind;
  /** Hero's seat. */
  seat: string;
  /** The opener (vsOpen) or the 3-bettor's side is implied (vs3bet). */
  opener?: string;
}

export interface ActionRanges {
  /** Action -> range (weights are frequencies). Fold is whatever is left. */
  ranges: Partial<Record<PreflopAction, Range>>;
  /** Notation source for each action, for display and editing. */
  notation: Partial<Record<PreflopAction, string>>;
  /** Path used for overrides, e.g. "rfi.UTG" or "vsOpen.BB.UTG". */
  path: string;
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
  ) {
    this.json = json;
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

  spot(s: Spot): ActionRanges | null {
    if (s.kind === 'rfi') return this.rfi(s.seat);
    if (s.kind === 'vsOpen') return this.vsOpen(s.seat, s.opener ?? '');
    return this.vs3bet(s.seat);
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

export function buildCharts(library: Record<string, ChartJson>, overrides: Record<string, ChartOverrides> = {}): Record<string, Chart> {
  return Object.fromEntries(Object.values(library).map((j) => [j.id, new Chart(j, library, overrides[j.id] ?? {})]));
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
  freq.fold = Math.max(0, 1 - used);
  let main: PreflopAction = 'fold';
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
