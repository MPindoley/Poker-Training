/**
 * Hands logged from real games, with any number of players, and their analysis: each opponent's
 * likely range street by street, hero's equity against everyone still in, the price, and a verdict
 * with a plain-English summary.
 *
 * Shape history (saved data is migrated, never lost):
 *   v1: heroSeat + villainSeat (+ villainProfileId); actions by 'hero' | 'villain'.
 *   v2: players[] (hero flagged); actions by player id. v1 hands migrate with ids 'hero' and 'villain'.
 */
import { cardIndex, parseCard, parseCardIndices } from '../cards';
import { calculateEquity } from '../equity';
import type { Grade } from '../grading';
import { formatPercent } from '../math';
import { potOdds } from '../odds';
import type { Chart, PreflopAction } from '../preflop/charts';
import { strategyFor } from '../preflop/charts';
import { ACTION_NAMES } from '../preflop/reasons';
import { classifyPreflopDecision, type PreflopAct } from '../preflop/line';
import { isoSize } from '../preflop/sizing';
import { straddleView } from '../preflop/straddle';
import { topRange } from '../preflop/ranking';
import { statsPreflopRanges, type PlayerStats } from '../exploit/profiles';
import { COMBOS, parseRange, type Range } from '../range';
import { bettingRange, checkingRange, classifyRange, continuingRange, type Street } from '../postflop/narrow';
import type { PreflopLine } from '../postflop/replay';
import { BB_CHECK_RANGE, LIMP_RANGE, type Player, type Spot } from '../postflop/scenario';
import { analyzeSpot, signedBb, type SpotAnalysis } from '../strategy/analyze';
import { HERO_LINE_MODEL, forStreet, type VillainModel } from '../strategy/villainModel';
import { rangeVisual } from '../postflop/drills';
import type { StrategyVisual } from '../drills/types';
import { chartAction, type DecisionReview } from '../game/coach';

export type LogStreet = 'preflop' | Street;
export type LogActionType = 'fold' | 'check' | 'call' | 'bet' | 'raise';

export const HAND_LOG_VERSION = 2;
export const HERO_ID = 'hero';

export interface LoggedPlayer {
  id: string;
  seat: string;
  hero?: boolean;
  /** Saved Exploit Lab profile, if tagged. */
  profileId?: string;
  name?: string;
  /** Starting stack in big blinds (defaults to the hand's effective stack). */
  stackBb?: number;
  /** Cards this player showed (for the "what they actually had" view). */
  shownCards?: string[];
}

export interface LoggedAction {
  street: LogStreet;
  /** Player id (see players). */
  actor: string;
  type: LogActionType;
  /** For bet/raise: the street total ("raise to"), in big blinds. Null = "I don't remember". */
  amount: number | null;
}

export interface LoggedHand {
  version?: number;
  id: string;
  date: string;
  heroCards: string[];
  board: string[];
  players: LoggedPlayer[];
  /** Effective stack at the start, in big blinds (default for players without their own). */
  stackBb: number;
  /** Real-money big blind, for display ($ per bb). */
  bigBlind: number;
  /** UTG posted a live 2bb straddle. */
  straddle?: boolean;
  /** Limpers who limped before the logged action (not logged as players). */
  limpers?: number;
  actions: LoggedAction[];
  notes: string;
  /** Live-session bookmark this hand came from. */
  liveSessionId?: string;
}

/** The pre-v2 shape, kept for migration. */
export interface LoggedHandV1 {
  id: string;
  date: string;
  heroCards: string[];
  board: string[];
  heroSeat: string;
  villainSeat: string;
  villainProfileId?: string;
  stackBb: number;
  bigBlind: number;
  limpers?: number;
  actions: { street: LogStreet; actor: 'hero' | 'villain'; type: LogActionType; amount: number | null }[];
  notes: string;
}

/** Upgrade any saved hand (v1 or v2) to the current shape. */
export function migrateLoggedHand(raw: LoggedHand | LoggedHandV1): LoggedHand {
  if ('players' in raw && Array.isArray(raw.players)) return raw.version === HAND_LOG_VERSION ? raw : { ...raw, version: HAND_LOG_VERSION };
  const v1 = raw as LoggedHandV1;
  return {
    version: HAND_LOG_VERSION,
    id: v1.id,
    date: v1.date,
    heroCards: v1.heroCards,
    board: v1.board,
    players: [
      { id: HERO_ID, seat: v1.heroSeat, hero: true },
      { id: 'villain', seat: v1.villainSeat, ...(v1.villainProfileId ? { profileId: v1.villainProfileId } : {}) },
    ],
    stackBb: v1.stackBb,
    bigBlind: v1.bigBlind,
    ...(v1.limpers ? { limpers: v1.limpers } : {}),
    actions: v1.actions.map((a) => ({ ...a })),
    notes: v1.notes,
  };
}

