/**
 * Open-size rules. Kept as readable data so they can be reviewed and adjusted.
 *
 * Casino (100bb, competent players): 2.5bb from most seats, 3bb from the SB (out of position).
 * With limpers: add 1bb per limper to your normal isolation size (3bb + 1bb per limper).
 * Home game (loose-passive, calls too much): open bigger — 4bb, +1bb per limper — because
 * players who call too often pay more with worse hands and the pot gets fewer callers.
 */
import { requiredEquity } from '../odds';

export type GameMode = 'casino' | 'home';

export interface SizingRule {
  best: number;
  acceptable: number[];
  reason: string;
}

export function sizingRule(mode: GameMode, seat: string, limpers: number): SizingRule {
  if (mode === 'home') {
    if (limpers > 0)
      return {
        best: 4 + limpers,
        acceptable: [3 + limpers, 5 + limpers],
        reason: `Loose-passive players call too much, so isolate big: 4bb plus 1bb per limper (${4 + limpers}bb).`,
      };
    return { best: 4, acceptable: [3, 3.5, 5], reason: 'Against tables that call too much, a bigger 4bb open charges their weak hands and thins the field.' };
  }
  if (limpers > 0)
    return {
      best: 3 + limpers,
      acceptable: [2.5 + limpers, 4 + limpers],
      reason: `Isolate limpers with 3bb plus 1bb per limper (${3 + limpers}bb) so you play heads-up with the initiative.`,
    };
  if (seat === 'SB') return { best: 3, acceptable: [2.5, 3.5], reason: 'From the SB you are out of position, so open a bit bigger (3bb) to give the BB a worse price.' };
  return { best: 2.5, acceptable: [2, 3], reason: 'A 2.5bb open risks less with the same fold equity; competent blinds defend correctly either way.' };
}

/**
 * Price the big blind gets to call an open of `openBb` (after `limpers` limped),
 * i.e. the equity it needs: call / (pot + bet + call).
 */
export function bigBlindPrice(openBb: number, limpers = 0, sbIn = 0.5): number {
  // Pot before the open: SB + BB (1, already ours) + limpers. BB has 1bb in already.
  return requiredEquity(sbIn + 1 + limpers, openBb, 1).requiredEquity;
}

/**
 * Squeeze sizing (an open plus callers before you). Readable constants:
 * in position about 3x the open + 1 open per caller; out of position about 4x + 1 per caller,
 * because you'll play the pot without position and want to charge more / take it down more often.
 */
export const SQUEEZE_SIZING = { ipOpenMultiple: 3, oopOpenMultiple: 4, perCaller: 1 } as const;

export function squeezeSize(openBb: number, callers: number, inPosition: boolean): SizingRule {
  const mult = inPosition ? SQUEEZE_SIZING.ipOpenMultiple : SQUEEZE_SIZING.oopOpenMultiple;
  const best = Math.round((openBb * (mult + SQUEEZE_SIZING.perCaller * callers)) * 2) / 2;
  const alt = (m: number) => Math.round(openBb * (m + callers) * 2) / 2;
  return {
    best,
    acceptable: [alt(mult - 0.5), alt(mult + 0.5)].filter((x) => x !== best),
    reason: `Squeeze to about ${mult}x the ${openBb}bb open plus ${SQUEEZE_SIZING.perCaller} open per caller (${callers}) ${inPosition ? 'in position' : 'out of position'}: ${openBb} × (${mult} + ${callers}) = ${best}bb. The dead money from the callers makes a bigger raise worth it, and ${inPosition ? 'position lets you use a slightly smaller size' : 'playing out of position needs a bigger one'}.`,
  };
}

/** Iso-raise size over limpers: the open-size rule with limpers (sizingRule), exposed with its name. */
export function isoSize(mode: GameMode, seat: string, limpers: number): SizingRule {
  return sizingRule(mode, seat, limpers);
}
