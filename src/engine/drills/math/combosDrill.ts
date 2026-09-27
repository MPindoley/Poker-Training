import { RANKS, cardFromIndex, cardToString } from '../../cards';
import { choose } from '../../math';
import { classCombos } from '../../range';
import type { Rng } from '../../rng';
import { Dealer, codes } from '../deal';
import { finalizeChoices, type Candidate } from '../choices';
import type { Difficulty, Question } from '../types';

export const COMBO_VARIANTS = ['single', 'pair', 'suited', 'multi'] as const;
export type ComboVariant = (typeof COMBO_VARIANTS)[number];

const SUIT_NAMES = ['spades', 'hearts', 'diamonds', 'clubs'];

/** Step-by-step blocker math for one hand class, e.g. "AK", "AKs", "77". */
export function comboWorking(label: string, dead: number[]): { combos: number; steps: string[] } {
  const hi = RANKS.indexOf(label[0] as (typeof RANKS)[number]);
  const lo = RANKS.indexOf(label[1] as (typeof RANKS)[number]);
  const kind = label[2] ?? '';
  const live = (r: number) => [0, 1, 2, 3].filter((s) => !dead.includes(r * 4 + s));
  const seen = (r: number) => dead.filter((c) => c >> 2 === r).map((c) => `{${cardToString(cardFromIndex(c))}}`);
  const line = (r: number) => {
    const s = seen(r);
    return `${RANKS[r]}: 4${s.length ? ` − ${s.length} seen (${s.join(' ')})` : ''} = ${live(r).length} left`;
  };
  if (hi === lo) {
    const n = live(hi).length;
    return { combos: choose(n, 2), steps: [line(hi), `Pairs: C(${n},2) = ${n} × ${n - 1} / 2 = ${choose(n, 2)}`] };
  }
  const a = live(hi);
  const b = live(lo);
  const suited = a.filter((s) => b.includes(s));
  const total = a.length * b.length;
  const steps = [line(hi), line(lo)];
  if (kind === 's') {
    steps.push(`Suited: suits with both cards live: ${suited.map((s) => SUIT_NAMES[s]).join(', ') || 'none'} = ${suited.length}`);
    return { combos: suited.length, steps };
  }
  if (kind === 'o') {
    steps.push(`All ${label.slice(0, 2)}: ${a.length} × ${b.length} = ${total}; minus ${suited.length} suited = ${total - suited.length} offsuit`);
    return { combos: total - suited.length, steps };
  }
  steps.push(`${label}: ${a.length} × ${b.length} = ${total}`);
  return { combos: total, steps };
}

export function generateCombosQuestion(rng: Rng, difficulty: Difficulty, variant: ComboVariant, id: string): Question {
  const d = new Dealer(rng);
  const board = [d.take(), d.take(), d.take()];
  const hero = [d.take(), d.take()];
  const dead = [...hero, ...board];
  const boardRanks = [...new Set(board.map((c) => c >> 2))].sort((x, y) => y - x);
  const heroRanks = hero.map((c) => c >> 2);
  const cls = (a: number, b: number, suffix = '') => {
    const [h, l] = a >= b ? [a, b] : [b, a];
    return RANKS[h]! + RANKS[l]! + (h === l ? '' : suffix);
  };

  let labels: string[];
  switch (variant) {
    case 'pair':
      {
        const r = d.pick([...boardRanks, ...heroRanks]);
        labels = [cls(r, r)];
      }
      break;
    case 'suited': {
      const a = d.pick(heroRanks);
      const b = d.pick(boardRanks.filter((r) => r !== a).length ? boardRanks.filter((r) => r !== a) : [a === 12 ? 11 : 12]);
      labels = [cls(a, b, d.pick(['s', 'o']))];
      break;
    }
    case 'multi': {
      const top = boardRanks[0]!;
      const set = new Set<string>([cls(top, top), cls(top, d.pick(heroRanks.filter((r) => r !== top).length ? heroRanks.filter((r) => r !== top) : [12]))]);
      if (boardRanks[1] !== undefined) set.add(cls(boardRanks[1], boardRanks[1]));
      if (boardRanks[1] !== undefined) set.add(cls(top, boardRanks[1], d.pick(['', 's'])));
      labels = [...set];
      break;
    }
    default: {
      const a = d.pick(heroRanks);
      const others = boardRanks.filter((r) => r !== a);
      labels = [cls(a, others.length ? d.pick(others) : a === 12 ? 11 : 12)];
    }
  }

  const works = labels.map((l) => ({ label: l, ...comboWorking(l, dead) }));
  const total = works.reduce((s, w) => s + w.combos, 0);
  const engine = labels.reduce((s, l) => s + classCombos(l, codes(dead).join('')), 0);
  if (engine !== total) throw new Error(`Combo working mismatch for ${labels.join(',')}`);
  const unblocked = labels.reduce((s, l) => s + classCombos(l), 0);

  const steps = works.flatMap((w) => (works.length > 1 ? [`— ${w.label} —`, ...w.steps] : w.steps));
  if (works.length > 1) steps.push(`Total: ${works.map((w) => w.combos).join(' + ')} = ${total}`);
  steps.push(`Without blockers it would be ${unblocked}; the cards you can see remove ${unblocked - total}.`);

  const cands: Candidate[] = [{ label: String(total), grade: 'best' }, { label: String(unblocked), grade: 'mistake' }];
  for (const delta of [-1, 1, -2, 2, 3, -3]) if (total + delta >= 0) cands.push({ label: String(total + delta), grade: 'mistake' });
  const what = labels.length === 1 ? labels[0]! : labels.join(', ');
  return {
    id,
    kind: 'math.combos',
    skill: `math.combos:${variant}`,
    difficulty,
    prompt: labels.length === 1 ? `How many combos of ${what} can villain have?` : `Villain's value range is ${what}. How many combos is that?`,
    context: { hero: codes(hero), board: codes(board) },
    choices: finalizeChoices(cands, rng),
    explanation: {
      summary: `Count the live cards of each rank after removing your hand ${hero.map((c) => `{${cardToString(cardFromIndex(c))}}`).join(' ')} and the board. ${what} = ${total} combos.`,
      steps,
    },
  };
}

