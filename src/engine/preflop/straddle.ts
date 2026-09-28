/**
 * Straddles, simplified and documented:
 * - A UTG straddle posts 2bb and acts last preflop (it has an option, like the big blind).
 * - Blinds and stacks are then measured in straddles: 40bb stacks play like 20 "big blinds".
 * - For chart lookups, each non-blind seat reads as the chart seat with the SAME NUMBER OF PLAYERS
 *   LEFT TO ACT behind it (the straddler adds one), so everyone plays one seat tighter. Both real
 *   blinds read as the SB (out of position, dead money in), and the straddler reads as the BB.
 * This is an approximation: postflop the button still has position, and the charts were built for
 * unstraddled games.
 */

export interface StraddleView {
  /** Physical seat -> chart seat for preflop spots. */
  seatMap: Record<string, string>;
  /** Stack depth measured in straddles. */
  effectiveStack: number;
  /** Preflop acting order with the straddle (straddler last). */
  preflopOrder: string[];
}

/** Default straddle size in big blinds. */
export const STRADDLE_BB = 2;

/**
 * @param seats chart seat order, first to act preflop through BB (e.g. UTG … BTN, SB, BB)
 * @param stackBb stacks in big blinds
 */
export function straddleView(seats: readonly string[], stackBb: number, straddleBb = STRADDLE_BB): StraddleView {
  const straddler = seats[0]!;
  const nonBlind = seats.filter((s) => s !== 'SB' && s !== 'BB');
  const order = [...seats.slice(1), straddler];
  const seatMap: Record<string, string> = { [straddler]: 'BB', SB: 'SB', BB: 'SB' };
  // Players left to act behind each seat in the new order; chart seat with the same number behind.
  const behindInChart = (seat: string) => seats.length - 1 - seats.indexOf(seat);
  for (const seat of nonBlind.slice(1)) {
    const behind = order.length - 1 - order.indexOf(seat);
    seatMap[seat] = seats.find((s) => behindInChart(s) === behind) ?? seat;
  }
  return { seatMap, effectiveStack: stackBb / straddleBb, preflopOrder: order };
}
