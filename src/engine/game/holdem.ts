/**
 * No-Limit Hold'em hand state machine. Pure and immutable: every action returns a new state.
 * Handles blinds (incl. heads-up), betting rounds, min-raises, all-ins, uncalled bets,
 * side pots, split pots and run-outs.
 */
import { evaluateIndices, evaluateHand, categoryOf, CATEGORY_NAMES } from '../evaluator';
import { cardFromIndex } from '../cards';
import type { Rng } from '../rng';

export type GameStreet = 'preflop' | 'flop' | 'turn' | 'river';
export type ActionType = 'fold' | 'check' | 'call' | 'bet' | 'raise';

export interface TableSeat {
  index: number;
  name: string;
  stack: number;
  hole: number[];
  folded: boolean;
  allIn: boolean;
  /** Chips put in on the current street. */
  bet: number;
  /** Chips put in this hand. */
  totalIn: number;
  /** Has acted since the last full raise on this street. */
  acted: boolean;
  hero: boolean;
  /** Not dealt in (busted). */
  out: boolean;
}

export interface ActionEvent {
  seat: number;
  street: GameStreet;
  type: ActionType | 'post-sb' | 'post-bb' | 'post-straddle';
  /** Chips added by this action. */
  amount: number;
  /** Street bet level after this action. */
  to: number;
  /** Pot (all chips in) before this action. */
  potBefore: number;
  allIn: boolean;
}

export interface PotResult {
  amount: number;
  eligible: number[];
  winners: number[];
}

export interface HandResult {
  pots: PotResult[];
  /** Net chips won/lost by seat this hand. */
  net: Record<number, number>;
  /** Total collected by each winner. */
  collected: Record<number, number>;
  showdown: boolean;
  /** Seats whose cards were shown. */
  shown: number[];
  handNames: Record<number, string>;
  returned: { seat: number; amount: number } | null;
}

export interface HandState {
  handNo: number;
  seats: TableSeat[];
  button: number;
  sbSeat: number;
  bbSeat: number;
  /** Seat that posted a straddle (-1 when none). */
  straddleSeat: number;
  sb: number;
  bb: number;
  street: GameStreet;
  board: number[];
  /** Remaining deck; cards are taken from the end. */
  deck: number[];
  toAct: number | null;
  currentBet: number;
  lastRaiseSize: number;
  log: ActionEvent[];
  finished: boolean;
  result: HandResult | null;
  /** Board size when betting ended early because everyone was all-in (for all-in adjusted EV). */
  allInBoardSize: number | null;
}

export interface SeatConfig {
  name: string;
  stack: number;
  hero?: boolean;
}

export const potSize = (s: HandState) => s.seats.reduce((a, x) => a + x.totalIn, 0);
const live = (s: HandState) => s.seats.filter((x) => !x.out && !x.folded);
const canAct = (x: TableSeat) => !x.out && !x.folded && !x.allIn;

function nextSeat(s: HandState, from: number, pred: (x: TableSeat) => boolean): number | null {
  const n = s.seats.length;
  for (let k = 1; k <= n; k++) {
    const i = (from + k) % n;
    if (pred(s.seats[i]!)) return i;
  }
  return null;
}

function clone(s: HandState): HandState {
  return { ...s, seats: s.seats.map((x) => ({ ...x, hole: [...x.hole] })), board: [...s.board], deck: [...s.deck], log: [...s.log] };
}

const cents = (x: number) => Math.round(x * 100) / 100;

function put(seat: TableSeat, amount: number): number {
  const a = Math.min(cents(amount), seat.stack);
  seat.stack = cents(seat.stack - a);
  seat.bet = cents(seat.bet + a);
  seat.totalIn = cents(seat.totalIn + a);
  if (seat.stack <= 1e-9) {
    seat.stack = 0;
    seat.allIn = true;
  }
  return a;
}

