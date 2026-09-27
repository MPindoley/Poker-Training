import {
  HAND_GRID,
  HandCategory,
  TOTAL_COMBOS,
  buildCharts,
  choose,
  createRng,
  fiveCardCategoryCounts,
  legalActions,
  applyAction,
  rangeFraction,
  startHand,
  type ChartJson,
} from '../../engine';
import { CHART_LIBRARY } from '../../data/ranges';
import { n, pct } from './fmt';
import type { Unit } from './types';

const counts = () => fiveCardCategoryCounts();
const total5 = () => choose(52, 5);
const chart = () => buildCharts(CHART_LIBRARY as Record<string, ChartJson>)['cash-9max-100bb']!;
const openPct = (seat: string) => rangeFraction(chart().rfi(seat)!.ranges.raise!);

function minRaiseDemo() {
  let s = startHand([{ name: 'A', stack: 100 }, { name: 'B', stack: 100 }, { name: 'C', stack: 100 }], 0, { sb: 0.5, bb: 1 }, createRng(1));
  const first = legalActions(s)!.minTo;
  s = applyAction(s, { type: 'raise', to: 3 });
  const second = legalActions(s)!.minTo;
  return { first, second };
}

export const UNIT1: Unit = {
  id: 'foundations',
  number: 1,
  title: 'Foundations',
  blurb: 'Hand rankings, positions, blinds and how betting works',
  lessons: [
    {
      id: 'hand-rankings',
      title: 'Hand rankings',
      minutes: 3,
      blurb: 'What beats what, and how rare each hand is',
      blocks: [
        { kind: 'p', text: 'Hold’em uses your best five cards from your two hole cards and the five community cards. From weakest to strongest: high card, pair, two pair, three of a kind, straight, flush, full house, four of a kind, straight flush.' },
        {
          kind: 'p',
          text: () =>
            `Rarer hands rank higher. Of all ${n(total5())} possible five-card hands, ${n(counts()[HandCategory.Flush])} are flushes and ${n(counts()[HandCategory.Straight])} are straights — so a flush beats a straight.`,
        },
        { kind: 'example', example: 'hand-rankings' },
        { kind: 'h', text: 'Ties and kickers' },
        { kind: 'p', text: 'When two players have the same category, compare the ranks that make it, then the kickers. A-A-K-7-2 beats A-A-Q-J-T because the king outranks the queen. Suits never break ties — the pot is split.' },
        { kind: 'tip', text: 'The wheel (A-2-3-4-5) is the lowest straight: the ace plays low. There is no “wraparound” straight like Q-K-A-2-3.' },
      ],
      quiz: [
        {
          prompt: 'Which hand wins: a flush or a full house?',
          choices: ['Flush', 'Full house', 'They split'],
          answer: 1,
          why: () => `A full house is rarer: ${n(counts()[HandCategory.FullHouse])} five-card full houses vs ${n(counts()[HandCategory.Flush])} flushes.`,
        },
        {
          prompt: 'Board {As} {Kd} {7c} {7h} {2s}. You hold {Ad} {Qc}, villain {Ac} {Jh}. Who wins?',
          choices: ['You (queen kicker)', 'Villain', 'Split pot'],
          answer: 0,
          why: 'Both have two pair, aces and sevens. The fifth card decides: your Q beats villain’s J.',
        },
        {
          prompt: 'How many different starting hands are there, counting suits?',
          choices: [() => n(TOTAL_COMBOS), () => n(HAND_GRID.flat().length), () => n(52 * 51)],
          answer: 0,
          why: () => `C(52, 2) = ${n(TOTAL_COMBOS)} two-card combinations. Ignoring suits there are ${HAND_GRID.flat().length} hand types like “AKs”.`,
        },
      ],
      drill: { route: '/train/math/play?kind=math.outs&d=bronze', label: 'Count the Outs' },
    },
    {
      id: 'positions',
      title: 'Positions and blinds',
      minutes: 3,
      blurb: 'The seats, the blinds, and who acts when',
      blocks: [
        { kind: 'p', text: 'The dealer button moves one seat left every hand. The two players to its left post the small blind (half a big blind) and the big blind. Preflop, action starts left of the big blind; after the flop it starts left of the button, so the button acts last on every street.' },
        { kind: 'p', text: 'At a full table the seats are, in order: UTG (under the gun), UTG+1, MP, LJ (lojack), HJ (hijack), CO (cutoff), BTN (button), SB, BB.' },
        { kind: 'example', example: 'positions' },
        {
          kind: 'p',
          text: () =>
            `Because more players still have to act behind early seats, good players open far fewer hands there. In the built-in 100bb chart, UTG opens ${pct(openPct('UTG'), 0)} of hands while the button opens ${pct(openPct('BTN'), 0)}.`,
        },
      ],
      quiz: [
        { prompt: 'Who acts last after the flop?', choices: ['Big blind', 'Button', 'Under the gun'], answer: 1, why: 'Postflop action starts left of the button, so the button always acts last.' },
        { prompt: 'Which blind posts half a big blind?', choices: ['Small blind', 'Big blind', 'Button'], answer: 0, why: 'The small blind posts half; the big blind posts one full big blind.' },
        {
          prompt: () => `Roughly how much wider is the button’s opening range than UTG’s in the built-in chart?`,
          choices: [
            () => `About ${Math.round(openPct('BTN') / openPct('UTG'))}x wider`,
            () => `About ${Math.round(openPct('BTN') / openPct('UTG')) + 3}x wider`,
            () => 'The same',
          ],
          answer: 0,
          why: () => `${pct(openPct('BTN'), 0)} vs ${pct(openPct('UTG'), 0)} of hands.`,
        },
      ],
      drill: { route: '/train/preflop/play?kind=preflop.flash&d=bronze', label: 'Preflop Flash Cards' },
    },
    {
      id: 'betting',
      title: 'How No-Limit betting works',
      minutes: 2,
      blurb: 'Bets, raises, the minimum raise and all-ins',
      blocks: [
        { kind: 'p', text: 'On each street you can check (if nobody has bet), bet, call, raise or fold. In No-Limit you may bet any amount up to your whole stack.' },
        {
          kind: 'p',
          text: () => {
            const d = minRaiseDemo();
            return `A raise must be at least as big as the last bet or raise. With a 1bb big blind the smallest open is to ${d.first}bb. If someone raises to 3bb (a 2bb raise), the next minimum re-raise is to ${d.second}bb.`;
          },
        },
        { kind: 'example', example: 'min-raise' },
        { kind: 'p', text: 'If you go all-in for less than a call, you can only win the part of the pot you matched. The extra goes to a side pot among the players who covered it.' },
      ],
      quiz: [
        {
          prompt: () => `Blinds 0.5/1. Someone raises to 3bb. What’s the minimum re-raise?`,
          choices: [() => `${minRaiseDemo().second}bb`, () => '4bb', () => '6bb'],
          answer: 0,
          why: 'The last raise was 2bb (from 1 to 3), so you must raise by at least 2bb more: to 5bb.',
        },
        { prompt: 'You’re all-in for 20bb; two others bet 50bb each. How much of the pot can you win?', choices: ['Only the main pot you matched', 'Everything', 'Nothing'], answer: 0, why: 'You can win 20bb from each player (the main pot). The rest is a side pot between the other two.' },
        { prompt: 'Can you check if someone bet before you?', choices: ['No — call, raise or fold', 'Yes'], answer: 0, why: 'Checking is only possible when there’s no bet to match.' },
      ],
      drill: { route: '/play', label: 'Play a few hands' },
    },
    {
      id: 'why-position',
      title: 'Why position matters',
      minutes: 3,
      blurb: 'Acting last is worth real money',
      blocks: [
        { kind: 'p', text: 'Acting last means you see what everyone did before you decide. You can bet when they show weakness, check behind to take a free card, and control the size of the pot.' },
        { kind: 'p', text: 'Out of position you have to act first with less information, so you realize less of your equity — you get bluffed off more often and can’t take free cards.' },
        { kind: 'tip', text: 'That’s why this app’s postflop EV estimates realize less equity out of position (see the realization rule in rules.ts).' },
        { kind: 'todo', text: 'The exact realization numbers (100% in position, 90% out of position) are simplified teaching values, not measured solver results.' },
        { kind: 'example', example: 'positions' },
      ],
      quiz: [
        { prompt: 'Why can the button play more hands?', choices: ['Fewer players left to act and position after the flop', 'The button gets a discount', 'The button sees one extra card'], answer: 0, why: 'Only the blinds are left to act, and the button acts last after the flop.' },
        { prompt: 'What does “realizing equity” mean?', choices: ['Actually winning your fair share of the pot by showdown', 'Winning every hand'], answer: 0, why: 'Equity is your share if the hand were checked down; realization is how much of it you actually capture when there’s betting.' },
        { prompt: 'Out of position you usually…', choices: ['Realize less equity', 'Realize more equity'], answer: 0, why: 'Acting first gives your opponent information and control.' },
      ],
      drill: { route: '/train/preflop/play?kind=preflop.ladder&d=bronze', label: 'Seat Ladder' },
    },
  ],
};
