/**
 * Realistic postflop spot generator: seats, stack depth, preflop action (from the charts), pot,
 * board and the action so far. Ranges are narrowed street by street, and hero is dealt a hand
 * from the range hero would actually have after that line.
 */
import { indexToString } from '../cards';
import type { Chart } from '../preflop/charts';
import { COMBOS, parseRange, type Range } from '../range';
import type { Rng } from '../rng';
import { HERO_LINE_MODEL, type VillainModel } from '../strategy/villainModel';
import type { Bucket } from './buckets';
import { bettingRange, checkingRange, classifyRange, continuingRange, type Street } from './narrow';

export type PotType = 'srp' | '3bet' | 'limped' | 'multiway';
export type Theme = 'cbet' | 'value' | 'bluff' | 'facing' | 'reading' | 'short';

export const POT_TYPE_NAMES: Record<PotType, string> = { srp: 'Single-raised', '3bet': '3-bet pot', limped: 'Limped pot', multiway: 'Multi-way' };
export const THEME_NAMES: Record<Theme, string> = {
  cbet: 'Continuation bets',
  value: 'Value betting',
  bluff: 'Bluffing',
  facing: 'Facing bets',
  reading: 'Hand reading',
  short: 'Short stack (~40bb)',
};

/** Loose limping range used for limped pots (home-game style). */
export const LIMP_RANGE = '22-99, A2s-AJs, K2s+, Q5s+, J7s+, T7s+, 97s+, 86s+, 75s+, 64s+, 54s, A2o-AJo, K9o+, Q9o+, J9o+, T9o';
/** Big blind's range when it checks its option in a limped pot (everything it wouldn't raise). */
export const BB_CHECK_RANGE = 'random, TT+@0, AQs+@0, AKo@0';

export interface Player {
  seat: string;
  range: Range;
  stack: number;
  /** Preflop aggressor. */
  aggressor: boolean;
}

export interface HistoryLine {
  street: Street | 'preflop';
  text: string;
}

export interface Spot {
  theme: Theme;
  potType: PotType;
  street: Street;
  stackBb: number;
  board: number[];
  hero: [number, number];
  heroSeat: string;
  heroRange: Range;
  heroIP: boolean;
  heroAggressor: boolean;
  villains: Player[];
  pot: number;
  effectiveStack: number;
  /** Villain's bet this street (as bb), when hero faces a bet. */
  facingBet: number | null;
  /** True if villain checked to hero this street. */
  checkedTo: boolean;
  history: HistoryLine[];
  /** Villain's range at each street (for hand reading), with labels. */
  rangeTrail: { label: string; range: Range }[];
  model: VillainModel;
}

/** Postflop acting order: blinds first, button last. */
const POSTFLOP_ORDER = ['SB', 'BB', 'UTG', 'UTG+1', 'MP', 'LJ', 'HJ', 'CO', 'BTN'];
export const actsAfter = (a: string, b: string) => POSTFLOP_ORDER.indexOf(a) > POSTFLOP_ORDER.indexOf(b);

const pick = <T>(rng: Rng, items: readonly T[]): T => items[Math.floor(rng() * items.length)]!;

export interface SpotOptions {
  theme: Theme;
  street?: Street;
  potType?: PotType;
  stackBb?: number;
  chart: Chart;
  model: VillainModel;
  /** Buckets hero's hand must come from (theme default if omitted). */
  heroBuckets?: readonly Bucket[];
  /** Force a bet-size range when hero faces a bet, as a pot fraction. */
  facingSize?: [number, number];
}

const THEME_BUCKETS: Record<Theme, readonly Bucket[]> = {
  cbet: ['monster', 'strong', 'medium', 'draw', 'weak', 'air'],
  value: ['monster', 'strong', 'medium'],
  bluff: ['air', 'draw', 'weak'],
  facing: ['monster', 'strong', 'medium', 'draw', 'weak', 'air'],
  reading: ['monster', 'strong', 'medium', 'draw', 'weak', 'air'],
  short: ['monster', 'strong', 'medium', 'draw'],
};

interface Preflop {
  potType: PotType;
  pot: number;
  stack: number;
  aggressor: Player;
  others: Player[];
  text: string;
}

