/**
 * "Replay my spot": turn a hand from a real game into a Spot the analyser understands.
 * Ranges come from the preflop charts plus the villain model for each street's action.
 */
import { parseCardIndices } from '../cards';
import type { Chart } from '../preflop/charts';
import { parseRange, type Range } from '../range';
import { HERO_LINE_MODEL, forStreet, type VillainModel } from '../strategy/villainModel';
import { bettingRange, checkingRange, classifyRange, continuingRange, streetOf, type Street } from './narrow';
import { BB_CHECK_RANGE, LIMP_RANGE, actsAfter, cardText, type HistoryLine, type Spot, type Theme } from './scenario';

export type PreflopLine = 'hero-open' | 'villain-open' | 'hero-3bet' | 'villain-3bet' | 'limped';
export type StreetLine = 'hero-bet-call' | 'villain-bet-call' | 'check-check';

export interface ReplayInput {
  hero: string;
  board: string;
  heroSeat: string;
  villainSeat: string;
  preflop: PreflopLine;
  /** What happened on each earlier street (flop, then turn), in order. */
  earlier: StreetLine[];
  pot: number;
  effectiveStack: number;
  /** Villain's bet this street, if hero is facing one. */
  facingBet: number | null;
  model: VillainModel;
}

/** Hero and villain preflop ranges for a two-player preflop line, from the charts. */
export function preflopLineRanges(chart: Chart, i: Pick<ReplayInput, 'heroSeat' | 'villainSeat' | 'preflop'>): { hero: Range; villain: Range; heroAggressor: boolean } {
  const any = parseRange('random');
  const or = (r: Range | undefined) => r ?? any;
  switch (i.preflop) {
    case 'hero-open':
      return { hero: or(chart.rfi(i.heroSeat)?.ranges.raise), villain: or(chart.vsOpen(i.villainSeat, i.heroSeat)?.ranges.call), heroAggressor: true };
    case 'villain-open':
      return { hero: or(chart.vsOpen(i.heroSeat, i.villainSeat)?.ranges.call), villain: or(chart.rfi(i.villainSeat)?.ranges.raise), heroAggressor: false };
    case 'hero-3bet':
      return { hero: or(chart.vsOpen(i.heroSeat, i.villainSeat)?.ranges['3bet']), villain: or(chart.vs3bet(i.villainSeat)?.ranges.call), heroAggressor: true };
    case 'villain-3bet':
      return { hero: or(chart.vs3bet(i.heroSeat)?.ranges.call), villain: or(chart.vsOpen(i.villainSeat, i.heroSeat)?.ranges['3bet']), heroAggressor: false };
    default:
      return {
        hero: parseRange(i.heroSeat === 'BB' ? BB_CHECK_RANGE : LIMP_RANGE),
        villain: parseRange(i.villainSeat === 'BB' ? BB_CHECK_RANGE : LIMP_RANGE),
        heroAggressor: false,
      };
  }
}

export function buildReplaySpot(chart: Chart, input: ReplayInput, theme?: Theme): Spot {
  const hero = parseCardIndices(input.hero);
  const board = parseCardIndices(input.board);
  if (hero.length !== 2) throw new Error('Enter your two cards');
  if (board.length < 3 || board.length > 5) throw new Error('Enter a flop, turn or river board');
  if (new Set([...hero, ...board]).size !== hero.length + board.length) throw new Error('A card appears twice');
  const street = streetOf(board);
  const pre = preflopLineRanges(chart, input);
  let heroRange = pre.hero;
  let villainRange = pre.villain;
  const history: HistoryLine[] = [{ street: 'preflop', text: `${input.preflop.replace('-', ' ')} (${input.heroSeat} vs ${input.villainSeat})` }];
  const trail = [{ label: 'Preflop', range: villainRange }];
  const streets: Street[] = ['flop', 'turn'];
  input.earlier.slice(0, board.length - 3).forEach((line, k) => {
    const s = streets[k]!;
    const b = board.slice(0, 3 + k);
    const hc = classifyRange(heroRange, b);
    const vc = classifyRange(villainRange, b);
    if (line === 'check-check') {
      heroRange = checkingRange(hc, 0.5, HERO_LINE_MODEL, s);
      villainRange = checkingRange(vc, 0.5, forStreet(input.model, s), s);
    } else if (line === 'hero-bet-call') {
      heroRange = bettingRange(hc, 0.5, HERO_LINE_MODEL, s);
      villainRange = continuingRange(vc, 0.5, forStreet(input.model, s));
    } else {
      villainRange = bettingRange(vc, 0.5, forStreet(input.model, s), s);
      heroRange = continuingRange(hc, 0.5, HERO_LINE_MODEL);
    }
    history.push({ street: s, text: `${cardText(b.slice(k === 0 ? 0 : 2 + k))} — ${line.replace(/-/g, ' ')}` });
    trail.push({ label: `After ${s}`, range: villainRange });
  });
  const heroIP = actsAfter(input.heroSeat, input.villainSeat);
  if (input.facingBet !== null) {
    villainRange = bettingRange(classifyRange(villainRange, board), input.facingBet / input.pot, forStreet(input.model, street), street);
    trail.push({ label: 'Bets now', range: villainRange });
  } else if (heroIP) {
    villainRange = checkingRange(classifyRange(villainRange, board), 0.5, forStreet(input.model, street), street);
    trail.push({ label: 'Checks', range: villainRange });
  }
  return {
    theme: theme ?? (input.facingBet !== null ? 'facing' : pre.heroAggressor ? 'cbet' : 'value'),
    potType: input.preflop === 'limped' ? 'limped' : input.preflop.includes('3bet') ? '3bet' : 'srp',
    street,
    stackBb: input.effectiveStack + input.pot / 2,
    board,
    hero: [hero[0]!, hero[1]!],
    heroSeat: input.heroSeat,
    heroRange,
    heroIP,
    heroAggressor: pre.heroAggressor,
    villains: [{ seat: input.villainSeat, range: villainRange, stack: input.effectiveStack, aggressor: !pre.heroAggressor }],
    pot: input.pot,
    effectiveStack: input.effectiveStack,
    facingBet: input.facingBet,
    checkedTo: input.facingBet === null && heroIP,
    history,
    rangeTrail: trail,
    model: input.model,
  };
}
