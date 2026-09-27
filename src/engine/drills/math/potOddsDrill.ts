import { formatPercent } from '../../math';
import { potOdds, requiredEquity } from '../../odds';
import type { Rng } from '../../rng';
import { Dealer } from '../deal';
import { money, percentChoices } from '../choices';
import { potAndBet } from '../sizes';
import type { Difficulty, Question } from '../types';

export const POT_ODDS_VARIANTS = ['basic', 'sized', 'multiway', 'raised'] as const;
export type PotOddsVariant = (typeof POT_ODDS_VARIANTS)[number];

export function generatePotOddsQuestion(rng: Rng, difficulty: Difficulty, variant: PotOddsVariant, id: string): Question {
  const d = new Dealer(rng);
  const level = variant === 'basic' ? 'bronze' : difficulty === 'bronze' ? 'silver' : difficulty;
  const { pot, bet, sizeLabel } = potAndBet(d, level);

  if (variant === 'multiway') {
    const callers = d.int(1, 2);
    const potBeforeCall = pot + bet * (1 + callers);
    const r = potOdds(potBeforeCall, bet);
    return {
      id,
      kind: 'math.potodds',
      skill: 'math.potodds:multiway',
      difficulty,
      prompt: `Pot is ${money(pot)}. Villain bets ${money(bet)} and ${callers === 1 ? 'one player calls' : 'two players call'}. What equity do you need to call?`,
      context: { facts: [{ label: 'Pot', value: money(pot) }, { label: 'Bet', value: `${money(bet)} (${sizeLabel})` }, { label: 'Callers', value: String(callers) }] },
      choices: percentChoices(r.requiredEquity, [bet / (pot + bet + bet), bet / (pot + bet), bet / potBeforeCall], rng),
      explanation: {
        summary: 'Callers in front add dead money, so multi-way you need less equity to call — but you also have to beat more hands.',
        steps: [
          'Formula: call / (pot + bet + call)',
          `Pot before you: ${money(pot)} + ${money(bet)} bet + ${callers} × ${money(bet)} = ${money(potBeforeCall)}`,
          `Need: ${money(bet)} / (${money(potBeforeCall)} + ${money(bet)}) = ${formatPercent(r.requiredEquity)}`,
        ],
      },
    };
  }

  if (variant === 'raised') {
    const ourBet = bet;
    const raiseTo = Math.round(ourBet * d.pick([2.5, 3, 3.5]));
    const r = requiredEquity(pot + ourBet, raiseTo, ourBet);
    const toCall = raiseTo - ourBet;
    return {
      id,
      kind: 'math.potodds',
      skill: 'math.potodds:raised',
      difficulty,
      prompt: `You bet ${money(ourBet)} into ${money(pot)}. Villain raises to ${money(raiseTo)}. What equity do you need to call?`,
      context: { facts: [{ label: 'Pot', value: money(pot) }, { label: 'Your bet', value: money(ourBet) }, { label: 'Raise to', value: money(raiseTo) }] },
      choices: percentChoices(r.requiredEquity, [raiseTo / (pot + ourBet + raiseTo + raiseTo), toCall / (pot + raiseTo), toCall / (pot + ourBet + raiseTo)], rng),
      explanation: {
        summary: "Your first bet is already in the pot: you only pay the difference, and it's part of what you win.",
        steps: [
          'Formula: call / (pot + bet + call)',
          `You call ${money(raiseTo)} − ${money(ourBet)} = ${money(toCall)}`,
          `Pot before you call: ${money(pot)} + ${money(ourBet)} + ${money(raiseTo)} = ${money(pot + ourBet + raiseTo)}`,
          `Need: ${money(toCall)} / (${money(pot + ourBet + raiseTo)} + ${money(toCall)}) = ${formatPercent(r.requiredEquity)}`,
        ],
      },
    };
  }

  const r = requiredEquity(pot, bet);
  return {
    id,
    kind: 'math.potodds',
    skill: `math.potodds:${variant}`,
    difficulty,
    prompt: `Pot is ${money(pot)}. Villain bets ${money(bet)}. What equity do you need to call?`,
    context: { facts: [{ label: 'Pot', value: money(pot) }, { label: 'Bet', value: `${money(bet)} (${sizeLabel})` }] },
    choices: percentChoices(r.requiredEquity, [bet / (pot + bet), bet / pot, (2 * bet) / (pot + 2 * bet)], rng),
    explanation: {
      summary: `A ${sizeLabel} bet means you risk ${money(bet)} to win ${money(pot + bet)}.`,
      steps: [
        'Formula: call / (pot + bet + call)',
        `Need: ${money(bet)} / (${money(pot)} + ${money(bet)} + ${money(bet)}) = ${r.working.split('=').pop()!.trim()}`,
        `Odds: ${money(pot + bet)} to ${money(bet)} = ${(r.ratio).toFixed(2)} to 1`,
      ],
    },
  };
}
