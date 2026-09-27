import { calculateEquity } from '../../equity';
import { formatPercent } from '../../math';
import { evCall, evRaise } from '../../odds';
import type { Rng } from '../../rng';
import { Dealer, codes } from '../deal';
import { finalizeChoices, money, signedMoney } from '../choices';
import { potAndBet } from '../sizes';
import { DRAW_NAMES, buildDrawSpot } from '../spots';
import type { Grade } from '../../grading';
import type { Difficulty, Question } from '../types';

export const EV_VARIANTS = ['turn'] as const;
export type EvVariant = (typeof EV_VARIANTS)[number];

export function generateEvQuestion(rng: Rng, difficulty: Difficulty, _variant: EvVariant, id: string): Question {
  const d = new Dealer(rng);
  const spot = buildDrawSpot(rng, {
    street: 'turn',
    draws: ['flush', 'oesd', 'combo', 'gutshot'],
    villain: difficulty === 'bronze' ? 'hand' : 'range',
  });
  const hero = codes(spot.hero).join('');
  const board = codes(spot.board).join('');
  const eq = calculateEquity([hero, spot.villainRange], { board }).players[0]!.equity;
  const { pot, bet, sizeLabel } = potAndBet(d, difficulty === 'bronze' ? 'bronze' : 'silver');
  const raiseTo = Math.round(bet * d.pick([2.5, 3]));
  const fold = d.int(difficulty === 'bronze' ? 2 : 1, 7) / 10;

  const evs = {
    Fold: 0,
    Call: evCall(pot, bet, eq),
    [`Raise to ${money(raiseTo)}`]: evRaise({ pot, bet, raiseTo, foldFrequency: fold, equityWhenCalled: eq }),
  } as Record<string, number>;
  const best = Math.max(...Object.values(evs));
  const tolerance = Math.max(0.5, 0.03 * (pot + bet));
  const grade = (v: number): Grade => (v === best ? 'best' : best - v <= tolerance ? 'acceptable' : 'mistake');
  const bestName = Object.keys(evs).find((k) => evs[k] === best)!;
  const finalCall = pot + 2 * bet;
  const finalRaise = pot + bet + raiseTo + (raiseTo - bet);

  return {
    id,
    kind: 'math.ev',
    skill: 'math.ev:turn',
    difficulty,
    prompt: 'Villain bets the turn. Which option has the highest EV?',
    context: {
      hero: codes(spot.hero),
      board: codes(spot.board),
      villain: `Villain: ${spot.villainLabel}`,
      facts: [
        { label: 'Pot', value: money(pot) },
        { label: 'Villain bets', value: `${money(bet)} (${sizeLabel})` },
        { label: 'Your equity', value: formatPercent(eq) },
        { label: 'Folds to raise', value: formatPercent(fold, 0) },
      ],
    },
    choices: finalizeChoices(
      Object.entries(evs).map(([label, v]) => ({ label, grade: grade(v), note: `EV ${signedMoney(v)}` })),
      rng,
      3,
    ),
    explanation: {
      summary: `${bestName} has the highest EV (${signedMoney(best)}). Your ${DRAW_NAMES[spot.draw]} has ${formatPercent(eq)} equity (engine, exact over every river).`,
      steps: [
        'EV(fold) = $0',
        `EV(call) = ${formatPercent(eq)} × ${money(finalCall)} − ${money(bet)} = ${signedMoney(evs.Call!)}`,
        `EV(raise) = ${formatPercent(fold, 0)} × ${money(pot + bet)} + ${formatPercent(1 - fold, 0)} × (${formatPercent(eq)} × ${money(finalRaise)} − ${money(raiseTo)}) = ${signedMoney(evs[`Raise to ${money(raiseTo)}`]!)}`,
        'Assumes villain folds or calls the raise (no re-raise) and calls with the same range; no more betting on the river.',
      ],
    },
  };
}
