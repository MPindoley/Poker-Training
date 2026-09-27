import { choose, formatPercent, roundTo } from '../../math';
import { hitProbability } from '../../odds';
import type { Rng } from '../../rng';
import { Dealer } from '../deal';
import { percentChoices } from '../choices';
import type { Difficulty, Question } from '../types';

export const RULE24_VARIANTS = ['flop-turn', 'flop-river', 'turn-river'] as const;
export type Rule24Variant = (typeof RULE24_VARIANTS)[number];

const OUT_EXAMPLES: Record<number, string> = {
  2: 'pocket pair to a set',
  3: 'one overcard / trips',
  4: 'gutshot',
  6: 'two overcards',
  8: 'open-ended straight draw',
  9: 'flush draw',
  12: 'flush draw + overcard',
  15: 'flush + open-ended straight draw',
};

export function generateRule24Question(rng: Rng, difficulty: Difficulty, variant: Rule24Variant, id: string): Question {
  const d = new Dealer(rng);
  const pool = difficulty === 'bronze' ? [4, 8, 9] : difficulty === 'silver' ? [2, 3, 4, 5, 6, 7, 8, 9, 10, 12] : [8, 9, 12, 13, 14, 15, 16, 18, 21];
  const outs = d.pick(pool);
  const unseen = variant === 'turn-river' ? 46 : 47;
  const draws = variant === 'flop-river' ? 2 : 1;
  const exact = hitProbability(outs, unseen, draws);
  const multiplier = variant === 'flop-river' ? 4 : 2;
  const shortcut = (outs * multiplier) / 100;
  const street = variant === 'turn-river' ? 'turn' : 'flop';
  const target = variant === 'flop-turn' ? 'on the turn' : 'by the river';

  const steps = [
    `Shortcut (rule of ${multiplier}): ${outs} × ${multiplier} = ${formatPercent(shortcut)}`,
    draws === 2
      ? `Exact: 1 − C(${unseen - outs},2) / C(${unseen},2) = 1 − ${choose(unseen - outs, 2)}/${choose(unseen, 2)} = ${formatPercent(exact)}`
      : `Exact: ${outs} / ${unseen} = ${formatPercent(exact)}`,
    `Side by side: shortcut ${formatPercent(shortcut)} vs exact ${formatPercent(exact)} (off by ${roundTo(Math.abs(shortcut - exact) * 100, 1).toFixed(1)} points)`,
  ];
  if (variant === 'flop-river' && outs > 8) {
    const adjusted = (outs * 4 - (outs - 8)) / 100;
    steps.push(`With more than 8 outs the rule of 4 overshoots; subtract (outs − 8): ${outs * 4} − ${outs - 8} = ${formatPercent(adjusted)}`);
  }
  const acceptable = Math.abs(shortcut - exact) <= 0.025 && formatPercent(shortcut) !== formatPercent(exact) ? [shortcut] : [];
  const distractors = [
    variant === 'flop-river' ? outs / 47 : hitProbability(outs, 47, 2),
    outs / 52,
    shortcut + (acceptable.length ? 0.08 : 0),
    exact * 1.5,
  ];
  const example = OUT_EXAMPLES[outs];
  return {
    id,
    kind: 'math.rule24',
    skill: `math.rule24:${variant}`,
    difficulty,
    prompt: `You have ${outs} outs${example ? ` (${example})` : ''} on the ${street}. What's your chance to hit ${target}?`,
    context: { facts: [{ label: 'Outs', value: String(outs) }, { label: 'Unseen cards', value: String(unseen) }, { label: 'Cards to come', value: String(draws) }] },
    choices: percentChoices(exact, distractors, rng, acceptable),
    explanation: {
      summary:
        draws === 2
          ? `Seeing two cards (only if you won't face another bet), ${outs} outs hit ${formatPercent(exact)} of the time.`
          : `With one card to come, ${outs} outs hit ${formatPercent(exact)} of the time.`,
      steps,
    },
  };
}
