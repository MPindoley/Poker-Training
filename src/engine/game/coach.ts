/**
 * Coach and hand review for the Play tab: chart advice preflop, full spot analysis postflop,
 * grading of your actual actions, and all-in adjusted results (luck vs skill).
 */
import { calculateEquity } from '../equity';
import type { Grade } from '../grading';
import { formatPercent } from '../math';
import { potOdds } from '../odds';
import type { Chart, HandStrategy, PreflopAction } from '../preflop/charts';
import { strategyFor } from '../preflop/charts';
import { ACTION_NAMES } from '../preflop/reasons';
import { parseRange } from '../range';
import type { Spot } from '../postflop/scenario';
import { REGULAR_MODEL } from '../strategy/villainModel';
import type { OptionEval, SpotAnalysis } from '../strategy/analyze';
import { indexToString } from '../cards';
import type { ActionEvent, HandState } from './holdem';
import { potSize } from './holdem';
import { holeLabel, type BotProfile } from './bots';
import type { RangeMap } from './tracker';

const SIX_MAX_ALIAS: Record<string, string> = { 'UTG+1': 'UTG', MP: 'UTG', LJ: 'UTG' };
const seatName = (chart: Chart, pos: string) => (chart.seats.includes(pos) ? pos : SIX_MAX_ALIAS[pos] ?? pos);

export interface PreflopAdvice {
  situation: string;
  label: string;
  strategy: HandStrategy | null;
  best: PreflopAction | null;
  /** Equity needed to call, when facing a raise. */
  price: number | null;
  kind: 'rfi' | 'vsOpen' | 'vs3bet' | 'none';
}

/** Chart-based advice for hero's preflop decision. */
export function preflopAdvice(s: HandState, heroSeat: number, chart: Chart, positions: Record<number, string>): PreflopAdvice {
  const hero = s.seats[heroSeat]!;
  const label = holeLabel(hero.hole);
  const raises = s.log.filter((e) => e.street === 'preflop' && (e.type === 'raise' || e.type === 'bet'));
  const me = seatName(chart, positions[heroSeat]!);
  const toCall = Math.max(0, s.currentBet - hero.bet);
  const price = toCall > 0 ? potOdds(potSize(s), toCall).requiredEquity : null;
  let spot = null;
  let kind: PreflopAdvice['kind'] = 'none';
  let situation = '';
  if (raises.length === 0) {
    spot = chart.rfi(me);
    kind = spot ? 'rfi' : 'none';
    situation = me === 'BB' ? 'Limped to you in the big blind' : `First in from the ${me}`;
  } else if (raises.length === 1 && s.log.some((e) => e.street === 'preflop' && e.seat === heroSeat && e.type === 'call')) {
    situation = 'You limped and now face a raise — continue only with strong hands';
  } else if (raises.length === 1 && raises[0]!.seat !== heroSeat) {
    const opener = seatName(chart, positions[raises[0]!.seat]!);
    spot = chart.vsOpen(me, opener);
    kind = spot ? 'vsOpen' : 'none';
    situation = `${opener} opened, you're in the ${me}`;
  } else if (raises.length === 2 && raises[0]!.seat === heroSeat) {
    spot = chart.vs3bet(me);
    kind = spot ? 'vs3bet' : 'none';
    situation = `You opened from the ${me} and face a 3-bet`;
  } else {
    situation = 'Multiple raises — play only premium hands';
  }
  const strategy = spot ? strategyFor(spot, label) : null;
  return { situation, label, strategy, best: strategy?.main ?? null, price, kind };
}

/** Map hero's preflop action to the chart action it represents. */
export function chartAction(kind: PreflopAdvice['kind'], type: ActionEvent['type']): PreflopAction {
  if (type === 'fold') return 'fold';
  if (type === 'call' || type === 'check') return kind === 'rfi' ? (type === 'check' ? 'fold' : 'limp') : 'call';
  if (kind === 'vsOpen') return '3bet';
  if (kind === 'vs3bet') return '4bet';
  return 'raise';
}