function preflop(rng: Rng, chart: Chart, potType: PotType, stackBb: number): Preflop | null {
  const deadBlinds = (involved: string[]) => (involved.includes('SB') ? 0 : 0.5) + (involved.includes('BB') ? 0 : 1);
  if (potType === 'limped') {
    const sb: Player = { seat: 'SB', range: parseRange(LIMP_RANGE), stack: stackBb - 1, aggressor: false };
    const bb: Player = { seat: 'BB', range: parseRange(BB_CHECK_RANGE), stack: stackBb - 1, aggressor: false };
    return { potType, pot: 2, stack: stackBb - 1, aggressor: sb, others: [bb], text: 'SB limps, BB checks.' };
  }
  const pairs = chart.facingOpenPairs().filter((p) => {
    const s = chart.vsOpen(p.seat, p.opener)!;
    return potType === '3bet' ? chart.vs3bet(p.opener) && s.notation['3bet'] : s.notation.call;
  });
  if (!pairs.length) return null;
  const { seat, opener } = pick(rng, pairs);
  const facing = chart.vsOpen(seat, opener)!;
  const open = chart.openSize(opener);
  if (potType === '3bet') {
    const ip = actsAfter(seat, opener);
    const size = Math.min(stackBb, Math.round(open * (ip ? 3 : 4) * 2) / 2);
    const threeBettor: Player = { seat, range: facing.ranges['3bet']!, stack: stackBb - size, aggressor: true };
    const caller: Player = { seat: opener, range: chart.vs3bet(opener)!.ranges.call!, stack: stackBb - size, aggressor: false };
    return {
      potType,
      pot: size * 2 + deadBlinds([seat, opener]),
      stack: stackBb - size,
      aggressor: threeBettor,
      others: [caller],
      text: `${opener} opens to ${open}bb, ${seat} 3-bets to ${size}bb, ${opener} calls.`,
    };
  }
  const openerP: Player = { seat: opener, range: chart.rfi(opener)!.ranges.raise!, stack: stackBb - open, aggressor: true };
  const callerP: Player = { seat, range: facing.ranges.call!, stack: stackBb - open, aggressor: false };
  if (potType === 'multiway') {
    const extra = chart
      .facingOpenPairs()
      .filter((p) => p.opener === opener && p.seat !== seat && chart.vsOpen(p.seat, opener)!.notation.call);
    if (!extra.length) return null;
    const e = pick(rng, extra);
    const ep: Player = { seat: e.seat, range: chart.vsOpen(e.seat, opener)!.ranges.call!, stack: stackBb - open, aggressor: false };
    const seatsOrder = chart.seats;
    const callers = [callerP, ep].sort((a, b) => seatsOrder.indexOf(a.seat) - seatsOrder.indexOf(b.seat));
    return {
      potType,
      pot: open * 3 + deadBlinds([opener, seat, e.seat]),
      stack: stackBb - open,
      aggressor: openerP,
      others: callers,
      text: `${opener} opens to ${open}bb, ${callers[0]!.seat} and ${callers[1]!.seat} call.`,
    };
  }
  return {
    potType,
    pot: open * 2 + deadBlinds([opener, seat]),
    stack: stackBb - open,
    aggressor: openerP,
    others: [callerP],
    text: `${opener} opens to ${open}bb, ${seat} calls.`,
  };
}

function randomBoard(rng: Rng, n: number): number[] {
  const deck = Array.from({ length: 52 }, (_, i) => i);
  const out: number[] = [];
  while (out.length < n) {
    const i = Math.floor(rng() * deck.length);
    out.push(deck.splice(i, 1)[0]!);
  }
  return out;
}

const fmt = (x: number) => (Number.isInteger(x) ? String(x) : x.toFixed(1));
export const cardText = (cards: readonly number[]) => cards.map((c) => `{${indexToString(c)}}`).join(' ');

