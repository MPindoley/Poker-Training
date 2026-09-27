/**
 * Tracks each opponent's likely range through a hand, from their profile and their actions.
 * The coach and the hand review use these ranges.
 */
import { parseRange, type Range } from '../range';
import { statsPreflopRanges } from '../exploit/profiles';
import { topRange } from '../preflop/ranking';
import { bettingRange, checkingRange, classifyRange, continuingRange } from '../postflop/narrow';
import { forStreet } from '../strategy/villainModel';
import type { ActionEvent, HandState } from './holdem';
import type { BotProfile } from './bots';

export type RangeMap = Record<number, Range>;

export function initialRanges(s: HandState): RangeMap {
  const all = parseRange('random');
  return Object.fromEntries(s.seats.filter((x) => !x.out).map((x) => [x.index, all]));
}

function subtract(a: Range, b: Range): Range {
  const w = new Float64Array(1326);
  for (let i = 0; i < 1326; i++) w[i] = Math.max(0, a.weights[i]! - b.weights[i]!);
  return { weights: w };
}

/** Update ranges after `event` (which happened in `before`). */
export function updateRanges(ranges: RangeMap, before: HandState, event: ActionEvent, bots: Record<number, BotProfile | undefined>): RangeMap {
  const bot = bots[event.seat];
  if (!bot || event.type === 'post-sb' || event.type === 'post-bb') return ranges;
  const next = { ...ranges };
  const cur = ranges[event.seat]!;
  if (event.street === 'preflop') {
    const { raise, call } = statsPreflopRanges(bot.stats);
    const raisesBefore = before.log.filter((e) => e.street === 'preflop' && (e.type === 'raise' || e.type === 'bet')).length;
    if (event.type === 'raise' || event.type === 'bet') next[event.seat] = raisesBefore === 0 ? raise : topRange(Math.max(0.02, bot.stats.pfr * 0.3));
    else if (event.type === 'call') next[event.seat] = raisesBefore === 0 ? call : subtract(topRange(Math.min(1, bot.stats.vpip * 0.7)), topRange(bot.stats.pfr * 0.3));
    else if (event.type === 'check') next[event.seat] = subtract(cur, raise);
    return next;
  }
  const model = forStreet(bot.model, event.street);
  const combos = classifyRange(cur, before.board);
  const potBefore = event.potBefore;
  const toCallBefore = Math.max(0, before.currentBet - before.seats[event.seat]!.bet);
  if (event.type === 'bet' || event.type === 'raise') next[event.seat] = bettingRange(combos, Math.max(0.2, (event.to - before.seats[event.seat]!.bet) / Math.max(1, potBefore)), model, event.street);
  else if (event.type === 'call') next[event.seat] = continuingRange(combos, toCallBefore / Math.max(1, potBefore - toCallBefore), model);
  else if (event.type === 'check') next[event.seat] = checkingRange(combos, 0.5, model, event.street);
  return next;
}