export function gradePreflop(advice: PreflopAdvice, type: ActionEvent['type']): { grade: Grade; note: string } | null {
  if (!advice.strategy) return null;
  const a = chartAction(advice.kind, type);
  // Checking the big blind's option is always fine.
  if (advice.kind === 'rfi' && type === 'check') return { grade: 'best', note: 'Free flop in the big blind.' };
  const f = advice.strategy.freq[a] ?? 0;
  const grade: Grade = a === advice.strategy.main ? 'best' : f >= 0.25 ? 'acceptable' : 'mistake';
  const chartSays = (Object.entries(advice.strategy.freq) as [PreflopAction, number][])
    .filter(([, v]) => v > 0.005)
    .map(([k, v]) => `${ACTION_NAMES[k]} ${formatPercent(v, 0)}`)
    .join(', ');
  return { grade, note: `${advice.situation}: chart plays ${advice.label} as ${chartSays}.` };
}

/** Build the analyser's Spot from the live table (postflop). */
export function spotFromGame(s: HandState, heroSeat: number, ranges: RangeMap, bots: Record<number, BotProfile | undefined>, positions: Record<number, string>): Spot {
  const hero = s.seats[heroSeat]!;
  const opponents = s.seats.filter((x) => !x.out && !x.folded && x.index !== heroSeat);
  const toCall = Math.max(0, s.currentBet - hero.bet);
  const pot = potSize(s);
  const lastAggressor = [...s.log].reverse().find((e) => (e.type === 'bet' || e.type === 'raise') && e.seat !== heroSeat)?.seat;
  const modelBot = bots[lastAggressor ?? opponents[0]!.index];
  const n = s.seats.length;
  const order = (i: number) => (i - s.button - 1 + n) % n; // postflop order: left of button first
  const heroIP = opponents.every((o) => order(heroSeat) > order(o.index));
  const street = s.board.length === 3 ? 'flop' : s.board.length === 4 ? 'turn' : 'river';
  const effectiveStack = Math.min(hero.stack, Math.max(...opponents.map((o) => o.stack + o.bet - hero.bet), 0));
  return {
    theme: toCall > 0 ? 'facing' : 'value',
    potType: s.log.filter((e) => e.street === 'preflop' && e.type === 'raise').length >= 2 ? '3bet' : opponents.length > 1 ? 'multiway' : 'srp',
    street,
    stackBb: hero.stack + hero.totalIn,
    board: [...s.board],
    hero: [hero.hole[0]!, hero.hole[1]!],
    heroSeat: positions[heroSeat] ?? `Seat ${heroSeat}`,
    heroRange: parseRange('random'),
    heroIP,
    heroAggressor: false,
    villains: opponents.map((o) => ({ seat: positions[o.index] ?? o.name, range: ranges[o.index]!, stack: o.stack, aggressor: false })),
    pot: pot - toCall,
    effectiveStack: Math.max(0.5, effectiveStack),
    facingBet: toCall > 0 ? Math.min(toCall, hero.stack) : null,
    checkedTo: toCall === 0 && heroIP,
    history: [],
    rangeTrail: [],
    model: modelBot?.model ?? REGULAR_MODEL,
  };
}

/** Find the analysed option closest to what hero actually did. */
export function matchOption(a: SpotAnalysis, type: ActionEvent['type'], amount: number): OptionEval | undefined {
  const by = (act: OptionEval['action']) => a.options.filter((o) => o.action === act);
  if (type === 'fold') return by('fold')[0];
  if (type === 'check') return by('check')[0];
  if (type === 'call') return by('call')[0];
  const aggressive = [...by('bet'), ...by('raise')];
  return aggressive.sort((x, y) => Math.abs(x.amount - amount) - Math.abs(y.amount - amount))[0];
}

export interface AllInResult {
  actual: number;
  expected: number;
  equity: number;
}

