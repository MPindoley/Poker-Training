import { formatPercent } from '../../math';
import { bluffBreakeven, evBet, hitProbability } from '../../odds';
import type { Rng } from '../../rng';
import { Dealer } from '../deal';
import { finalizeChoices, money, signedMoney } from '../choices';
import { potAndBet } from '../sizes';
import type { Difficulty, Question } from '../types';

export const BLUFF_VARIANTS = ['pure', 'semi'] as const;
export type BluffVariant = (typeof BLUFF_VARIANTS)[number];

export function generateBluffQuestion(rng: Rng, difficulty: Difficulty, variant: BluffVariant, id: string): Question {
  const d = new Dealer(rng);
  const { pot, bet, sizeLabel } = potAndBet(d, difficulty === 'bronze' ? 'bronze' : 'silver');
  const be = bluffBreakeven(pot, bet);
  const gap = difficulty === 'bronze' ? 0.08 : 0.04;
  let fold = be;
  for (let i = 0; i < 50 && Math.abs(fold - be) < gap; i++) fold = d.int(10, 75) / 100;

  const outs = variant === 'semi' ? d.pick([4, 8, 9, 12]) : 0;
  const eqCalled = variant === 'semi' ? hitProbability(outs, 46, 1) : 0;
  const ev = evBet({ pot, risk: bet, villainCall: bet, foldFrequency: fold, equityWhenCalled: eqCalled });
  const profitable = ev > 0;
  const close = Math.abs(ev) < 0.02 * pot;

  const steps = [
    `Breakeven: bet / (pot + bet) = ${money(bet)} / (${money(pot)} + ${money(bet)}) = ${formatPercent(be)}`,
    `Villain folds ${formatPercent(fold, 0)} ${fold > be ? '>' : '<'} ${formatPercent(be)}`,
  ];
  if (variant === 'semi') {
    steps.push(`When called you still hit ${outs} outs on the river: ${outs}/46 = ${formatPercent(eqCalled)}`);
    steps.push(
      `EV = fold% × pot + call% × (equity × ${money(pot + 2 * bet)} − ${money(bet)}) = ${formatPercent(fold, 0)} × ${money(pot)} + ${formatPercent(1 - fold, 0)} × (${formatPercent(eqCalled)} × ${money(pot + 2 * bet)} − ${money(bet)}) = ${signedMoney(ev)}`,
    );
  } else {
    steps.push(`EV = fold% × pot − call% × bet = ${formatPercent(fold, 0)} × ${money(pot)} − ${formatPercent(1 - fold, 0)} × ${money(bet)} = ${signedMoney(ev)}`);
  }
  return {
    id,
    kind: 'math.bluff',
    skill: `math.bluff:${variant}`,
    difficulty,
    prompt:
      variant === 'semi'
        ? `On the turn you bet ${money(bet)} into ${money(pot)} with a ${outs}-out draw. Villain folds ${formatPercent(fold, 0)} of the time. Profitable?`
        : `You bluff ${money(bet)} into ${money(pot)} with no showdown value. Villain folds ${formatPercent(fold, 0)} of the time. Profitable?`,
    context: {
      facts: [
        { label: 'Pot', value: money(pot) },
        { label: 'Your bet', value: `${money(bet)} (${sizeLabel})` },
        { label: 'Villain folds', value: formatPercent(fold, 0) },
        ...(variant === 'semi' ? [{ label: 'Outs if called', value: String(outs) }] : []),
      ],
    },
    choices: finalizeChoices(
      [
        { label: 'Profitable', grade: profitable ? 'best' : close ? 'acceptable' : 'mistake', note: `EV ${signedMoney(ev)}` },
        { label: 'Not profitable', grade: profitable ? (close ? 'acceptable' : 'mistake') : 'best' },
      ],
      rng,
    ),
    explanation: {
      summary:
        variant === 'semi'
          ? `A semi-bluff wins when villain folds AND sometimes when called, so it can profit even below the ${formatPercent(be)} breakeven.`
          : `A pure bluff needs villain to fold more than ${formatPercent(be)} (bet / (pot + bet)). ${profitable ? 'They fold enough.' : "They don't fold enough."}`,
      steps,
    },
  };
}
