/** What the table could observe about hero in a finished hand (feeds updateImage). */
import { classifyHand } from '../postflop/buckets';
import type { HandState } from '../game/holdem';
import type { HandImageEvents, ShowdownKind } from './image';

export function imageEventsFromHand(hand: HandState, seat: number): HandImageEvents {
  const mine = hand.log.filter((e) => e.seat === seat && !e.type.startsWith('post'));
  const played = mine.some((e) => e.street === 'preflop' && (e.type === 'call' || e.type === 'raise' || e.type === 'bet'));
  const aggressive = mine.filter((e) => e.type === 'bet' || e.type === 'raise').length;
  const passive = mine.filter((e) => e.type === 'call' || e.type === 'check').length;
  const won = (hand.result?.net[seat] ?? 0) > 0;
  let showed: ShowdownKind = 'none';
  const me = hand.seats[seat]!;
  if (hand.result?.shown.includes(seat) && hand.board.length >= 3 && me.hole.length === 2) {
    const bucket = classifyHand(me.hole[0]!, me.hole[1]!, hand.board).bucket;
    const lastStreet = hand.log[hand.log.length - 1]?.street;
    const betLast = mine.some((e) => e.street === lastStreet && (e.type === 'bet' || e.type === 'raise'));
    if (bucket === 'monster') showed = 'big';
    else if ((bucket === 'air' || bucket === 'weak') && betLast) showed = 'bluff';
    else if ((bucket === 'air' || bucket === 'weak') && won) showed = 'weak-win';
  }
  return { played, aggressive, passive, won, showed };
}
