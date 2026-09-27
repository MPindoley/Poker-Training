/**
 * "Equity Eye": a quick multiple-choice version of the Range Lab guess, for sessions and Daily
 * Training. Your hand vs a real chart range on a random flop; pick the equity band.
 */
import { cardIndex, indexToString } from '../cards';
import type { DrillDef } from '../drills/math';
import type { Difficulty, Question } from '../drills/types';
import { calculateEquity } from '../equity';
import { formatPercent } from '../math';
import type { Chart } from '../preflop/charts';
import { rangeFraction, rangeToString, COMBOS } from '../range';
import { shuffledDeck, type Rng } from '../rng';
import { classifyHand, BUCKET_NAMES } from '../postflop/buckets';
import { EQUITY_GUESS_BEST } from './lab';

/** The answer bands (lower bounds). */
export const EQUITY_BANDS = [0, 0.2, 0.4, 0.6, 0.8] as const;
export const bandLabel = (i: number) => `${Math.round(EQUITY_BANDS[i]! * 100)}–${Math.round((EQUITY_BANDS[i + 1] ?? 1) * 100)}%`;

export function bandOf(x: number): number {
  let b = 0;
  EQUITY_BANDS.forEach((lo, i) => {
    if (x >= lo) b = i;
  });
  return b;
}

export function equityQuestion(chart: Chart, rng: Rng, difficulty: Difficulty, id: string): Question {
  const seats = chart.openingSeats;
  const seat = seats[Math.floor(rng() * seats.length)]!;
  const range = chart.rfi(seat)!.ranges.raise!;
  const deck = shuffledDeck(rng).map(cardIndex);
  const board = deck.slice(0, 3);
  // Hero's hand: a random combo that doesn't clash with the board.
  const avail = COMBOS.filter((c) => !board.includes(c.c1) && !board.includes(c.c2));
  const hero = avail[Math.floor(rng() * avail.length)]!;
  const heroCodes = [indexToString(hero.c1), indexToString(hero.c2)];
  const boardCodes = board.map(indexToString);
  const res = calculateEquity([heroCodes.join(''), rangeToString(range)], { board: boardCodes.join(''), iterations: 20_000, seed: Math.floor(rng() * 1e9) });
  const eq = res.players[0]!.equity;
  const band = bandOf(eq);
  const info = classifyHand(hero.c1, hero.c2, board);
  const choices = EQUITY_BANDS.map((lo, i) => {
    const hi = EQUITY_BANDS[i + 1] ?? 1;
    const near = Math.min(Math.abs(eq - lo), Math.abs(eq - hi)) <= EQUITY_GUESS_BEST;
    return { id: `b${i}`, label: bandLabel(i), grade: i === band ? ('best' as const) : Math.abs(i - band) === 1 && near ? ('acceptable' as const) : ('mistake' as const) };
  });
  return {
    id,
    kind: 'equity.guess',
    skill: `equity.guess:${info.bucket}`,
    difficulty,
    prompt: `The ${seat} opens and you call. What’s your equity against their whole opening range?`,
    context: {
      hero: heroCodes,
      board: boardCodes,
      villain: `${seat} open range: ${formatPercent(rangeFraction(range), 0)} of hands (${chart.name})`,
      facts: [{ label: 'Your hand', value: BUCKET_NAMES[info.bucket] }],
    },
    choices,
    explanation: {
      summary: `You have ${formatPercent(eq)} equity: ${info.description} against a ${formatPercent(rangeFraction(range), 0)} range. Open it in the Range Lab to see what beats you.`,
      steps: [
        `Equity = share of the pot you win on average over every turn and river, vs every combo in their range`,
        `${res.method === 'exact' ? 'Exact' : `Monte Carlo, ${res.samples.toLocaleString()} run-outs, ±${formatPercent(res.maxMargin95)}`}: ${formatPercent(eq)}`,
      ],
    },
  };
}

export function makeEquityDrills(chart: Chart): DrillDef[] {
  const v = ['flop'];
  return [
    {
      kind: 'equity.guess',
      title: 'Equity Eye',
      blurb: 'Guess your equity vs a real range',
      glyph: 'EQ',
      variants: { bronze: v, silver: v, gold: v },
      generate: (rng: Rng, d: Difficulty, _v: string, id: string) => equityQuestion(chart, rng, d, id),
    },
  ];
}
