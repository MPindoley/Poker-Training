import { bigBlindPrice, buildCharts, hitProbability, rangeFraction, sizingRule, type ChartJson } from '../../engine';
import { CHART_LIBRARY } from '../../data/ranges';
import { pct } from './fmt';
import type { Unit } from './types';

const charts = () => buildCharts(CHART_LIBRARY as Record<string, ChartJson>);
const rfi = (id: string, seat: string) => rangeFraction(charts()[id]!.rfi(seat)!.ranges.raise!);
const def = (id: string, opener: string) => {
  const s = charts()[id]!.vsOpen('BB', opener)!;
  return { three: rangeFraction(s.ranges['3bet']!), call: rangeFraction(s.ranges.call!) };
};
const setOdds = () => hitProbability(2, 50, 3);
/** Stack-to-call ratio needed for set mining to break even on implied odds alone: win X when you hit. */
const setMineRatio = () => (1 - setOdds()) / setOdds();

export const UNIT3: Unit = {
  id: 'preflop',
  number: 3,
  title: 'Preflop',
  blurb: 'Ranges by seat, sizing, 3-bets, defense, limpers, set mining',
  lessons: [
    {
      id: 'opening-ranges',
      title: 'Opening ranges by seat',
      minutes: 3,
      blurb: 'Tight early, wide late',
      blocks: [
        { kind: 'p', text: 'When it folds to you, either raise or fold — limping invites a multi-way pot out of position. How wide you open depends on how many players are left to act.' },
        {
          kind: 'p',
          text: () => `The built-in 9-handed 100bb chart opens ${pct(rfi('cash-9max-100bb', 'UTG'), 0)} from UTG, ${pct(rfi('cash-9max-100bb', 'CO'), 0)} from the cutoff and ${pct(rfi('cash-9max-100bb', 'BTN'), 0)} from the button.`,
        },
        { kind: 'example', example: 'range-chart' },
        { kind: 'todo', text: 'The charts are close approximations of widely published solver-informed charts, not solver output — edit them in the Range Editor if your sources differ.' },
      ],
      quiz: [
        { prompt: 'Folded to you in early position with a marginal hand. Usually…', choices: ['Fold', 'Limp', 'Raise'], answer: 0, why: 'Many players are left to act; marginal hands lose money from early seats.' },
        { prompt: 'Why open wider on the button?', choices: ['Only the blinds are left, and you have position', 'The button is luckier'], answer: 0, why: 'Fewer players can wake up with a hand, and you act last after the flop.' },
        {
          prompt: () => 'In the home-game chart, is the UTG range tighter or looser than 9-handed cash?',
          choices: ['Tighter', 'Looser'],
          answer: 0,
          why: () => `Home ${pct(rfi('home-40bb', 'UTG'), 0)} vs cash ${pct(rfi('cash-9max-100bb', 'UTG'), 0)}: pots go multi-way at loose home games, so open slightly tighter.`,
        },
      ],
      drill: { route: '/train/preflop/paint', label: 'Paint the Range' },
    },
    {
      id: 'sizing',
      title: 'Open sizing',
      minutes: 3,
      blurb: '2.5x in the casino, bigger at home',
      blocks: [
        { kind: 'p', text: () => `Against solid players a small open works: ${sizingRule('casino', 'CO', 0).reason}` },
        { kind: 'p', text: () => `Against limpers: ${sizingRule('casino', 'BTN', 2).reason}` },
        { kind: 'p', text: () => `At a loose-passive home game: ${sizingRule('home', 'CO', 0).reason}` },
        { kind: 'example', example: 'sizing-price' },
        { kind: 'p', text: () => `Why it matters: the bigger the open, the worse the price for callers. At 2.5bb the big blind needs ${pct(bigBlindPrice(2.5))} to call; at 4bb it needs ${pct(bigBlindPrice(4))}.` },
      ],
      quiz: [
        { prompt: 'Two players limped. Casino rule of thumb?', choices: [() => `3bb + 1bb per limper = ${sizingRule('casino', 'BTN', 2).best}bb`, '2.5bb', '3bb'], answer: 0, why: () => sizingRule('casino', 'BTN', 2).reason },
        { prompt: 'Against a table that calls too much you should open…', choices: ['Bigger', 'Smaller'], answer: 0, why: 'Their weak calls pay more, and fewer of them come along.' },
        { prompt: 'A bigger open gives the big blind…', choices: ['A worse price', 'A better price'], answer: 0, why: () => `${pct(bigBlindPrice(2.5))} at 2.5bb vs ${pct(bigBlindPrice(4))} at 4bb.` },
      ],
      drill: { route: '/train/preflop/play?kind=preflop.sizing&d=silver', label: 'Sizing drill' },
    },
    {
      id: 'three-betting',
      title: '3-betting for value and as a bluff',
      minutes: 3,
      blurb: 'Why A5s gets 3-bet and KJo gets folded',
      blocks: [
        { kind: 'p', text: 'Your 3-bet range has two parts: value hands that want to build a big pot (QQ+, AK) and bluffs that do well when called or fold out better hands.' },
        { kind: 'p', text: 'Good 3-bet bluffs block villain’s strongest hands and play well when called: suited aces like A5s (blocks AA/AK, makes nut flushes and wheels) are classic.' },
        { kind: 'p', text: 'Offsuit hands like KJo are often dominated by the hands that continue vs a 3-bet (AK, KQ), so they are poor bluffs.' },
        { kind: 'p', text: () => `At a loose-passive home game, bluff 3-bets get called too often. The home chart 3-bets mostly for value: BB vs a late open 3-bets ${pct(def('home-40bb', 'CO').three, 1)} vs ${pct(def('cash-6max-100bb', 'CO').three, 1)} in the 6-max cash chart.` },
        { kind: 'example', example: 'range-chart' },
      ],
      quiz: [
        { prompt: 'Which is the better 3-bet bluff?', choices: ['A5s', 'KJo'], answer: 0, why: 'A5s blocks aces and plays well postflop; KJo is dominated.' },
        { prompt: 'At a table where everyone calls 3-bets, you should…', choices: ['3-bet more value, fewer bluffs', '3-bet more bluffs'], answer: 0, why: 'Bluffs need folds; value hands love calls.' },
        { prompt: 'The two reasons to 3-bet are…', choices: ['Value and bluffing', 'Luck and tilt'], answer: 0, why: 'Build a pot with strong hands or win it now with good bluff candidates.' },
      ],
      drill: { route: '/train/preflop/play?kind=preflop.flash&d=gold', label: 'Facing opens (Gold flash cards)' },
    },
    {
      id: 'blind-defense',
      title: 'Blind defense',
      minutes: 3,
      blurb: 'The big blind gets a discount',
      blocks: [
        { kind: 'p', text: () => `The big blind already has 1bb in, so it gets a great price: vs a 2.5bb open it needs only ${pct(bigBlindPrice(2.5))} equity to call.` },
        { kind: 'p', text: () => `So the BB defends wide vs late opens: the 6-max chart defends ${pct(def('cash-6max-100bb', 'BTN').three + def('cash-6max-100bb', 'BTN').call, 0)} of hands vs a button open but only ${pct(def('cash-6max-100bb', 'UTG').three + def('cash-6max-100bb', 'UTG').call, 0)} vs UTG.` },
        { kind: 'p', text: 'Being out of position hurts, so prefer hands that play well: suited hands, connected hands and pairs over weak offsuit hands.' },
        { kind: 'example', example: 'range-chart' },
      ],
      quiz: [
        { prompt: 'Why can the big blind call wider than other seats?', choices: ['It already has a blind in the pot', 'It acts last postflop'], answer: 0, why: 'The discount improves its pot odds (it acts first postflop, which hurts).' },
        { prompt: 'Vs which open should the BB defend widest?', choices: ['Button', 'UTG'], answer: 0, why: 'The button opens the widest range.' },
        { prompt: 'Which defends better from the BB?', choices: ['76s', 'K4o'], answer: 0, why: 'Suited connectors play better out of position than weak offsuit hands.' },
      ],
      drill: { route: '/train/preflop/play?kind=preflop.defense&d=bronze', label: 'Blind Defense' },
    },
    {
      id: 'limpers',
      title: 'Playing against limpers',
      minutes: 2,
      blurb: 'Isolate, don’t join the crowd',
      blocks: [
        { kind: 'p', text: 'Limpers usually have weak, capped ranges. Raise your good hands to isolate them and play heads-up with the initiative.' },
        { kind: 'p', text: () => `Size up: ${sizingRule('casino', 'CO', 1).reason}` },
        { kind: 'p', text: 'Over-limping with small pairs and suited connectors can be fine when many players are in and stacks are deep — you want implied odds.' },
        { kind: 'todo', text: 'Over-limp vs isolate thresholds vary by table; the guidance here is qualitative.' },
        { kind: 'example', example: 'sizing-price' },
      ],
      quiz: [
        { prompt: 'One player limps and you have AJo on the button. Usually…', choices: ['Raise to isolate', 'Limp behind', 'Fold'], answer: 0, why: 'AJo beats a limping range and plays well heads-up in position.' },
        { prompt: 'Iso-raise size with one limper (casino)?', choices: [() => `About ${sizingRule('casino', 'CO', 1).best}bb`, '2bb', '10bb'], answer: 0, why: () => sizingRule('casino', 'CO', 1).reason },
        { prompt: 'When is over-limping a small pair reasonable?', choices: ['Several limpers and deep stacks', 'Heads-up with short stacks'], answer: 0, why: 'You need a big pot to pay you when you hit a set.' },
      ],
      drill: { route: '/train/preflop/play?kind=preflop.sizing&d=silver', label: 'Sizing drill' },
    },
    {
      id: 'set-mining',
      title: 'Set mining',
      minutes: 3,
      blurb: 'When calling with a small pair pays',
      blocks: [
        { kind: 'p', text: () => `A pocket pair flops a set or better ${pct(setOdds())} of the time — about 1 in ${Math.round(1 / setOdds())}.` },
        {
          kind: 'p',
          text: () => `Ignoring the times you win without a set, calling to set-mine breaks even if you win about ${setMineRatio().toFixed(1)}× the call when you hit. That is where the popular “15-to-20 times the raise” stack rule comes from (extra room for the times your set loses or doesn’t get paid).`,
        },
        { kind: 'example', example: 'set-mining' },
        { kind: 'p', text: () => `At 40bb deep, calling a 4bb raise leaves about ${Math.round(36 / 4)}× the call behind — thin for set mining.` },
        { kind: 'todo', text: 'The 15–20x rule is a widely cited heuristic; the extra margin over the break-even ratio is a judgment call.' },
      ],
      quiz: [
        { prompt: 'How often does a pocket pair flop a set or better?', choices: [() => pct(setOdds()), () => pct(0.2), () => pct(0.05)], answer: 0, why: () => `1 − C(48,3)/C(50,3) = ${pct(setOdds())}.` },
        { prompt: 'Set mining needs…', choices: ['Deep stacks behind', 'Short stacks'], answer: 0, why: 'You must win a lot when you hit to cover all the misses.' },
        {
          prompt: 'Break-even payoff when you hit, as a multiple of the call?',
          choices: [() => `${setMineRatio().toFixed(1)}×`, () => '2×', () => '50×'],
          answer: 0,
          why: () => `(1 − p)/p with p = ${pct(setOdds())}.`,
        },
      ],
      drill: { route: '/train/math/play?kind=math.callfold&d=silver', label: 'Call or Fold (implied odds)' },
    },
  ],
};