/** Deal a new hand. `button` is the dealer seat index (must be a seat that is not out). */
/**
 * Start a hand. `blinds.straddle` (e.g. 2 = 2bb) makes the player after the big blind post a live
 * straddle: they act last preflop with an option, like the big blind (needs 3+ players).
 */
export function startHand(configs: SeatConfig[], button: number, blinds: { sb: number; bb: number; straddle?: number }, rng: Rng, handNo = 1): HandState {
  const deck = Array.from({ length: 52 }, (_, i) => i);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [deck[i], deck[j]] = [deck[j]!, deck[i]!];
  }
  const seats: TableSeat[] = configs.map((c, index) => ({
    index,
    name: c.name,
    stack: c.stack,
    hole: [],
    folded: false,
    allIn: false,
    bet: 0,
    totalIn: 0,
    acted: false,
    hero: !!c.hero,
    out: c.stack <= 0,
  }));
  const active = seats.filter((x) => !x.out);
  if (active.length < 2) throw new Error('Need at least two players with chips');
  if (seats[button]!.out) throw new Error('Button must be on an active seat');

  const s: HandState = {
    handNo,
    seats,
    button,
    sbSeat: -1,
    bbSeat: -1,
    straddleSeat: -1,
    sb: blinds.sb,
    bb: blinds.bb,
    street: 'preflop',
    board: [],
    deck,
    toAct: null,
    currentBet: 0,
    lastRaiseSize: blinds.bb,
    log: [],
    finished: false,
    result: null,
    allInBoardSize: null,
  };
  const inPlay = (x: TableSeat) => !x.out;
  // Heads-up: the button posts the small blind.
  const sbSeat = active.length === 2 ? button : nextSeat(s, button, inPlay)!;
  const bbSeat = nextSeat(s, sbSeat, inPlay)!;
  s.sbSeat = sbSeat;
  s.bbSeat = bbSeat;
  for (const [seat, amt, type] of [
    [sbSeat, blinds.sb, 'post-sb'],
    [bbSeat, blinds.bb, 'post-bb'],
  ] as const) {
    const potBefore = potSize(s);
    const a = put(s.seats[seat]!, amt);
    s.log.push({ seat, street: 'preflop', type, amount: a, to: s.seats[seat]!.bet, potBefore, allIn: s.seats[seat]!.allIn });
  }
  s.currentBet = Math.max(s.seats[sbSeat]!.bet, s.seats[bbSeat]!.bet);
  let lastBlind = bbSeat;
  if (blinds.straddle && active.length >= 3) {
    const st = nextSeat(s, bbSeat, inPlay)!;
    const potBefore = potSize(s);
    const a = put(s.seats[st]!, blinds.straddle);
    s.log.push({ seat: st, street: 'preflop', type: 'post-straddle', amount: a, to: s.seats[st]!.bet, potBefore, allIn: s.seats[st]!.allIn });
    s.straddleSeat = st;
    s.currentBet = Math.max(s.currentBet, s.seats[st]!.bet);
    s.lastRaiseSize = blinds.straddle;
    lastBlind = st;
  }
  // Deal two cards to each player, one at a time, starting left of the button.
  for (let round = 0; round < 2; round++) {
    let i = sbSeat;
    for (let k = 0; k < active.length; k++) {
      s.seats[i]!.hole.push(s.deck.pop()!);
      i = nextSeat(s, i, inPlay)!;
    }
  }
  s.toAct = nextSeat(s, lastBlind, canAct);
  // Everyone all-in from the blinds already: straight to the run-out.
  return settleIfDone(s);
}

export interface LegalActions {
  seat: number;
  toCall: number;
  canCheck: boolean;
  /** Chips needed to call (capped at stack). */
  call: number;
  canRaise: boolean;
  /** Bet/raise "to" amounts (street totals). */
  minTo: number;
  maxTo: number;
  /** True when there is no bet yet this street (so the aggressive action is a bet). */
  isBet: boolean;
}

