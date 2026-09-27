import { calculateEquity } from '../../equity';
import { formatPercent } from '../../math';
import { evCall, impliedOddsNeeded, potOdds } from '../../odds';
import type { Rng } from '../../rng';
import { Dealer, codes } from '../deal';
import { finalizeChoices, money, signedMoney } from '../choices';
import { potAndBet } from '../sizes';
import { DRAW_NAMES, buildDrawSpot } from '../spots';
import type { Difficulty, Question } from '../types';

export const CALL_FOLD_VARIANTS = ['direct', 'implied', 'allin-flop', 'vs-range'] as const;
export type CallFoldVariant = (typeof CALL_FOLD_VARIANTS)[number];

export function generateCallFoldQuestion(rng: Rng, difficulty: Difficulty, variant: CallFoldVariant, id: string): Question {
  const d = new Dealer(rng);
  const flop = variant === 'allin-flop';
  const spot = buildDrawSpot(rng, {
    street: flop ? 'flop' : 'turn',
    draws: difficulty === 'bronze' ? ['flush', 'oesd'] : ['flush', 'oesd', 'gutshot', 'combo', 'overcards'],
    villain: variant === 'vs-range' ? 'range' : 'hand',
  });
  const hero = codes(spot.hero).join('');
  const board = codes(spot.board).join('');
  const eq = calculateEquity([hero, spot.villainRange], { board }).players[0]!.equity;
  const runouts = flop ? 'every turn and river' : 'every river';

  // Sizes: keep the decision clear of the break-even line (or, for implied, below direct odds).
  let pot = 0;
  let bet = 0;
  let sizeLabel = '';
  for (let tries = 0; tries < 60; tries++) {
    ({ pot, bet, sizeLabel } = potAndBet(d, difficulty === 'bronze' ? 'bronze' : 'silver'));
    const need = potOdds(pot + bet, bet).requiredEquity;
    if (variant === 'implied' ? eq < need - 0.03 : Math.abs(eq - need) >= 0.03) break;
  }
  const need = potOdds(pot + bet, bet);
  const facts = [
    { label: 'Pot', value: money(pot) },
    { label: flop ? 'Villain shoves' : 'Villain bets', value: `${money(bet)} (${sizeLabel})` },
    { label: 'Your equity', value: formatPercent(eq) },
  ];
  const steps = [
    `Equity vs villain (engine, exact over ${runouts}): ${formatPercent(eq)}`,
    `Price: call / (pot + bet + call) = ${need.working}`,
  ];

  let implied = 0;
  if (variant === 'implied') {
    const x = impliedOddsNeeded(pot + bet, bet, eq);
    implied = Math.max(1, Math.round(x * d.pick([0.5, 0.6, 1.6, 2])));
    facts.push({ label: 'If you hit, villain pays', value: money(implied) });
    steps.push(`Direct odds aren't enough (${formatPercent(eq)} < ${formatPercent(need.requiredEquity)}).`);
    steps.push(`Implied odds needed: call / equity − pot − call = ${money(bet)} / ${formatPercent(eq)} − ${money(pot + bet)} − ${money(bet)} = ${money(x)}`);
    steps.push(`Villain will pay about ${money(implied)} more when you hit → ${implied >= x ? 'enough, call' : 'not enough, fold'}`);
  }

  const finalPot = pot + bet + bet + implied;
  const callEv = evCall(pot, bet, eq) + eq * implied;
  steps.push(`EV(call) = equity × final pot − call = ${formatPercent(eq)} × ${money(finalPot)} − ${money(bet)} = ${signedMoney(callEv)}`);
  steps.push('EV(fold) = $0');
  const close = Math.abs(callEv) < 0.02 * (pot + 2 * bet);
  const callBest = callEv > 0;
  return {
    id,
    kind: 'math.callfold',
    skill: `math.callfold:${variant}`,
    difficulty,
    prompt: flop ? 'Villain is all-in on the flop. Call or fold?' : 'Villain bets the turn. Call or fold?',
    context: { hero: codes(spot.hero), board: codes(spot.board), villain: `Villain: ${spot.villainLabel}`, facts },
    choices: finalizeChoices(
      [
        { label: 'Call', grade: callBest ? 'best' : close ? 'acceptable' : 'mistake', note: `EV ${signedMoney(callEv)}` },
        { label: 'Fold', grade: callBest ? (close ? 'acceptable' : 'mistake') : 'best', note: 'EV $0' },
      ],
      rng,
    ),
    explanation: {
      summary: `Your ${DRAW_NAMES[spot.draw]} has ${formatPercent(eq)} equity and the price is ${formatPercent(need.requiredEquity)}${
        implied ? `, plus about ${money(implied)} of future money when you hit` : ''
      }, so ${callBest ? 'calling' : 'folding'} is right${close ? ' — but it is close' : ''}.`,
      steps,
    },
  };
}
