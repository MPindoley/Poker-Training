import { bluffBreakeven, classifyBoard, minimumDefenseFrequency, requiredEquity, STREET_BLUFF_FACTOR } from '../../engine';
import { pct } from './fmt';
import type { Unit } from './types';

const ratio = (b: number) => b / (1 + 2 * b);

export const UNIT4: Unit = {
  id: 'postflop',
  number: 4,
  title: 'Postflop',
  blurb: 'Advantage, texture, c-bets, sizing, value, bluffs, pot control',
  lessons: [
    {
      id: 'range-advantage',
      title: 'Range and nut advantage',
      minutes: 3,
      blurb: 'Whose range does the board hit?',
      blocks: [
        { kind: 'p', text: 'Range advantage: whose whole range has more equity on this board. Nut advantage: who has more of the very strongest hands.' },
        { kind: 'p', text: 'The preflop raiser usually has the advantage on high, dry boards (more big pairs and big aces). The caller does better on low, connected boards (more small pairs and suited connectors).' },
        { kind: 'example', example: 'texture' },
        { kind: 'p', text: 'Range advantage suggests betting often and small; nut advantage suggests betting big with a polarized range.' },
      ],
      quiz: [
        { prompt: 'A-high dry flop, you raised preflop from the button. Advantage?', choices: ['Usually yours', 'Usually the caller’s'], answer: 0, why: 'You have more strong aces and big pairs.' },
        { prompt: 'Nut advantage suggests…', choices: ['Bigger bets', 'Smaller bets'], answer: 0, why: 'You can threaten the stack with hands villain rarely has.' },
        { prompt: 'On 7-6-5 two-tone, who usually has more two pairs and straights?', choices: ['The caller', 'The preflop raiser'], answer: 0, why: 'Callers have more small suited connectors and pairs.' },
      ],
      drill: { route: '/train/postflop/play?theme=cbet', label: 'C-bet drills' },
    },
    {
      id: 'board-texture',
      title: 'Board texture',
      minutes: 3,
      blurb: 'Dry, semi-wet, wet — and why it matters',
      blocks: [
        { kind: 'p', text: () => `Dry boards change little on later cards: K-7-2 rainbow is “${classifyBoard('Kh7c2s').summary}”. Wet boards give lots of draws: J-T-9 two-tone is “${classifyBoard('JhTh9s').summary}”.` },
        { kind: 'list', items: ['Suits: rainbow, two-tone (flush draw possible), monotone (flush possible).', 'Pairing: paired boards reduce how many strong hands exist.', 'Connectedness: close ranks make straights and straight draws likely.', 'Height: high boards favour preflop raisers, low boards favour callers.'] },
        { kind: 'example', example: 'texture' },
      ],
      quiz: [
        { prompt: 'Which board is wettest?', choices: ['{Jh} {Th} {9s}', '{Kc} {7d} {2s}', '{As} {Ad} {4c}'], answer: 0, why: () => `The engine rates J-T-9 two-tone “${classifyBoard('JhTh9s').wetness}”.` },
        { prompt: 'Three cards of one suit on the flop is called…', choices: ['Monotone', 'Rainbow', 'Two-tone'], answer: 0, why: 'All one suit.' },
        { prompt: 'On dry boards, draws are…', choices: ['Rare', 'Common'], answer: 0, why: 'Few straight or flush draws are possible.' },
      ],
      drill: { route: '/train/postflop/play?theme=cbet', label: 'C-bet drills' },
    },
    {
      id: 'cbetting',
      title: 'Continuation betting',
      minutes: 3,
      blurb: 'When to fire the flop',
      blocks: [
        { kind: 'p', text: 'A continuation bet (c-bet) is a bet on the flop by the preflop raiser. With range advantage on a dry board, small c-bets with most of your range work well.' },
        { kind: 'p', text: 'On boards that favour the caller, check more and bet only strong hands and good draws.' },
        { kind: 'p', text: () => `A small 1/3-pot c-bet only needs to work ${pct(bluffBreakeven(1, 1 / 3))} of the time as a pure bluff; a 3/4-pot bet needs ${pct(bluffBreakeven(1, 0.75))}.` },
        { kind: 'tip', text: 'The Postflop Trainer grades c-bets with the documented plan in src/engine/strategy/rules.ts.' },
        { kind: 'example', example: 'texture' },
      ],
      quiz: [
        { prompt: 'You raised preflop; flop K-7-2 rainbow; villain called from the BB. Good default?', choices: ['Small c-bet with most hands', 'Check everything', 'Overbet everything'], answer: 0, why: 'You have the range advantage on a dry board.' },
        { prompt: 'A 1/3-pot c-bet bluff breaks even when villain folds…', choices: [() => pct(bluffBreakeven(1, 1 / 3)), () => pct(0.5), () => pct(0.33)], answer: 0, why: 'bet / (pot + bet) = (1/3) / (4/3).' },
        { prompt: 'On low connected boards vs a BB caller, you should…', choices: ['Check more', 'Always bet'], answer: 0, why: 'The caller’s range hits those boards harder.' },
      ],
      drill: { route: '/train/postflop/play?theme=cbet', label: 'C-bet drills' },
    },
    {
      id: 'sizing-theory',
      title: 'Bet sizing theory',
      minutes: 3,
      blurb: 'Small on dry boards, big on wet ones',
      blocks: [
        { kind: 'p', text: 'On dry boards your opponent has few strong hands and few draws: small bets deny little and still get called by worse. On wet boards big bets charge draws and protect your hand.' },
        {
          kind: 'list',
          items: [
            () => `1/3 pot: villain needs ${pct(requiredEquity(1, 1 / 3).requiredEquity)} to call; MDF ${pct(minimumDefenseFrequency(1, 1 / 3))}.`,
            () => `2/3 pot: villain needs ${pct(requiredEquity(1, 2 / 3).requiredEquity)}; MDF ${pct(minimumDefenseFrequency(1, 2 / 3))}.`,
            () => `Pot: villain needs ${pct(requiredEquity(1, 1).requiredEquity)}; MDF ${pct(minimumDefenseFrequency(1, 1))}.`,
          ],
        },
        { kind: 'p', text: () => `Balanced river bets carry bluffs in the ratio bet/(pot + 2·bet): ${pct(ratio(0.5))} bluffs for a half-pot bet, ${pct(ratio(1))} for a pot bet.` },
        { kind: 'example', example: 'pot-odds' },
      ],
      quiz: [
        { prompt: 'Big bets are most useful on…', choices: ['Wet boards', 'Dry boards'], answer: 0, why: 'They charge draws and build the pot for strong hands.' },
        { prompt: 'Balanced bluff share for a pot-size river bet?', choices: [() => pct(ratio(1)), () => pct(0.5), () => pct(0.1)], answer: 0, why: '1 / (1 + 2) = one third.' },
        { prompt: 'Why bet small on K-7-2 rainbow?', choices: ['Villain has few strong hands or draws to charge', 'Small bets are always best'], answer: 0, why: 'Small bets get the job done cheaply there.' },
      ],
      drill: { route: '/train/postflop/play?theme=cbet', label: 'C-bet sizing' },
    },
    {
      id: 'value-betting',
      title: 'Value betting',
      minutes: 3,
      blurb: 'Bet when worse hands call',
      blocks: [
        { kind: 'p', text: 'A value bet wants to be called by worse hands. Ask: which hands call, and do I beat most of them? If yes, bet.' },
        { kind: 'p', text: 'Thin value: betting a medium-strength hand that beats just over half of the calling range. It is profitable against players who call too much, and a mistake against players who only call with better.' },
        { kind: 'p', text: 'Size for maximum value: the biggest size that still gets called by enough worse hands. Against calling stations that is often big.' },
        { kind: 'example', example: 'ev' },
      ],
      quiz: [
        { prompt: 'A value bet wants…', choices: ['Calls from worse hands', 'Folds from worse hands'], answer: 0, why: 'You make money when worse hands pay you.' },
        { prompt: 'Thin value works best against…', choices: ['Players who call too much', 'Nits'], answer: 0, why: 'They call with more worse hands.' },
        { prompt: 'Against a calling station with the nuts, size…', choices: ['Big', 'Tiny'], answer: 0, why: 'They call big bets with worse hands.' },
      ],
      drill: { route: '/train/postflop/play?theme=value', label: 'Value betting' },
    },
    {
      id: 'bluffing',
      title: 'Bluffing and semi-bluffing',
      minutes: 3,
      blurb: 'Pick good bluffs, not random ones',
      blocks: [
        { kind: 'p', text: 'A semi-bluff is a bet with a draw: you win when villain folds and sometimes when called. That makes it much better than a pure bluff.' },
        { kind: 'p', text: () => `Earlier streets allow more bluffing because draws still have equity — the villain model uses ${STREET_BLUFF_FACTOR.flop}× the river bluff share on the flop and ${STREET_BLUFF_FACTOR.turn}× on the turn.` },
        { kind: 'p', text: 'Good bluffs hold blockers to villain’s calling hands (the ace of the flush suit) and have backup equity. Bad bluffs are hands that beat villain’s bluffs anyway (just check them down).' },
        { kind: 'todo', text: 'The 1.6x / 1.25x street bluff multipliers are simplified model values chosen for teaching.' },
        { kind: 'example', example: 'pot-odds' },
      ],
      quiz: [
        { prompt: 'A semi-bluff is…', choices: ['A bet with a drawing hand', 'A bet with the nuts'], answer: 0, why: 'It can win by fold equity or by improving.' },
        { prompt: 'Good river bluff candidate on a 3-flush board?', choices: ['A hand with the ace of that suit', 'Middle pair'], answer: 0, why: 'It blocks the nut flush calls; middle pair has showdown value.' },
        { prompt: 'Against a calling station you should…', choices: ['Bluff rarely', 'Bluff more'], answer: 0, why: 'They don’t fold enough for bluffs to work.' },
      ],
      drill: { route: '/train/postflop/play?theme=bluff', label: 'Bluffing drills' },
    },
    {
      id: 'pot-control',
      title: 'Pot control and check-raising',
      minutes: 3,
      blurb: 'Keep medium hands cheap; raise your best hands and draws',
      blocks: [
        { kind: 'p', text: 'Medium-strength hands (second pair, weak top pair) like small pots: check to control the size, call reasonable bets, and avoid turning your hand into a bluff.' },
        { kind: 'p', text: 'Check-raising out of position builds the pot with strong hands and puts pressure on c-bets with strong draws. Mix both so you are not predictable.' },
        { kind: 'todo', text: 'This lesson gives qualitative guidance; check-raise frequencies are not modelled by the engine yet.' },
        { kind: 'example', example: 'spr' },
      ],
      quiz: [
        { prompt: 'With second pair on a wet board, often…', choices: ['Check and control the pot', 'Overbet'], answer: 0, why: 'Big bets fold worse and get called by better.' },
        { prompt: 'Good check-raise hands include…', choices: ['Sets and strong draws', 'Ace-high'], answer: 0, why: 'Value hands and semi-bluffs with lots of equity.' },
        { prompt: 'Pot control is for…', choices: ['Medium-strength hands', 'The nuts'], answer: 0, why: 'Strong hands want big pots.' },
      ],
      drill: { route: '/train/postflop/play?theme=facing', label: 'Facing bets' },
    },
  ],
};