/**
 * All-in adjusted result: when the money went in with cards to come, use hero's equity at that
 * moment (vs the actual hands) instead of the actual run-out.
 */
export function allInAdjusted(s: HandState, heroSeat: number): AllInResult | null {
  if (!s.finished || !s.result || s.allInBoardSize === null) return null;
  const hero = s.seats[heroSeat]!;
  if (hero.folded || hero.out) return null;
  const board = s.board.slice(0, s.allInBoardSize).map(indexToString).join('');
  let expected = 0;
  let equityShown = 0;
  for (const pot of s.result.pots) {
    if (!pot.eligible.includes(heroSeat)) continue;
    const players = [heroSeat, ...pot.eligible.filter((i) => i !== heroSeat)];
    const eq = players.length === 1 ? 1 : calculateEquity(players.map((i) => s.seats[i]!.hole.map(indexToString).join('')), { board }).players[0]!.equity;
    if (pot === s.result.pots[0]) equityShown = eq;
    expected += eq * pot.amount;
  }
  return { actual: s.result.net[heroSeat] ?? 0, expected: Math.round((expected - hero.totalIn) * 100) / 100, equity: equityShown };
}

/** Facts about a decision that the leak finder groups on. */
export interface DecisionTags {
  facingBet: boolean;
  bucket?: string;
  heroPos?: string;
  villainArchetype?: string;
  villainFoldRiver?: number;
  chosenFraction?: number | null;
  bestFraction?: number | null;
  actionType: string;
  preflopKind?: 'rfi' | 'vsOpen' | 'vs3bet' | 'none';
}

export interface DecisionReview {
  street: ActionEvent['street'];
  tags?: DecisionTags;
  action: string;
  grade: Grade | null;
  evLost: number | null;
  equity: number | null;
  best: string | null;
  note: string;
}

export interface HandReview {
  handNo: number;
  heroCards: string[];
  board: string[];
  net: number;
  allIn: AllInResult | null;
  decisions: DecisionReview[];
}

export interface SessionSummary {
  hands: number;
  net: number;
  /** Net with all-in hands replaced by their expected result. */
  adjustedNet: number;
  /** net − adjustedNet: positive = ran above expectation. */
  luck: number;
  evLost: number;
  grades: Record<Grade, number>;
  biggestMistakes: (DecisionReview & { handNo: number })[];
}

export function summarizeSession(hands: HandReview[]): SessionSummary {
  const grades: Record<Grade, number> = { best: 0, acceptable: 0, mistake: 0 };
  let net = 0;
  let adjusted = 0;
  let evLost = 0;
  const mistakes: (DecisionReview & { handNo: number })[] = [];
  for (const h of hands) {
    net += h.net;
    adjusted += h.allIn ? h.allIn.expected : h.net;
    for (const d of h.decisions) {
      if (d.grade) grades[d.grade]++;
      if (d.evLost) evLost += d.evLost;
      if (d.grade === 'mistake') mistakes.push({ ...d, handNo: h.handNo });
    }
  }
  mistakes.sort((a, b) => (b.evLost ?? 0.1) - (a.evLost ?? 0.1));
  const r = (x: number) => Math.round(x * 100) / 100;
  return { hands: hands.length, net: r(net), adjustedNet: r(adjusted), luck: r(net - adjusted), evLost: r(evLost), grades, biggestMistakes: mistakes.slice(0, 3) };
}

export function describeAction(e: Pick<ActionEvent, 'type' | 'amount' | 'to'>): string {
  const bb = (x: number) => `${Math.round(x * 10) / 10}bb`;
  switch (e.type) {
    case 'fold':
      return 'Fold';
    case 'check':
      return 'Check';
    case 'call':
      return `Call ${bb(e.amount)}`;
    case 'bet':
      return `Bet ${bb(e.to)}`;
    case 'raise':
      return `Raise to ${bb(e.to)}`;
    default:
      return e.type;
  }
}
