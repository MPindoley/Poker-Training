import { cardFromIndex, cardIndex, cardToString, type Card } from '../../cards';
import { evaluateHand } from '../../evaluator';
import { formatPercent } from '../../math';
import type { Rng } from '../../rng';
import { codes, tokens } from '../deal';
import { numberChoices } from '../choices';
import { DRAW_NAMES, buildDrawSpot, type DrawKind } from '../spots';
import type { Difficulty, Question } from '../types';

export const OUTS_VARIANTS = ['flush', 'straight', 'overcards', 'combo', 'turn', 'dirty'] as const;
export type OutsVariant = (typeof OUTS_VARIANTS)[number];

const tok = (c: Card) => `{${cardToString(c)}}`;

export function generateOutsQuestion(rng: Rng, difficulty: Difficulty, variant: OutsVariant, id: string): Question {
  const draws: Record<OutsVariant, DrawKind[]> = {
    flush: ['flush'],
    straight: difficulty === 'bronze' ? ['oesd'] : ['oesd', 'gutshot'],
    overcards: ['overcards'],
    combo: ['combo'],
    turn: ['flush', 'oesd', 'gutshot', 'combo'],
    dirty: ['flush', 'oesd', 'combo'],
  };
  const gold = difficulty === 'gold' || variant === 'dirty';
  const spot = buildDrawSpot(rng, {
    street: variant === 'turn' ? 'turn' : 'flop',
    draws: draws[variant],
    villain: gold ? 'range' : 'hand',
    requireDirty: variant === 'dirty',
    minOuts: 2,
  });
  const o = spot.outs;
  const n = o.outs.length;
  const heroCards = codes(spot.hero);
  const boardCards = codes(spot.board);

  // Group the outs by the hand they make.
  const byHand = new Map<string, Card[]>();
  for (const c of o.outs) {
    const made = evaluateHand([...spot.hero, ...spot.board, cardIndex(c)].map(cardFromIndex)).categoryName;
    byHand.set(made, [...(byHand.get(made) ?? []), c]);
  }
  const steps = [...byHand.entries()].map(([made, cards]) => `${made} (${cards.length}): ${cards.map(tok).join(' ')}`);
  if (o.dirty.length) {
    steps.push(`Dirty — they win against only part of villain's range, because they also improve some of it: ${o.dirty.map(tok).join(' ')}`);
  }
  const traps = o.cards.filter((c) => !c.isOut && c.shareAfter > o.shareNow && c.shareAfter < 0.5);
  if (traps.length) {
    steps.push(`Not outs (improve you but you're still behind): ${traps.slice(0, 8).map((c) => tok(c.card)).join(' ')}${traps.length > 8 ? ' …' : ''}`);
  }
  const boardRanks = new Set(spot.board.map((c) => c >> 2));
  const helpsVillain = o.cards.filter(
    (c) => !c.isOut && c.villainHelped > 0 && !boardRanks.has(cardIndex(c.card) >> 2) && evaluateGain(spot, c.card),
  );
  if (helpsVillain.length && !o.dirty.length) {
    steps.push(`Looks like an out but isn't: ${helpsVillain.map((c) => tok(c.card)).join(' ')} (gives villain a better hand too)`);
  }
  steps.push(`Chance the next card is an out: ${n} / ${o.unseen} = ${formatPercent(o.nextCardChance)}`);

  return {
    id,
    kind: 'math.outs',
    skill: `math.outs:${variant}`,
    difficulty,
    prompt: gold ? "How many true outs do you have against villain's range?" : 'How many outs do you have?',
    context: {
      hero: heroCards,
      board: boardCards,
      villain: `Villain: ${spot.villainLabel}`,
    },
    choices: numberChoices(n, rng, [-2, -1, 1, 2, 3, -3, 4], 0),
    explanation: {
      summary: `You have a ${DRAW_NAMES[spot.draw]} with ${n} true out${n === 1 ? '' : 's'} (${o.clean.length} clean${o.dirty.length ? `, ${o.dirty.length} dirty` : ''}). Board: ${tokens(spot.board)}.`,
      steps,
    },
  };
}

/** True if the card improves hero's hand category (so it "looks like" an out). */
function evaluateGain(spot: { hero: number[]; board: number[] }, card: Card): boolean {
  const before = evaluateHand([...spot.hero, ...spot.board].map(cardFromIndex)).category;
  const after = evaluateHand([...spot.hero, ...spot.board, cardIndex(card)].map(cardFromIndex)).category;
  return after > before;
}