export function legalActions(s: HandState): LegalActions | null {
  if (s.finished || s.toAct === null) return null;
  const seat = s.seats[s.toAct]!;
  const toCall = Math.max(0, s.currentBet - seat.bet);
  const maxTo = seat.bet + seat.stack;
  const minTo = Math.min(maxTo, s.currentBet + Math.max(s.lastRaiseSize, s.bb));
  const othersCanRespond = s.seats.some((x) => x !== seat && canAct(x));
  return {
    seat: seat.index,
    toCall,
    canCheck: toCall === 0,
    call: Math.min(toCall, seat.stack),
    canRaise: maxTo > s.currentBet && othersCanRespond,
    minTo,
    maxTo,
    isBet: s.currentBet === 0,
  };
}

export interface PlayerAction {
  type: ActionType;
  /** For bet/raise: the street total to raise to. */
  to?: number;
}

export function applyAction(state: HandState, action: PlayerAction): HandState {
  const la = legalActions(state);
  if (!la) throw new Error('No action expected');
  const s = clone(state);
  const seat = s.seats[la.seat]!;
  const potBefore = potSize(s);
  let type = action.type;
  let added = 0;
  switch (type) {
    case 'fold':
      if (la.canCheck) type = 'check';
      else seat.folded = true;
      break;
    case 'check':
      if (!la.canCheck) throw new Error('Cannot check facing a bet');
      break;
    case 'call':
      if (la.canCheck) type = 'check';
      else added = put(seat, la.call);
      break;
    case 'bet':
    case 'raise': {
      if (!la.canRaise) {
        // Can't raise (everyone else all-in): treat as call/check.
        type = la.canCheck ? 'check' : 'call';
        added = la.canCheck ? 0 : put(seat, la.call);
        break;
      }
      // Chips move in whole cents.
      const to = Math.max(la.minTo, Math.min(la.maxTo, Math.round((action.to ?? la.minTo) * 100) / 100));
      type = s.currentBet === 0 ? 'bet' : 'raise';
      added = put(seat, to - seat.bet);
      const raiseSize = seat.bet - s.currentBet;
      if (raiseSize >= s.lastRaiseSize) {
        // A full raise reopens the action for everyone else.
        s.lastRaiseSize = raiseSize;
        for (const x of s.seats) if (x !== seat) x.acted = false;
      }
      s.currentBet = Math.max(s.currentBet, seat.bet);
      break;
    }
  }
  seat.acted = true;
  s.log.push({ seat: seat.index, street: s.street, type, amount: added, to: seat.bet, potBefore, allIn: seat.allIn });
  s.toAct = nextSeat(s, seat.index, canAct);
  return settleIfDone(s);
}

function roundComplete(s: HandState): boolean {
  return s.seats.every((x) => !canAct(x) || (x.acted && x.bet === s.currentBet));
}

function settleIfDone(s: HandState): HandState {
  if (live(s).length === 1) return finish(s, false);
  if (!roundComplete(s)) return s;
  // Betting round over. If at most one player can still act, nobody can bet any more: run it out.
  if (s.seats.filter(canAct).length <= 1 || s.street === 'river') {
    if (s.board.length < 5 && s.street !== 'river') s.allInBoardSize = s.board.length;
    while (s.board.length < 5) dealStreet(s);
    return finish(s, true);
  }
  dealStreet(s);
  s.toAct = nextSeat(s, s.button, canAct);
  return s;
}

function dealStreet(s: HandState) {
  const n = s.board.length === 0 ? 3 : 1;
  s.deck.pop(); // burn
  for (let i = 0; i < n; i++) s.board.push(s.deck.pop()!);
  s.street = s.board.length === 3 ? 'flop' : s.board.length === 4 ? 'turn' : 'river';
  for (const x of s.seats) {
    x.bet = 0;
    x.acted = false;
  }
  s.currentBet = 0;
  s.lastRaiseSize = s.bb;
}