/** Build a spot. Throws if the options are impossible for this chart. */
export function generateSpot(rng: Rng, opts: SpotOptions): Spot {
  const theme = opts.theme;
  const stackBb = opts.stackBb ?? (theme === 'short' ? 40 : 100);
  for (let attempt = 0; attempt < 60; attempt++) {
    let potType: PotType = opts.potType ?? pick(rng, ['srp', 'srp', 'srp', '3bet', 'limped', 'multiway'] as const);
    if (theme === 'cbet' && potType === 'limped') potType = 'srp';
    // Short-stack spots are about low SPR: raised pots only.
    if (theme === 'short' && (potType === 'limped' || potType === 'multiway')) potType = rng() < 0.7 ? 'srp' : '3bet';
    const street: Street = opts.street ?? (theme === 'value' ? pick(rng, ['turn', 'river', 'river'] as const) : theme === 'cbet' ? pick(rng, ['flop', 'flop', 'turn'] as const) : pick(rng, ['flop', 'turn', 'river'] as const));
    const pre = preflop(rng, opts.chart, potType, stackBb);
    if (!pre) continue;
    const players = [pre.aggressor, ...pre.others];

    // Choose hero's seat by theme.
    let heroP: Player;
    if (theme === 'cbet') heroP = pre.aggressor;
    else if (theme === 'facing') heroP = pre.potType === 'limped' ? pick(rng, players) : pick(rng, pre.others);
    else heroP = pick(rng, players);
    const villains = players.filter((p) => p !== heroP).map((p) => ({ ...p }));
    const hero = { ...heroP };

    const boardAll = randomBoard(rng, 5);
    const nBoard = street === 'flop' ? 3 : street === 'turn' ? 4 : 5;
    const board = boardAll.slice(0, nBoard);
    let pot = pre.pot;
    let stack = pre.stack;
    const history: HistoryLine[] = [{ street: 'preflop', text: pre.text }];
    const rangeTrail: { label: string; range: Range }[] = [{ label: 'Preflop', range: villains[0]!.range }];
    const bettor = pre.potType === 'limped' ? players[1]! : pre.aggressor;

    // Earlier streets: the preflop aggressor (or BB in limped pots) bets and gets called, or it checks through.
    for (const s of ['flop', 'turn'] as const) {
      if ((s === 'flop' && nBoard === 3) || (s === 'turn' && nBoard === 4)) break;
      const b = s === 'flop' ? board.slice(0, 3) : board.slice(0, 4);
      const betFrac = s === 'flop' ? pick(rng, [0.33, 0.5]) : pick(rng, [0.5, 0.66, 0.75]);
      const checkThrough = rng() < (theme === 'value' ? 0.35 : 0.25);
      const all = [hero, ...villains];
      if (checkThrough) {
        for (const p of all) p.range = checkingRange(classifyRange(p.range, b), betFrac, p === hero ? HERO_LINE_MODEL : opts.model, s);
        history.push({ street: s, text: `${cardText(b.slice(s === 'flop' ? 0 : 3))} — checks through.` });
      } else {
        const bet = Math.min(stack, Math.round(pot * betFrac * 2) / 2);
        for (const p of all) {
          const model = p === hero ? HERO_LINE_MODEL : opts.model;
          const combos = classifyRange(p.range, b);
          p.range = p.seat === bettor.seat ? bettingRange(combos, betFrac, model, s) : continuingRange(combos, betFrac, model);
        }
        pot += bet * (all.length);
        stack -= bet;
        const callers = all.filter((p) => p.seat !== bettor.seat).map((p) => (p === hero ? 'you' : p.seat));
        history.push({
          street: s,
          text: `${cardText(b.slice(s === 'flop' ? 0 : 3))} — ${bettor === heroP ? 'you bet' : `${bettor.seat} bets`} ${fmt(bet)}bb (${Math.round(betFrac * 100)}% pot), ${callers.join(' and ')} call${callers.length === 1 && callers[0] !== 'you' ? 's' : ''}.`,
        });
      }
      rangeTrail.push({ label: s === 'flop' ? 'After flop' : 'After turn', range: villains[0]!.range });
    }
    if (stack <= 0.5) continue;

    // This street: who acts, and does hero face a bet?
    const heroIP = villains.every((v) => actsAfter(hero.seat, v.seat));
    let facingBet: number | null = null;
    let checkedTo = false;
    if (theme === 'facing' || (theme === 'reading' && rng() < 0.5)) {
      const [lo, hi] = opts.facingSize ?? [0.33, 1];
      const frac = Math.round((lo + rng() * (hi - lo)) * 100) / 100;
      facingBet = Math.min(stack, Math.max(1, Math.round(pot * frac * 2) / 2));
      const v = villains[0]!;
      v.range = bettingRange(classifyRange(v.range, board), facingBet / pot, opts.model, street);
      rangeTrail.push({ label: `Bets ${Math.round((facingBet / pot) * 100)}% pot`, range: v.range });
    } else if (heroIP) {
      checkedTo = true;
      for (const v of villains) v.range = checkingRange(classifyRange(v.range, board), 0.5, opts.model, street);
      rangeTrail.push({ label: 'Checks', range: villains[0]!.range });
    }

    // Deal hero a hand from hero's own (narrowed) range, restricted to the theme's buckets.
    const buckets = opts.heroBuckets ?? THEME_BUCKETS[theme];
    const candidates = classifyRange(hero.range, board).filter((c) => buckets.includes(c.info.bucket));
    const total = candidates.reduce((s, c) => s + c.weight, 0);
    if (total <= 0) continue;
    let x = rng() * total;
    let chosen = candidates[0]!;
    for (const c of candidates) {
      x -= c.weight;
      if (x <= 0) {
        chosen = c;
        break;
      }
    }
    const heroCombo: [number, number] = [COMBOS[chosen.index]!.c1, COMBOS[chosen.index]!.c2];

    return {
      theme,
      potType: pre.potType,
      street,
      stackBb,
      board,
      hero: heroCombo,
      heroSeat: hero.seat,
      heroRange: hero.range,
      heroIP,
      heroAggressor: hero.aggressor,
      villains,
      pot,
      effectiveStack: stack,
      facingBet,
      checkedTo,
      history,
      rangeTrail,
      model: opts.model,
    };
  }
  throw new Error('Could not build a postflop spot with these filters');
}
