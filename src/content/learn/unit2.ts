import {
  bluffBreakeven,
  calculateEquity,
  choose,
  classCombos,
  evCall,
  hitProbability,
  impliedOddsNeeded,
  minimumDefenseFrequency,
  requiredEquity,
} from '../../engine';
import { bb, n, pct } from './fmt';
import type { Unit } from './types';

const fd = () => hitProbability(9, 47, 2);
const fdTurn = () => hitProbability(9, 46, 1);
const oesd = () => hitProbability(8, 47, 2);
const aaKk = () => calculateEquity(['AhAs', 'KdKc'], { iterations: 20000, seed: 7, forceMonteCarlo: true }).players[0]!.equity;

export const UNIT2: Unit = {
  id: 'math',
  number: 2,
  title: 'The Math',
  blurb: 'Outs, pot odds, equity, EV, combos, MDF',
  lessons: [
    {
      id: 'outs',
      title: 'Outs and the rule of 2 and 4',
      minutes: 3,
      blurb: 'Turn your draw into a percentage',
      blocks: [
        { kind: 'p', text: 'An out is a card that gives you the best hand. A flush draw has 9 outs (13 cards of the suit minus the 4 you can see). An open-ended straight draw has 8.' },
        {
          kind: 'p',
          text: () =>
            `On the flop there are 47 unseen cards. The chance a 9-out flush draw hits by the river (if you see both cards) is 1 − C(38,2)/C(47,2) = ${pct(fd())}. With one card to come it is 9/46 = ${pct(fdTurn())}.`,
        },
        { kind: 'p', text: 'The shortcut: multiply outs by 4 with two cards to come, by 2 with one card to come. It is close for small numbers of outs and overshoots with big draws.' },
        { kind: 'example', example: 'outs' },
        { kind: 'tip', text: 'Discount “dirty” outs: a flush card that pairs the board can give your opponent a full house.' },
      ],
      quiz: [
        { prompt: 'How many outs does a flush draw have?', choices: ['9', '8', '13'], answer: 0, why: '13 cards of the suit minus the 4 you see (2 in hand, 2 on board).' },
        {
          prompt: 'Open-ended straight draw on the flop, seeing both cards. Chance to hit?',
          choices: [() => pct(oesd()), () => pct(8 / 47), () => pct(oesd() + 0.1)],
          answer: 0,
          why: () => `1 − C(39,2)/C(47,2) = 1 − ${n(choose(39, 2))}/${n(choose(47, 2))} = ${pct(oesd())}. (8/47 is just the next card.)`,
        },
        {
          prompt: 'Rule of 2: 9 outs on the turn is about…',
          choices: [() => `${9 * 2}%`, () => `${9 * 4}%`, () => `${9}%`],
          answer: 0,
          why: () => `9 × 2 = ${9 * 2}%; exact is 9/46 = ${pct(fdTurn())}.`,
        },
      ],
      drill: { route: '/train/math/play?kind=math.rule24&d=bronze', label: 'Rule of 2 & 4' },
    },
    {
      id: 'pot-odds',
      title: 'Pot odds',
      minutes: 3,
      blurb: 'The price of a call',
      blocks: [
        { kind: 'p', text: 'Pot odds compare what you must call to what you can win. The equity you need to call is: call / (pot + bet + call).' },
        {
          kind: 'p',
          text: () => `Example: the pot is $6 and villain bets $4. You call $4 to win $10: ${requiredEquity(6, 4).working}.`,
        },
        { kind: 'example', example: 'pot-odds' },
        {
          kind: 'list',
          items: [
            () => `Half-pot bet: you need ${pct(requiredEquity(1, 0.5).requiredEquity)}.`,
            () => `Pot-size bet: you need ${pct(requiredEquity(1, 1).requiredEquity)}.`,
            () => `2x-pot overbet: you need ${pct(requiredEquity(1, 2).requiredEquity)}.`,
          ],
        },
      ],
      quiz: [
        {
          prompt: 'Pot $20, villain bets $10. Equity needed to call?',
          choices: [() => pct(requiredEquity(20, 10).requiredEquity), () => pct(10 / 30), () => pct(10 / 20)],
          answer: 0,
          why: () => requiredEquity(20, 10).working,
        },
        { prompt: 'Bigger bets require…', choices: ['More equity to call', 'Less equity to call'], answer: 0, why: 'You risk more to win a relatively smaller pot.' },
        {
          prompt: 'Flush draw on the turn (one card to come) facing a pot-size bet. Direct odds say…',
          choices: ['Fold (unless implied odds make up for it)', 'Call — it’s profitable'],
          answer: 0,
          why: () => `You need ${pct(requiredEquity(1, 1).requiredEquity)} but hit only ${pct(fdTurn())}.`,
        },
      ],
      drill: { route: '/train/math/play?kind=math.potodds&d=bronze', label: 'Pot Odds drill' },
    },
    {
      id: 'implied-odds',
      title: 'Implied and reverse implied odds',
      minutes: 3,
      blurb: 'Money you win (or lose) later',
      blocks: [
        { kind: 'p', text: 'Implied odds are the extra chips you expect to win on later streets when you hit. They can make a call right even when direct pot odds say fold.' },
        {
          kind: 'p',
          text: () =>
            `Turn, pot 30 after villain’s 10 bet, you have a 9-out flush draw (${pct(fdTurn())}). To break even you need to win X more when you hit, where X = call/equity − pot − call = ${bb(impliedOddsNeeded(30, 10, fdTurn()))}.`,
        },
        { kind: 'example', example: 'implied' },
        { kind: 'p', text: 'Reverse implied odds are the opposite: when you make a second-best hand (a low flush, top pair weak kicker) you lose extra on later streets. Hands that make weak “best-looking” hands suffer most.' },
        { kind: 'todo', text: 'Implied odds depend heavily on how much opponents actually pay off; the payoff amounts in examples are assumptions, not measured values.' },
      ],
      quiz: [
        {
          prompt: () => `Pot 30 (incl. the bet), call 10, equity ${pct(fdTurn())}. How much more must you win when you hit?`,
          choices: [() => bb(impliedOddsNeeded(30, 10, fdTurn())), () => bb(10), () => bb(0)],
          answer: 0,
          why: () => `10 / ${pct(fdTurn())} − 30 − 10 = ${bb(impliedOddsNeeded(30, 10, fdTurn()))}.`,
        },
        { prompt: 'Which hand has the worst reverse implied odds?', choices: ['A low flush draw', 'The nut flush draw'], answer: 0, why: 'When a low flush gets there it can still lose to a bigger flush.' },
        { prompt: 'Implied odds are bigger when…', choices: ['Stacks are deep and villain pays off', 'Stacks are short'], answer: 0, why: 'There has to be money left to win later.' },
      ],
      drill: { route: '/train/math/play?kind=math.callfold&d=silver', label: 'Call or Fold (implied odds)' },
    },
    {
      id: 'equity-ev',
      title: 'Equity and expected value',
      minutes: 4,
      blurb: 'Your share of the pot, and what a decision is worth',
      blocks: [
        { kind: 'p', text: 'Equity is your share of the pot if all the cards were dealt out right now. Expected value (EV) is the average result of a decision over many repetitions.' },
        { kind: 'p', text: () => `Aces vs kings all-in preflop: aces win about ${pct(aaKk(), 0)} of the time (engine simulation).` },
        { kind: 'example', example: 'equity' },
        {
          kind: 'p',
          text: () => `EV of a call = equity × final pot − call. With 40% equity calling 10 into 20 (final pot 40): ${bb(evCall(20, 10, 0.4))}.`,
        },
        { kind: 'example', example: 'ev' },
        { kind: 'tip', text: 'Judge decisions by EV, not by whether you won the hand. A +EV call loses often and still makes money over time.' },
      ],
      quiz: [
        { prompt: 'Equity is…', choices: ['Your share of the pot if all cards were dealt now', 'How much money you have'], answer: 0, why: 'It’s a share of the pot across all run-outs.' },
        {
          prompt: 'EV of calling 10 into a pot of 20 (villain already bet) with 40% equity?',
          choices: [() => bb(evCall(20, 10, 0.4)), () => bb(-2), () => bb(0)],
          answer: 0,
          why: () => `0.4 × 40 − 10 = ${bb(evCall(20, 10, 0.4))}.`,
        },
        { prompt: 'You made a +EV call and lost. Was it a mistake?', choices: ['No', 'Yes'], answer: 0, why: 'Outcomes vary; the decision was profitable on average.' },
      ],
      drill: { route: '/train/math/play?kind=math.ev&d=bronze', label: 'EV Calculator drill' },
      moreDrills: [{ route: '/train/lab?guess=1', label: 'Range Lab: guess equity' }],
    },
    {
      id: 'combos',
      title: 'Combos and blockers',
      minutes: 3,
      blurb: 'Counting how many hands villain can have',
      blocks: [
        { kind: 'p', text: () => `A pocket pair has ${classCombos('QQ')} combos, a suited hand ${classCombos('AKs')}, an offsuit hand ${classCombos('AKo')} — so “AK” is ${classCombos('AK')} combos.` },
        { kind: 'p', text: 'Cards you can see (your hand and the board) remove combos. Holding an ace means villain has fewer aces.' },
        {
          kind: 'p',
          text: () => `On a K-7-2 board holding A-Q, villain has only ${classCombos('AK', 'AhQc Kd7s2c')} AK combos (3 aces × 3 kings) and ${classCombos('KK', 'AhQc Kd7s2c')} KK combos.`,
        },
        { kind: 'example', example: 'combos' },
      ],
      quiz: [
        { prompt: 'How many combos of JJ?', choices: [() => String(classCombos('JJ')), '4', '12'], answer: 0, why: 'C(4,2) = 6.' },
        {
          prompt: 'You hold {Ah} {Qc}; board {Kd} {7s} {2c}. How many AK combos can villain have?',
          choices: [() => String(classCombos('AK', 'AhQc Kd7s2c')), '16', '12'],
          answer: 0,
          why: '3 live aces × 3 live kings = 9.',
        },
        { prompt: 'Why do blockers matter for bluffing?', choices: ['Holding cards villain needs to call makes calls less likely', 'They don’t'], answer: 0, why: 'Fewer calling combos means more folds.' },
      ],
      drill: { route: '/train/math/play?kind=math.combos&d=bronze', label: 'Combo Counting' },
    },
    {
      id: 'mdf',
      title: 'MDF and bluff breakeven',
      minutes: 3,
      blurb: 'How often to defend, how often bluffs must work',
      blocks: [
        { kind: 'p', text: 'A pure bluff risks the bet to win the pot. It breaks even when villain folds bet / (pot + bet) of the time.' },
        { kind: 'p', text: 'Minimum defense frequency (MDF) is the flip side: to stop any-two-cards bluffs from profiting, defend at least pot / (pot + bet) of your range.' },
        {
          kind: 'list',
          items: [
            () => `Half pot: bluff needs ${pct(bluffBreakeven(1, 0.5))} folds; MDF ${pct(minimumDefenseFrequency(1, 0.5))}.`,
            () => `Pot: bluff needs ${pct(bluffBreakeven(1, 1))} folds; MDF ${pct(minimumDefenseFrequency(1, 1))}.`,
          ],
        },
        { kind: 'example', example: 'pot-odds' },
        { kind: 'tip', text: 'MDF is a defensive baseline against unknown opponents. Against players who rarely bluff you can fold more — that’s the Exploit Lab.' },
      ],
      quiz: [
        { prompt: 'A pot-size bluff needs villain to fold at least…', choices: [() => pct(bluffBreakeven(1, 1)), () => pct(1 / 3), '75%'], answer: 0, why: 'bet / (pot + bet) = 1 / 2.' },
        { prompt: 'Facing a half-pot bet, MDF is…', choices: [() => pct(minimumDefenseFrequency(1, 0.5)), () => pct(0.5), () => pct(0.25)], answer: 0, why: 'pot / (pot + bet) = 1 / 1.5.' },
        { prompt: 'Should you always defend exactly MDF?', choices: ['No — adjust to your opponent', 'Yes, always'], answer: 0, why: 'MDF protects against bluffs; against players who never bluff you can fold more.' },
      ],
      drill: { route: '/train/math/play?kind=math.mdf&d=bronze', label: 'Minimum Defense drill' },
    },
  ],
};