function finish(s: HandState, showdown: boolean): HandState {
  s.toAct = null;
  s.finished = true;
  const start = Object.fromEntries(s.seats.map((x) => [x.index, x.totalIn]));
  // Return any uncalled part of the biggest contribution.
  const byIn = [...s.seats].sort((a, b) => b.totalIn - a.totalIn);
  let returned: HandResult['returned'] = null;
  const excess = byIn[0]!.totalIn - (byIn[1]?.totalIn ?? 0);
  if (excess > 1e-9) {
    const top = byIn[0]!;
    top.totalIn -= excess;
    top.stack += excess;
    top.bet = Math.max(0, top.bet - excess);
    returned = { seat: top.index, amount: excess };
  }
  const contenders = live(s);
  const levels = [...new Set(s.seats.map((x) => x.totalIn).filter((v) => v > 0))].sort((a, b) => a - b);
  const pots: PotResult[] = [];
  let prev = 0;
  for (const level of levels) {
    const amount = s.seats.reduce((a, x) => a + Math.max(0, Math.min(x.totalIn, level) - prev), 0);
    const eligible = contenders.filter((x) => x.totalIn >= level).map((x) => x.index);
    prev = level;
    if (amount <= 0) continue;
    if (!eligible.length) {
      // Only folded players reached this level: it goes to the last pot's contenders.
      if (pots.length) pots[pots.length - 1]!.amount += amount;
      continue;
    }
    const last = pots[pots.length - 1];
    if (last && last.eligible.length === eligible.length && last.eligible.every((e, i) => e === eligible[i])) last.amount += amount;
    else pots.push({ amount, eligible, winners: [] });
  }

  const scores: Record<number, number> = {};
  const handNames: Record<number, string> = {};
  if (showdown && s.board.length === 5) {
    for (const x of contenders) {
      scores[x.index] = evaluateIndices([...x.hole, ...s.board]);
      const ev = evaluateHand([...x.hole, ...s.board].map(cardFromIndex));
      handNames[x.index] = ev.description || CATEGORY_NAMES[categoryOf(scores[x.index]!)];
    }
  }
  const collected: Record<number, number> = {};
  for (const pot of pots) {
    if (pot.eligible.length === 1 || !showdown) pot.winners = [pot.eligible[0]!];
    else {
      const best = Math.max(...pot.eligible.map((i) => scores[i]!));
      pot.winners = pot.eligible.filter((i) => scores[i] === best);
    }
    // Split evenly; odd chips (to 0.01) go to the first winner left of the button.
    const share = Math.floor((pot.amount / pot.winners.length) * 100) / 100;
    let remainder = Math.round((pot.amount - share * pot.winners.length) * 100) / 100;
    const ordered = [...pot.winners].sort((a, b) => ((a - s.button + s.seats.length) % s.seats.length) - ((b - s.button + s.seats.length) % s.seats.length));
    for (const w of ordered) {
      const extra = remainder > 0 ? Math.min(remainder, 0.01) : 0;
      remainder = Math.round((remainder - extra) * 100) / 100;
      collected[w] = (collected[w] ?? 0) + share + extra;
    }
  }
  for (const [w, amt] of Object.entries(collected)) s.seats[Number(w)]!.stack += amt;
  const net: Record<number, number> = {};
  for (const x of s.seats) if (!x.out) net[x.index] = Math.round(((collected[x.index] ?? 0) - start[x.index]! + (returned?.seat === x.index ? returned.amount : 0)) * 100) / 100;
  s.result = {
    pots,
    net,
    collected,
    showdown: showdown && contenders.length > 1,
    shown: showdown && contenders.length > 1 ? contenders.map((x) => x.index) : [],
    handNames,
    returned,
  };
  return s;
}

/** Seats still in the hand (not folded). */
export function liveSeats(s: HandState): TableSeat[] {
  return live(s);
}
