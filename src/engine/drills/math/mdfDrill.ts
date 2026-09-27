import { formatPercent } from '../../math';
import { bluffBreakeven, minimumDefenseFrequency } from '../../odds';
import type { Rng } from '../../rng';
import { Dealer } from '../deal';
import { money, numberChoices, percentChoices } from '../choices';
import { potAndBet } from '../sizes';
import type { Difficulty, Question } from '../types';

export const MDF_VARIANTS = ['percent', 'combos'] as const;
export type MdfVariant = (typeof MDF_VARIANTS)[number];

export function generateMdfQuestion(rng: Rng, difficulty: Difficulty, variant: MdfVariant, id: string): Question {
  const d = new Dealer(rng);
  const { pot, bet, sizeLabel } = potAndBet(d, difficulty === 'bronze' ? 'bronze' : difficulty === 'silver' ? 'silver' : 'gold');
  const mdf = minimumDefenseFrequency(pot, bet);
  const be = bluffBreakeven(pot, bet);
  const steps = [
    `MDF = pot / (pot + bet) = ${money(pot)} / (${money(pot)} + ${money(bet)}) = ${formatPercent(mdf)}`,
    `Villain's bluff needs ${formatPercent(be)} folds to break even (bet / (pot + bet)); defending ${formatPercent(mdf)} holds folds to exactly that.`,
  ];
  const facts = [
    { label: 'Pot', value: money(pot) },
    { label: 'Villain bets', value: `${money(bet)} (${sizeLabel})` },
  ];
  if (variant === 'combos') {
    const combos = d.pick([40, 50, 60, 80, 100, 120]);
    const need = Math.ceil(mdf * combos - 1e-9);
    steps.push(`Combos to continue: ${formatPercent(mdf)} × ${combos} = ${(mdf * combos).toFixed(1)} → at least ${need}`);
    return {
      id,
      kind: 'math.mdf',
      skill: 'math.mdf:combos',
      difficulty,
      prompt: `You have ${combos} combos in your range. Villain bets ${money(bet)} into ${money(pot)}. At least how many must continue?`,
      context: { facts: [...facts, { label: 'Your combos', value: String(combos) }] },
      choices: numberChoices(need, rng, [-6, -3, 3, 6, Math.round(combos * be) - need], 0),
      explanation: { summary: 'Defend at least MDF of your range, or any two cards bluff profitably against you.', steps },
    };
  }
  return {
    id,
    kind: 'math.mdf',
    skill: 'math.mdf:percent',
    difficulty,
    prompt: `Villain bets ${money(bet)} into ${money(pot)}. How often must you continue so their bluffs aren't automatically profitable?`,
    context: { facts },
    choices: percentChoices(mdf, [be, bet / (pot + 2 * bet), 1 - bet / (pot + 2 * bet)], rng),
    explanation: { summary: `Against a ${sizeLabel} bet you must keep going with ${formatPercent(mdf)} of your range.`, steps },
  };
}