export const heroOf = (h: LoggedHand): LoggedPlayer => h.players.find((p) => p.hero) ?? h.players[0]!;
export const opponentsOf = (h: LoggedHand): LoggedPlayer[] => h.players.filter((p) => p !== heroOf(h));
const playerById = (h: LoggedHand, id: string) => h.players.find((p) => p.id === id);
const stackOf = (h: LoggedHand, id: string) => playerById(h, id)?.stackBb ?? h.stackBb;

// ---------------------------------------------------------------------------
// Acting order, blinds, amounts and pots

export const PREFLOP_ORDER = ['UTG', 'UTG+1', 'MP', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'] as const;
export const POSTFLOP_ORDER = ['SB', 'BB', 'UTG', 'UTG+1', 'MP', 'LJ', 'HJ', 'CO', 'BTN'] as const;
/** Size of a straddle in big blinds. */
export const LOG_STRADDLE_BB = 2;

const orderIndex = (list: readonly string[], seat: string) => {
  const i = list.indexOf(seat);
  return i < 0 ? list.length : i;
};

/** Player ids in preflop acting order (a straddling UTG acts last). */
export function preflopOrder(h: LoggedHand): string[] {
  const key = (seat: string) => (h.straddle && seat === 'UTG' ? 100 : orderIndex(PREFLOP_ORDER, seat));
  return [...h.players].sort((a, b) => key(a.seat) - key(b.seat)).map((p) => p.id);
}

/** Player ids in postflop acting order (blinds first, button last). */
export function postflopOrder(h: LoggedHand): string[] {
  return [...h.players].sort((a, b) => orderIndex(POSTFLOP_ORDER, a.seat) - orderIndex(POSTFLOP_ORDER, b.seat)).map((p) => p.id);
}

/** Preflop bet unit: the straddle when there is one, else the big blind. */
export const loggedPreflopUnit = (h: LoggedHand) => (h.straddle ? LOG_STRADDLE_BB : 1);

export interface ResolvedAction extends LoggedAction {
  /** Amount after estimation (street total). */
  resolvedTo: number;
  /** Chips this action added. */
  added: number;
  estimated: boolean;
  potBefore: number;
  /** Street bet level before this action. */
  currentBefore: number;
  /** What the actor had in this street before acting. */
  streetInBefore: number;
  allIn: boolean;
}

export interface Pot {
  amount: number;
  /** Player ids who can win this pot. */
  eligible: string[];
}

export interface NextAction {
  street: LogStreet;
  actor: string;
  toCall: number;
  canCheck: boolean;
  canRaise: boolean;
  /** Minimum and maximum "raise to" (street total). */
  minTo: number;
  maxTo: number;
  /** Bet/raise "to" amounts to offer as quick buttons. */
  quickSizes: number[];
}

export interface ReplayedHand {
  actions: ResolvedAction[];
  finalPot: number;
  heroInvested: number;
  anyEstimated: boolean;
  invested: Record<string, number>;
  folded: string[];
  allIn: string[];
  /** Main pot first, then side pots. */
  pots: Pot[];
  /** Whose turn it is after the logged actions (null when the betting is over). */
  next: NextAction | null;
  /** The street the next action is on (or the last street played). */
  street: LogStreet;
  /** Board cards needed before the next action can be entered. */
  needsBoard: number;
}

const r2 = (x: number) => Math.round(x * 100) / 100;
const STREETS: LogStreet[] = ['preflop', 'flop', 'turn', 'river'];
export const BOARD_FOR: Record<LogStreet, number> = { preflop: 0, flop: 3, turn: 4, river: 5 };

/** Split contributions into a main pot and side pots (folded players' chips stay in, but they can't win). */
export function computePots(invested: Record<string, number>, folded: ReadonlySet<string>, deadMoney = 0): Pot[] {
  const ids = Object.keys(invested);
  const levels = [...new Set(ids.filter((id) => !folded.has(id)).map((id) => invested[id]!))].sort((a, b) => a - b);
  const pots: Pot[] = [];
  let prev = 0;
  for (const level of levels) {
    let amount = 0;
    for (const id of ids) amount += Math.max(0, Math.min(invested[id]!, level) - prev);
    const eligible = ids.filter((id) => !folded.has(id) && invested[id]! >= level);
    if (amount > 0) {
      const same = pots.find((p) => p.eligible.length === eligible.length && p.eligible.every((e) => eligible.includes(e)));
      if (same) same.amount = r2(same.amount + amount);
      else pots.push({ amount: r2(amount), eligible });
    }
    prev = level;
  }
  // Chips from folded players above the last live level, and dead blinds, go to the main pot.
  const counted = pots.reduce((s, p) => s + p.amount, 0);
  const total = ids.reduce((s, id) => s + invested[id]!, 0) + deadMoney;
  if (pots.length) pots[0]!.amount = r2(pots[0]!.amount + (total - counted));
  else if (total > 0) pots.push({ amount: r2(total), eligible: ids.filter((id) => !folded.has(id)) });
  return pots;
}

/**
 * Walk the actions for any number of players, posting blinds (and a straddle), filling unknown
 * amounts with estimates, capping at stacks (all-ins), and working out whose turn it is next.
 * Estimates: preflop open 3 units + 1 per limper, re-raise 3x; postflop bet 2/3 pot, raise 3x.
 */
export function replayAmounts(input: LoggedHand | LoggedHandV1): ReplayedHand {
  const hand = migrateLoggedHand(input);
  const unit = loggedPreflopUnit(hand);
  const ids = hand.players.map((p) => p.id);
  const invested: Record<string, number> = Object.fromEntries(ids.map((id) => [id, 0]));
  const folded = new Set<string>();
  const allIn = new Set<string>();
  const out: ResolvedAction[] = [];
  let anyEstimated = false;
  let dead = 0;
  const seatPlayer = (seat: string) => hand.players.find((p) => p.seat === seat);
  const post = (seat: string, amt: number) => {
    const p = seatPlayer(seat);
    if (!p) {
      dead += amt;
      return;
    }
    const a = Math.min(amt, stackOf(hand, p.id));
    invested[p.id] = a;
    if (a >= stackOf(hand, p.id)) allIn.add(p.id);
  };
  post('SB', 0.5);
  post('BB', 1);
  if (hand.straddle) post('UTG', LOG_STRADDLE_BB);
  const blindsIn = { ...invested };

  let street: LogStreet = 'preflop';
  let current = unit;
  let lastRaise = unit;
  let streetIn: Record<string, number> = { ...blindsIn };
  let acted = new Set<string>();
  let limpers = 0;
  const pot = () => r2(Object.values(invested).reduce((a, b) => a + b, 0) + dead);

  const startStreet = (st: LogStreet) => {
    street = st;
    current = 0;
    lastRaise = 1;
    streetIn = Object.fromEntries(ids.map((id) => [id, 0]));
    acted = new Set();
  };

  for (const a of hand.actions) {
    if (a.street !== street) {
      if (STREETS.indexOf(a.street) < STREETS.indexOf(street)) continue;
      startStreet(a.street);
    }
    const id = a.actor;
    if (!(id in invested)) continue;
    const potBefore = pot();
    const before = streetIn[id] ?? 0;
    const currentBefore = current;
    const cap = r2(stackOf(hand, id) - (invested[id]! - before));
    let to = before;
    let estimated = false;
    if (a.type === 'call') {
      to = Math.max(before, current);
      if (street === 'preflop' && current === unit) limpers++;
    }
    if (a.type === 'bet' || a.type === 'raise') {
      if (a.amount !== null) to = a.amount;
      else {
        estimated = true;
        if (street === 'preflop') to = current <= unit ? unit * (3 + limpers) : current * 3;
        else to = current === 0 ? r2(potBefore * (2 / 3)) : current * 3;
      }
    }
    to = Math.min(to, cap);
    if ((a.type === 'bet' || a.type === 'raise') && to > current) {
      lastRaise = Math.max(lastRaise, to - current);
      current = to;
      acted = new Set();
    }
    const added = Math.max(0, r2(to - before));
    streetIn[id] = to;
    invested[id] = r2(invested[id]! + added);
    const isAllIn = a.type !== 'fold' && a.type !== 'check' && invested[id]! >= stackOf(hand, id) - 1e-9;
    if (isAllIn) allIn.add(id);
    if (a.type === 'fold') folded.add(id);
    acted.add(id);
    anyEstimated ||= estimated;
    out.push({ ...a, resolvedTo: r2(to), added, estimated, potBefore, currentBefore, streetInBefore: before, allIn: isAllIn });
  }

  // Whose turn next?
  const live = ids.filter((id) => !folded.has(id));
  const canAct = (id: string) => !folded.has(id) && !allIn.has(id);
  let next: NextAction | null = null;
  const findNext = (): string | null => {
    const order = street === 'preflop' ? preflopOrder(hand) : postflopOrder(hand);
    const lastActor = out.length && out[out.length - 1]!.street === street ? out[out.length - 1]!.actor : null;
    const startAt = lastActor ? order.indexOf(lastActor) + 1 : 0;
    for (let k = 0; k < order.length; k++) {
      const id = order[(startAt + k) % order.length]!;
      if (!canAct(id)) continue;
      const owes = (streetIn[id] ?? 0) < current - 1e-9;
      if (owes || !acted.has(id)) return id;
    }
    return null;
  };
  if (live.length > 1) {
    for (let guard = 0; guard < 4; guard++) {
      const actors = live.filter(canAct);
      if (actors.length === 0) break;
      // One player left who can act and nobody to bet against: betting is over.
      if (actors.length === 1 && (streetIn[actors[0]!] ?? 0) >= current - 1e-9) break;
      const who = findNext();
      if (who) {
        const toCall = r2(Math.max(0, current - (streetIn[who] ?? 0)));
        const stackLeft = r2(stackOf(hand, who) - invested[who]!);
        const maxTo = r2((streetIn[who] ?? 0) + stackLeft);
        const minTo = Math.min(maxTo, r2(current + Math.max(lastRaise, street === 'preflop' ? unit : 1)));
        const p = pot();
        const quick =
          street === 'preflop'
            ? current <= unit
              ? [2.5, 3, 4, 5].map((m) => m * unit + (m >= 3 ? limpers * unit : 0))
              : [2.5, 3, 4].map((m) => current * m)
            : current === 0
              ? [1 / 3, 1 / 2, 2 / 3, 1].map((f) => p * f)
              : [2.5, 3, 4].map((m) => current * m);
        next = {
          street,
          actor: who,
          toCall: Math.min(toCall, stackLeft),
          canCheck: toCall === 0,
          canRaise: stackLeft > toCall && actors.length > 1,
          minTo,
          maxTo,
          quickSizes: [...new Set(quick.map((x) => r2(Math.min(maxTo, Math.max(minTo, Math.round(x * 2) / 2)))))],
        };
        break;
      }
      const i = STREETS.indexOf(street);
      if (i >= 3) break;
      startStreet(STREETS[i + 1]!);
    }
  }
  const nextAction = next as NextAction | null;

  return {
    actions: out,
    finalPot: pot(),
    heroInvested: invested[heroOf(hand).id] ?? 0,
    anyEstimated,
    invested,
    folded: [...folded],
    allIn: [...allIn],
    pots: computePots(invested, folded, dead),
    next: nextAction,
    street,
    needsBoard: nextAction ? BOARD_FOR[nextAction.street] : 0,
  };
}

// ---------------------------------------------------------------------------
// Ranges

function minRange(a: Range, b: Range): Range {
  const w = new Float64Array(1326);
  let any = false;
  for (let i = 0; i < 1326; i++) {
    w[i] = Math.min(a.weights[i]!, b.weights[i]!);
    if (w[i]! > 0) any = true;
  }
  return any ? { weights: w } : b;
}
function subtract(a: Range, b: Range): Range {
  const w = new Float64Array(1326);
  for (let i = 0; i < 1326; i++) w[i] = Math.max(0, a.weights[i]! - b.weights[i]!);
  return { weights: w };
}

/** Chart seat for a logged seat (with a straddle every seat reads one position tighter). */
function chartSeat(chart: Chart, hand: LoggedHand, seat: string): string {
  return hand.straddle ? straddleView(chart.seats, hand.stackBb).seatMap[seat] ?? seat : seat;
}

/**
 * A player's preflop range from their own actions: chart ranges for the spot each action was taken
 * in (or ranges implied by a tagged profile's VPIP/PFR), intersected action by action.
 */
export function preflopRangeFor(chart: Chart, hand: LoggedHand, playerId: string, actions: readonly LoggedAction[], stats?: PlayerStats): Range {
  const player = playerById(hand, playerId)!;
  const seat = chartSeat(chart, hand, player.seat);
  const pre = actions.filter((a) => a.street === 'preflop');
  let range: Range | null = null;
  let raisesSoFar = 0;
  for (let i = 0; i < pre.length; i++) {
    const a = pre[i]!;
    if (a.type === 'raise' || a.type === 'bet') raisesSoFar++;
    if (a.actor !== playerId) continue;
    const prior: PreflopAct[] = pre.slice(0, i).map((p) => ({ actor: p.actor, type: p.type }));
    const extra = prior.some((p) => p.type === 'raise' || p.type === 'bet') ? 0 : hand.limpers ?? 0;
    const d = classifyPreflopDecision(prior, playerId, extra);
    const openerSeat = d.opener ? chartSeat(chart, hand, playerById(hand, d.opener)?.seat ?? '') : '';
    const sp = d.kind === 'vsOpen' ? chart.vsOpen(seat, openerSeat) : d.kind === 'none' ? null : chart.spot({ kind: d.kind, seat, limpers: d.count, callers: d.count });
    let r: Range | undefined;
    if (a.type === 'raise' || a.type === 'bet') {
      if (stats) r = raisesSoFar <= 1 ? statsPreflopRanges(stats).raise : topRange(Math.max(0.02, stats.pfr * 0.3));
      else if (sp) r = sp.ranges.raise ?? sp.ranges['3bet'] ?? sp.ranges['4bet'] ?? sp.ranges['5bet'];
      r ??= topRange([0.15, 0.05, 0.025, 0.015][Math.min(3, raisesSoFar - 1)]!);
    } else if (a.type === 'call') {
      if (stats) r = raisesSoFar === 0 ? statsPreflopRanges(stats).call : subtract(topRange(Math.min(1, stats.vpip * 0.7)), topRange(stats.pfr * 0.3));
      else if (sp) r = raisesSoFar === 0 ? sp.ranges.limp ?? parseRange(LIMP_RANGE) : sp.ranges.call;
      r ??= raisesSoFar === 0 ? parseRange(LIMP_RANGE) : subtract(topRange(0.2), topRange(0.04));
    } else if (a.type === 'check') {
      const raiseR = sp?.ranges.raise;
      r = raiseR ? subtract(parseRange('random'), raiseR) : parseRange(BB_CHECK_RANGE);
    } else continue;
    range = range ? minRange(range, r) : r;
  }
  return range ?? parseRange('random');
}

// ---------------------------------------------------------------------------
// Analysis

export interface ActualView {
  /** Hero's equity against the cards opponents actually showed (ranges for the rest). */
  equity: number;
  /** Who showed what, e.g. "BTN: {Ah}{Kd}". */
  shown: string[];
}

export interface StreetAnalysis {
  street: LogStreet;
  heroAction: ResolvedAction;
  analysis: SpotAnalysis | null;
  review: DecisionReview;
  /** Plain-English verdict. */
  summary: string;
  villainRange: StrategyVisual | null;
  potOddsNeeded: number | null;
  /** Opponents still in the hand at this decision. */
  opponents: { id: string; seat: string; name: string }[];
  /** "What they actually had", when an opponent showed cards. */
  actual?: ActualView;
}

export interface LoggedHandAnalysis {
  decisions: StreetAnalysis[];
  anyEstimated: boolean;
  line: PreflopLine;
  error: string | null;
}

export interface AnalyzeLoggedOptions {
  /** Models per player id (tagged profiles). */
  models?: Record<string, VillainModel>;
  /** Stats per player id, for profile-based preflop ranges. */
  stats?: Record<string, PlayerStats>;
  /** Display names per player id. */
  names?: Record<string, string>;
}

const VERDICT: Record<Grade, string> = { best: 'right', acceptable: 'reasonable', mistake: 'a mistake' };

function actionLabel(a: ResolvedAction): string {
  const est = a.estimated ? ' (estimated)' : '';
  const all = a.allIn ? ' (all-in)' : '';
  switch (a.type) {
    case 'fold':
      return 'Fold';
    case 'check':
      return 'Check';
    case 'call':
      return `Call ${a.added}bb${all}`;
    case 'bet':
      return `Bet ${a.resolvedTo}bb${est}${all}`;
    default:
      return `Raise to ${a.resolvedTo}bb${est}${all}`;
  }
}

function actionVerb(a: ResolvedAction): string {
  switch (a.type) {
    case 'fold':
      return 'Folding';
    case 'check':
      return 'Checking';
    case 'call':
      return 'Calling';
    case 'bet':
      return `Betting ${a.resolvedTo}bb`;
    default:
      return `Raising to ${a.resolvedTo}bb`;
  }
}

function preflopLineVs(hand: LoggedHand, main: string): PreflopLine {
  const hero = heroOf(hand).id;
  const raises = hand.actions.filter((a) => a.street === 'preflop' && (a.type === 'raise' || a.type === 'bet') && (a.actor === hero || a.actor === main));
  if (!raises.length) return 'limped';
  const last = raises[raises.length - 1]!;
  if (raises.length === 1) return last.actor === hero ? 'hero-open' : 'villain-open';
  return last.actor === hero ? 'hero-3bet' : 'villain-3bet';
}

export const displayName = (p: LoggedPlayer, names: Record<string, string> = {}) => names[p.id] ?? p.name ?? (p.hero ? 'You' : p.seat);

/** Analyse every hero decision in a logged hand. */
export function analyzeLoggedHand(input: LoggedHand | LoggedHandV1, chart: Chart, model: VillainModel, opts: AnalyzeLoggedOptions = {}): LoggedHandAnalysis {
  const hand = migrateLoggedHand(input);
  const replay = replayAmounts(hand);
  const hero = heroOf(hand);
  const opps = opponentsOf(hand);
  const modelOf = (id: string) => opts.models?.[id] ?? model;
  // Main opponent: the last preflop raiser who isn't hero, else the first opponent to act.
  const mainOpp =
    [...hand.actions].reverse().find((a) => a.street === 'preflop' && a.actor !== hero.id && (a.type === 'raise' || a.type === 'bet'))?.actor ??
    hand.actions.find((a) => a.actor !== hero.id && a.type !== 'fold')?.actor ??
    opps[0]?.id ??
    hero.id;
  const line = preflopLineVs(hand, mainOpp);
  const decisions: StreetAnalysis[] = [];
  try {
    const heroCards = hand.heroCards.map((c) => cardIndex(parseCard(c))) as [number, number];
    const boardAll = hand.board.map((c) => cardIndex(parseCard(c)));
    const heroLabel = (() => {
      const [a, b] = [...heroCards].sort((x, y) => y - x);
      return COMBOS.find((c) => c.c1 === a && c.c2 === b)!.label;
    })();
    const ranges: Record<string, Range> = {};
    for (const p of hand.players) ranges[p.id] = preflopRangeFor(chart, hand, p.id, hand.actions, p.hero ? undefined : opts.stats?.[p.id]);
    const heroSeatChart = chartSeat(chart, hand, hero.seat);
    const folded = new Set<string>();
    // Names: given names, then the player's name, then a tagged model's name (e.g. "Nit"), then the seat.
    const name = (id: string) => {
      const p = playerById(hand, id)!;
      if (opts.names?.[id] || p.name || p.hero) return displayName(p, opts.names);
      const m = modelOf(id);
      return m.id !== 'regular' ? m.name : p.seat;
    };
    const liveOpponents = () => opps.filter((o) => !folded.has(o.id));
    const oppTags = (list: LoggedPlayer[]) => ({
      opponents: list.length,
      opponentArchetypes: list.map((o) => modelOf(o.id).id).filter((m) => m.startsWith('arch:')).map((m) => m.slice(5)),
      opponentProfiles: list.map((o) => o.profileId).filter((x): x is string => !!x),
    });

    // Preflop hero decisions: graded by the chart for the spot the action so far creates.
    const preActs = replay.actions.filter((a) => a.street === 'preflop');
    for (let i = 0; i < preActs.length; i++) {
      const a = preActs[i]!;
      if (a.actor !== hero.id) {
        if (a.type === 'fold') folded.add(a.actor);
        continue;
      }
      const prior = preActs.slice(0, i).map((p) => ({ actor: p.actor, type: p.type }));
      const decision = classifyPreflopDecision(prior, hero.id, prior.some((p) => p.type === 'raise' || p.type === 'bet') ? 0 : hand.limpers ?? 0);
      const kind = decision.kind;
      const openerSeat = decision.opener ? chartSeat(chart, hand, playerById(hand, decision.opener)?.seat ?? '') : '';
      const spot = kind === 'vsOpen' ? chart.vsOpen(heroSeatChart, openerSeat) : kind === 'none' ? null : chart.spot({ kind, seat: heroSeatChart, limpers: decision.count, callers: decision.count });
      const chosen: PreflopAction = chartAction(kind, a.type);
      let grade: Grade | null = null;
      let note = 'No chart for this preflop spot.';
      let evLost: number | null = null;
      // A free check (big blind or straddle option) is always fine unless the chart says raise.
      const freeCheck = a.type === 'check' && (kind === 'rfi' || (kind === 'vsLimpers' && spot?.rest !== 'check'));
      if (spot && !freeCheck) {
        const strat = strategyFor(spot, heroLabel);
        const f = strat.freq[chosen] ?? 0;
        grade = chosen === strat.main ? 'best' : f >= 0.25 ? 'acceptable' : 'mistake';
        const where =
          kind === 'vsOpen'
            ? ` vs ${openerSeat}`
            : kind === 'vsLimpers'
              ? ` behind ${decision.count} limper${decision.count === 1 ? '' : 's'}`
              : kind === 'squeeze'
                ? ` facing an open and ${decision.count} caller${decision.count === 1 ? '' : 's'}`
                : kind === 'vsLimpRaise'
                  ? ' after limping into a raise'
                  : kind === 'vs4bet'
                    ? ' facing a 4-bet'
                    : '';
        note = `Chart plays ${heroLabel} from ${heroSeatChart}${where} as ${(Object.entries(strat.freq) as [PreflopAction, number][])
          .filter(([, v]) => v > 0.005)
          .map(([k, v]) => `${k === 'limp' && kind === 'vsLimpers' ? 'Overlimp' : ACTION_NAMES[k]} ${formatPercent(v, 0)}`)
          .join(', ')}.`;
        if (hand.straddle) note += ' (Straddled pot: seats read one position tighter.)';
        if (kind === 'vsOpen' && a.type === 'call' && grade === 'mistake') {
          const opener = chart.rfi(openerSeat)?.ranges.raise;
          if (opener) {
            const eq = calculateEquity([hand.heroCards.join(''), opener], { iterations: 3000, seed: 5, forceMonteCarlo: true }).players[0]!.equity;
            const ev = eq * 0.8 * (a.potBefore + a.added) - a.added;
            evLost = r2(Math.max(0, -ev));
          }
        }
      }
      const live = liveOpponents();
      decisions.push({
        street: 'preflop',
        heroAction: a,
        analysis: null,
        review: {
          street: 'preflop',
          action: actionLabel(a),
          grade,
          evLost,
          equity: null,
          best: spot ? ACTION_NAMES[strategyFor(spot, heroLabel).main] : null,
          note,
          tags: {
            facingBet: kind !== 'rfi' && kind !== 'vsLimpers' && a.currentBefore > a.streetInBefore,
            heroPos: hero.seat,
            actionType: a.type,
            preflopKind: kind,
            preflopCount: decision.count,
            isoSize:
              kind === 'vsLimpers' && a.type === 'raise'
                ? { chosen: a.resolvedTo / loggedPreflopUnit(hand), recommended: isoSize(chart.id.startsWith('home') ? 'home' : 'casino', heroSeatChart, decision.count).best }
                : undefined,
            ...oppTags(live),
          },
        },
        summary: grade ? `${actionVerb(a)} ${heroLabel} preflop was ${VERDICT[grade]}. ${note}` : note,
        villainRange: null,
        potOddsNeeded: null,
        opponents: live.map((o) => ({ id: o.id, seat: o.seat, name: name(o.id) })),
      });
    }

    // Postflop: walk actions, narrowing each player's range, analysing each hero decision.
    const streets: Street[] = ['flop', 'turn', 'river'];
    const investedBefore: Record<string, number> = {};
    for (const p of hand.players)
      investedBefore[p.id] =
        replay.actions.filter((x) => x.actor === p.id && x.street === 'preflop').reduce((s, x) => s + x.added, 0) +
        (p.seat === 'SB' ? 0.5 : p.seat === 'BB' ? 1 : hand.straddle && p.seat === 'UTG' ? LOG_STRADDLE_BB : 0);
    let aggressorId: string | null = [...preActs].reverse().find((x) => x.type === 'raise' || x.type === 'bet')?.actor ?? null;
    const pfOrder = postflopOrder(hand);
    for (const st of streets) {
      const n = st === 'flop' ? 3 : st === 'turn' ? 4 : 5;
      const acts = replay.actions.filter((a) => a.street === st);
      if (!acts.length) continue;
      if (boardAll.length < n) break;
      const board = boardAll.slice(0, n);
      let streetAggressor: string | null = null;
      for (const a of acts) {
        const facing = r2(Math.max(0, a.currentBefore - a.streetInBefore));
        if (a.actor === hero.id) {
          const live = liveOpponents();
          const heroLeft = r2(stackOf(hand, hero.id) - investedBefore[hero.id]!);
          const oppLeft = Math.max(0, ...live.map((o) => stackOf(hand, o.id) - investedBefore[o.id]!));
          const effective = Math.max(0.5, Math.min(heroLeft, oppLeft) - a.streetInBefore);
          const heroIP = live.every((o) => pfOrder.indexOf(hero.id) > pfOrder.indexOf(o.id));
          // The bettor first (for raise math), then everyone else in acting order.
          const ordered = [...live].sort((x, y) => (x.id === streetAggressor ? -1 : y.id === streetAggressor ? 1 : pfOrder.indexOf(x.id) - pfOrder.indexOf(y.id)));
          const villains: Player[] = ordered.map((o) => ({
            seat: o.seat,
            range: ranges[o.id]!,
            stack: r2(stackOf(hand, o.id) - investedBefore[o.id]!),
            aggressor: o.id === aggressorId,
            model: modelOf(o.id),
          }));
          const callersBefore = acts
            .slice(0, acts.indexOf(a))
            .filter((x) => x.type === 'call' && x.actor !== hero.id)
            .map((x) => playerById(hand, x.actor)!.seat);
          const mainId = ordered[0]?.id ?? mainOpp;
          const spot: Spot = {
            theme: facing > 0 ? 'facing' : 'value',
            potType: live.length > 1 ? 'multiway' : line.includes('3bet') ? '3bet' : line === 'limped' ? 'limped' : 'srp',
            street: st,
            stackBb: hand.stackBb,
            board,
            hero: heroCards,
            heroSeat: hero.seat,
            heroRange: ranges[hero.id]!,
            heroIP,
            heroAggressor: aggressorId === hero.id,
            villains,
            pot: r2(a.potBefore - facing),
            effectiveStack: effective,
            facingBet: facing > 0 ? facing : null,
            checkedTo: facing === 0 && heroIP,
            callersBefore: facing > 0 && callersBefore.length ? callersBefore : undefined,
            history: [],
            rangeTrail: [],
            model: modelOf(mainId),
          };
          const analysis = analyzeSpot(spot, { sizes: [0.33, 0.5, 0.75, 1] });
          const opt =
            a.type === 'fold'
              ? analysis.options.find((o) => o.action === 'fold')
              : a.type === 'check'
                ? analysis.options.find((o) => o.action === 'check')
                : a.type === 'call'
                  ? analysis.options.find((o) => o.action === 'call')
                  : [...analysis.options.filter((o) => o.action === 'bet' || o.action === 'raise')].sort((x, y) => Math.abs(x.amount - a.resolvedTo) - Math.abs(y.amount - a.resolvedTo))[0];
          const grade = opt?.grade ?? null;
          const need = facing > 0 ? potOdds(a.potBefore, Math.min(facing, heroLeft - a.streetInBefore)).requiredEquity : null;
          const eq = analysis.heroEquity;
          const close = need !== null && Math.abs(eq - need) < 0.04;
          const who = live.length > 1 ? `${live.length} opponents (${live.map((o) => name(o.id)).join(', ')})` : `${name(live[0]?.id ?? mainOpp)}'s range`;
          const multiNote =
            live.length > 1 ? ' Multi-way: value bets and bluffs both need stronger hands, because everyone has to fold for a bluff to work and someone often holds a good hand.' : '';
          const summary =
            grade === null
              ? analysis.summary
              : need !== null
                ? `${actionVerb(a)} ${analysis.hero.description.toLowerCase()} here was ${VERDICT[grade]}: against ${who} you had about ${formatPercent(eq, 0)} equity and needed ${formatPercent(need, 0)}.${close ? ' Close spot.' : ''}${grade !== 'best' ? ` Better: ${analysis.best.label}.` : ''}${multiNote}`
                : `${actionVerb(a)} with ${analysis.hero.description.toLowerCase()} was ${VERDICT[grade]}: you had about ${formatPercent(eq, 0)} equity against ${who}. ${grade !== 'best' ? `Best: ${analysis.best.label} (EV ≈ ${signedBb(analysis.best.ev)}).` : `EV ≈ ${signedBb(opt!.ev)}.`}${multiNote}`;
          // "What they actually had": equity against shown cards (ranges for players who didn't show).
          let actual: ActualView | undefined;
          const shown = live.filter((o) => o.shownCards?.length === 2);
          if (shown.length) {
            try {
              const known = shown.flatMap((o) => parseCardIndices(o.shownCards!.join('')));
              if (!known.some((c) => heroCards.includes(c) || board.includes(c))) {
                const specs = live.map((o) => (o.shownCards?.length === 2 ? o.shownCards.join('') : ranges[o.id]!));
                const res = calculateEquity([hand.heroCards.join(''), ...specs], { board: hand.board.slice(0, n).join(''), iterations: 6000, seed: 11 });
                actual = { equity: res.players[0]!.equity, shown: shown.map((o) => `${name(o.id)}: ${o.shownCards!.map((c) => `{${c}}`).join('')}`) };
              }
            } catch {
              actual = undefined;
            }
          }
          decisions.push({
            street: st,
            heroAction: a,
            analysis,
            review: {
              street: st,
              action: actionLabel(a),
              grade,
              evLost: opt ? r2(Math.max(0, analysis.best.ev - opt.ev)) : null,
              equity: eq,
              best: analysis.best.label,
              note: summary,
              tags: {
                facingBet: facing > 0,
                bucket: analysis.hero.bucket,
                heroPos: hero.seat,
                villainArchetype: modelOf(mainId).id.startsWith('arch:') ? modelOf(mainId).id.slice(5) : undefined,
                villainFoldRiver: undefined,
                chosenFraction: a.type === 'bet' || a.type === 'raise' ? a.added / Math.max(1, a.potBefore) : null,
                bestFraction: analysis.best.fraction,
                actionType: a.type,
                ...oppTags(live),
              },
            },
            summary,
            villainRange: rangeVisual(ranges[mainId]!, `${name(mainId)}'s likely range on the ${st}`),
            potOddsNeeded: need,
            opponents: live.map((o) => ({ id: o.id, seat: o.seat, name: name(o.id) })),
            actual,
          });
        }
        // Narrow the actor's range by this action.
        if (a.type === 'fold') {
          folded.add(a.actor);
          continue;
        }
        const frac = a.added / Math.max(1, a.potBefore);
        const facingFrac = facing / Math.max(1, a.potBefore - facing);
        const combos = classifyRange(ranges[a.actor]!, board);
        const m = a.actor === hero.id ? HERO_LINE_MODEL : forStreet(modelOf(a.actor), st);
        const next =
          a.type === 'bet' || a.type === 'raise'
            ? bettingRange(combos, Math.max(0.2, frac), m, st)
            : a.type === 'call'
              ? continuingRange(combos, Math.max(0.1, facingFrac), m)
              : checkingRange(combos, 0.5, m, st);
        if (next.weights.some((w) => w > 0)) ranges[a.actor] = next;
        if (a.type === 'bet' || a.type === 'raise') {
          streetAggressor = a.actor;
          aggressorId = a.actor;
        }
      }
      for (const p of hand.players) investedBefore[p.id] = r2(investedBefore[p.id]! + acts.filter((x) => x.actor === p.id).reduce((s, x) => s + x.added, 0));
    }
    return { decisions, anyEstimated: replay.anyEstimated, line, error: null };
  } catch (e) {
    return { decisions, anyEstimated: replay.anyEstimated, line, error: (e as Error).message };
  }
}
