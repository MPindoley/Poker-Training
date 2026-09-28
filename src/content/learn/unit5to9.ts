import {
  ARCHETYPES,
  archetypeModel,
  bankrollFor,
  forStreet,
  icmEquity,
  referenceFold,
  resultRange,
  riskOfRuin,
  RULES,
  stackToPotRatio,
} from '../../engine';
import { bb, n, pct } from './fmt';
import type { Unit } from './types';

const foldTo = (id: keyof typeof ARCHETYPES, s: 'flop' | 'turn' | 'river') => referenceFold(forStreet(archetypeModel(id), s));

export const UNIT5: Unit = {
  id: 'hand-reading',
  number: 5,
  title: 'Hand Reading',
  blurb: 'Put villains on ranges and narrow them street by street',
  lessons: [
    {
      id: 'ranges-not-hands',
      title: 'Think in ranges, not hands',
      minutes: 3,
      blurb: 'Villain has a range — start from preflop',
      blocks: [
        { kind: 'p', text: 'You can’t know villain’s exact hand, but you can know their range: every hand they could have, weighted by how likely it is. Start from their preflop action: an early-position raise is strong; a late limp-call is wide and weak.' },
        { kind: 'p', text: 'Each action removes hands. Calling a flop bet removes most air; betting big on the river removes most medium hands.' },
        { kind: 'example', example: 'reading' },
      ],
      quiz: [
        { prompt: 'Your first step in reading a hand is…', choices: ['Estimate the preflop range', 'Guess one exact hand'], answer: 0, why: 'Ranges start preflop and get narrower with each action.' },
        { prompt: 'Villain calls a flop c-bet. Which hands are now less likely?', choices: ['Complete air', 'Top pair'], answer: 0, why: 'Air mostly folds to a bet.' },
        { prompt: 'Why weight hands in a range?', choices: ['Some hands take an action more often than others', 'All hands are equally likely'], answer: 0, why: 'A player may bet a draw half the time and a set almost always.' },
      ],
      drill: { route: '/train/postflop/play?theme=reading', label: 'Hand reading drills' },
      moreDrills: [{ route: '/train/lab?p=h:AhQd~r:AA%2CKK%2CAQ%2C77%2CQJs&b=Qc7s2h', label: 'Range Lab: what beats you' }],
    },
    {
      id: 'narrowing',
      title: 'Narrowing street by street',
      minutes: 3,
      blurb: 'Watch the range shrink',
      blocks: [
        { kind: 'p', text: 'After each street ask three questions: What did they do? Which hands in their range do that? Which hands would have done something else?' },
        { kind: 'p', text: 'A passive player who suddenly raises the turn has a much stronger range than an aggressive player doing the same. Profiles matter — see the Exploit Lab.' },
        { kind: 'example', example: 'reading' },
        { kind: 'tip', text: 'The engine narrows ranges with the villain model in src/engine/strategy/villainModel.ts; change the model and the ranges change.' },
      ],
      quiz: [
        { prompt: 'A nit bets big on the river. Their range is mostly…', choices: ['Strong hands', 'Bluffs'], answer: 0, why: 'Nits rarely bluff; big bets mean big hands.' },
        { prompt: 'Villain checks the turn after betting the flop. Often this means…', choices: ['Their range weakened (fewer strong hands)', 'They always have the nuts'], answer: 0, why: 'Strong hands usually keep betting; checks cap the range.' },
        { prompt: 'Good hand reading combines actions with…', choices: ['The player’s tendencies', 'Nothing else'], answer: 0, why: 'The same action means different things from different players.' },
      ],
      drill: { route: '/train/postflop/play?theme=reading', label: 'Hand reading drills' },
    },
  ],
};

export const UNIT6: Unit = {
  id: 'exploitative',
  number: 6,
  title: 'Exploitative Play',
  blurb: 'Player types, tells vs patterns, home games, table image',
  lessons: [
    {
      id: 'player-types',
      title: 'Player types',
      minutes: 3,
      blurb: 'Stations, nits, maniacs and more',
      blocks: [
        {
          kind: 'list',
          items: (Object.keys(ARCHETYPES) as (keyof typeof ARCHETYPES)[]).map(
            (id) => () => `${ARCHETYPES[id].name}: ${ARCHETYPES[id].description} Folds to a flop bet ${pct(foldTo(id, 'flop'), 0)}. Exploit: ${ARCHETYPES[id].exploit}`,
          ),
        },
        { kind: 'example', example: 'archetypes' },
      ],
      quiz: [
        { prompt: 'Against a calling station you should…', choices: ['Value bet big, bluff rarely', 'Bluff a lot'], answer: 0, why: () => `They fold to a river bet only ${pct(foldTo('station', 'river'), 0)} of the time.` },
        { prompt: 'Against a nit, big bets usually mean…', choices: ['A strong hand', 'A bluff'], answer: 0, why: 'Nits rarely bluff.' },
        { prompt: 'Early Folder, Late Sticker: where do bluffs work?', choices: ['On the flop', 'On the river'], answer: 0, why: () => `They fold to flop bets ${pct(foldTo('efls', 'flop'), 0)} but to river bets only ${pct(foldTo('efls', 'river'), 0)}.` },
      ],
      drill: { route: '/train/exploit/play?pack=compare', label: 'Same spot, 3 opponents' },
    },
    {
      id: 'tells-vs-patterns',
      title: 'Live tells vs betting patterns',
      minutes: 3,
      blurb: 'Trust patterns first, tells second',
      blocks: [
        { kind: 'p', text: 'Betting patterns are the most reliable read: how often someone raises, calls, folds to bets, and what they showed down. They repeat.' },
        { kind: 'p', text: 'Live tells (timing, posture, chatter) can help but are noisy and player-specific. Establish a baseline for each player before trusting a tell.' },
        { kind: 'todo', text: 'Specific tell meanings (e.g. “strong means weak”) are popular folklore with weak evidence; the app deliberately doesn’t teach universal tells. Review before adding any.' },
        { kind: 'tip', text: 'Record patterns in your player profiles (Exploit Lab) and update them after each session.' },
        { kind: 'example', example: 'archetypes' },
      ],
      quiz: [
        { prompt: 'Which read is usually more reliable?', choices: ['Betting patterns', 'A single physical tell'], answer: 0, why: 'Patterns repeat across many hands.' },
        { prompt: 'Before trusting a tell, you should…', choices: ['Know the player’s baseline behaviour', 'Assume it means the same for everyone'], answer: 0, why: 'Tells are individual.' },
        { prompt: 'Where should you store reads on regulars?', choices: ['Player profiles', 'Nowhere'], answer: 0, why: 'Profiles make your reads usable in drills and analysis.' },
      ],
      drill: { route: '/train/exploit', label: 'Exploit Lab' },
    },
    {
      id: 'home-games',
      title: 'Adjusting to home games',
      minutes: 3,
      blurb: 'Loose-passive tables, 40bb stacks',
      blocks: [
        { kind: 'p', text: 'Typical home games are loose and passive: many players see flops and call too much. That means value betting wins more than bluffing.' },
        { kind: 'list', items: ['Open a bit tighter and bigger (pots go multi-way).', 'Isolate limpers with bigger raises.', 'Value bet more streets and bigger; bluff less.', '3-bet more for value and fewer light bluffs.'] },
        { kind: 'p', text: () => `At about 40bb, SPR after a raised pot is small — often ${stackToPotRatio(36, 9).toFixed(1)} or less — so top pair is frequently a hand you get all-in with.` },
        { kind: 'example', example: 'sizing-price' },
      ],
      quiz: [
        { prompt: 'At a loose-passive table, you win most by…', choices: ['Value betting', 'Bluffing'], answer: 0, why: 'They call too much.' },
        { prompt: 'Open sizes at a home game should be…', choices: ['Bigger', 'Smaller'], answer: 0, why: 'Callers pay more with worse hands.' },
        { prompt: 'Light 3-bet bluffs at a home game are…', choices: ['Less profitable', 'More profitable'], answer: 0, why: 'They get called too often.' },
      ],
      drill: { route: '/train/preflop/play?kind=preflop.sizing&d=silver', label: 'Sizing (home mode)' },
    },
    {
      id: 'table-image',
      title: 'Table image',
      minutes: 3,
      blurb: 'When they fear you, use it',
      blocks: [
        { kind: 'p', text: 'Your image is what the table has seen: how many hands you play, how often you bet, and what you showed down. It fades as they see new hands.' },
        { kind: 'p', text: 'Tight and Feared: they fold marginal hands early, so bluff the flop more. But once someone calls your flop bet they have decided to see it through, so bluff the river less and value bet.' },
        { kind: 'p', text: 'Wild (they saw you bluff): they call much wider for a while. Stop bluffing and bet bigger for value until the memory fades.' },
        { kind: 'p', text: 'Card Dead (you have folded for ages): your bets look like the nuts. A good moment to steal.' },
        { kind: 'example', example: 'image', caption: 'The size of each shift is a readable assumption in engine/image, not solver output.' },
        { kind: 'example', example: 'archetypes' },
      ],
      quiz: [
        { prompt: 'Opponents fold too much against you. You should…', choices: ['Bluff more', 'Bluff less'], answer: 0, why: 'More folds make more bluffs profitable.' },
        { prompt: 'If a wild player sees you as weak, you should…', choices: ['Value bet more, bluff less', 'Bluff more'], answer: 0, why: 'They will call you lighter.' },
        { prompt: 'Your image changes…', choices: ['As players see your showdowns', 'Never'], answer: 0, why: 'People update on what you show.' },
        { prompt: 'You look Tight and Feared and a player called your flop and turn bets. On the river…', choices: ['Bluff less, value bet', 'Bluff more'], answer: 0, why: 'Feared players get folds early; the hands that stay are sticky.' },
      ],
      drill: { route: '/train/exploit/play?pack=exploit.imageShift', label: 'Image Shifts pack' },
    },
  ],
};

export const UNIT7: Unit = {
  id: 'stack-depth',
  number: 7,
  title: 'Stack Depth',
  blurb: 'Short stacks, SPR and commitment',
  lessons: [
    {
      id: 'short-stack',
      title: 'Short-stack play (~40bb)',
      minutes: 3,
      blurb: 'Fewer decisions, bigger ones',
      blocks: [
        { kind: 'p', text: 'At 40bb there is less room to maneuver. Hands that need implied odds (small pairs, suited connectors) go down in value; hands with high-card strength go up.' },
        { kind: 'p', text: 'After a raised preflop pot, stacks are often a few pot-sized bets deep, so plan whether you are willing to get it all in before you bet the flop.' },
        { kind: 'example', example: 'spr' },
      ],
      quiz: [
        { prompt: 'Short stacks make which hands better?', choices: ['High cards like AJ, KQ', 'Small pairs for set mining'], answer: 0, why: 'There is not enough money behind for implied odds.' },
        { prompt: 'Before betting the flop short-stacked, decide…', choices: ['Whether you’ll get it all in', 'Nothing'], answer: 0, why: 'At low SPR the flop bet often commits you.' },
        { prompt: 'At 40bb, suited connectors are…', choices: ['Worse than deep-stacked', 'Better'], answer: 0, why: 'They rely on implied odds.' },
      ],
      drill: { route: '/train/postflop/play?theme=short', label: 'Short stack drills' },
    },
    {
      id: 'spr',
      title: 'SPR and commitment',
      minutes: 3,
      blurb: 'Stack-to-pot ratio decides how far to go',
      blocks: [
        { kind: 'p', text: () => `SPR = effective stack / pot on the flop. With 36bb behind and a 9bb pot, SPR = ${stackToPotRatio(36, 9).toFixed(1)}.` },
        { kind: 'p', text: () => `Rule of thumb used by the trainer: at SPR ≤ ${RULES.commitment.committedSpr} strong hands and strong draws should get it in; at SPR ≤ ${RULES.commitment.topPairSpr} top pair good kicker or better is usually committed.` },
        { kind: 'example', example: 'spr' },
        { kind: 'todo', text: 'The commitment thresholds are heuristics (documented in rules.ts), not solver-derived.' },
      ],
      quiz: [
        { prompt: () => 'Stack 30bb, pot 15bb on the flop. SPR?', choices: [() => stackToPotRatio(30, 15).toFixed(1), '0.5', '45'], answer: 0, why: '30 / 15.' },
        { prompt: 'Low SPR with top pair good kicker usually means…', choices: ['Get it in', 'Fold to any bet'], answer: 0, why: () => `At SPR ≤ ${RULES.commitment.topPairSpr} it is usually committed.` },
        { prompt: 'High SPR favours…', choices: ['Hands that can make the nuts', 'One-pair hands'], answer: 0, why: 'Deep stacks reward very strong hands and punish overplaying one pair.' },
      ],
      drill: { route: '/train/postflop/play?theme=short', label: 'Short stack drills' },
    },
  ],
};

export const UNIT8: Unit = {
  id: 'tournaments',
  number: 8,
  title: 'Tournaments',
  blurb: 'ICM, push/fold and the bubble',
  lessons: [
    {
      id: 'icm',
      title: 'ICM basics',
      minutes: 4,
      blurb: 'Chips aren’t money',
      blocks: [
        { kind: 'p', text: 'In tournaments, chips don’t convert to money linearly. The Independent Chip Model (ICM) estimates each stack’s share of the prize pool.' },
        {
          kind: 'p',
          text: () => {
            const e = icmEquity([6000, 3000, 1000], [50, 30, 20]);
            return `Three players with 6,000 / 3,000 / 1,000 chips and prizes 50/30/20: the chip leader has ${pct(6000 / 10000, 0)} of the chips but ${pct(e[0]! / 100, 1)} of the money; the short stack has ${pct(1000 / 10000, 0)} of the chips but ${pct(e[2]! / 100, 1)}.`;
          },
        },
        { kind: 'example', example: 'icm' },
        { kind: 'p', text: 'Consequence: losing chips hurts more than winning the same chips helps, so you need extra equity to call all-ins near the money.' },
      ],
      quiz: [
        { prompt: 'Under ICM, the chip leader’s money share is…', choices: ['Less than their chip share', 'More than their chip share'], answer: 0, why: () => `e.g. ${pct(icmEquity([6000, 3000, 1000], [50, 30, 20])[0]! / 100)} of the prize pool with ${pct(6000 / 10000, 0)} of the chips.` },
        { prompt: 'Near the money, calling all-ins needs…', choices: ['More equity than chip odds suggest', 'Less equity'], answer: 0, why: 'Busting costs more than doubling up gains.' },
        { prompt: 'ICM ignores…', choices: ['Skill and position', 'Stack sizes'], answer: 0, why: 'It only uses stacks and payouts.' },
      ],
      drill: { route: '/train/math/play?kind=math.potodds&d=silver', label: 'Pot odds refresher' },
    },
    {
      id: 'push-fold',
      title: 'Push/fold',
      minutes: 4,
      blurb: 'Short stacks: all-in or fold',
      blocks: [
        { kind: 'p', text: 'Below about 15 big blinds, raising and folding to a shove wastes chips. Shoving all-in (push) or folding becomes the main strategy.' },
        { kind: 'p', text: 'The engine computes a simplified push chart: small blind vs big blind, where the big blind calls with a fixed top-X% range. EV(shove) = fold% × 1bb + call% × (equity × pot − stack), compared with folding (−0.5bb).' },
        { kind: 'example', example: 'push-fold' },
        { kind: 'todo', text: 'This is not a Nash-equilibrium chart; published Nash charts will differ at the margins. Compare before relying on it.' },
      ],
      quiz: [
        { prompt: 'Shorter stacks shove…', choices: ['Wider', 'Tighter'], answer: 0, why: 'Folding costs a bigger share of the stack, and fold equity is worth more.' },
        { prompt: 'Push/fold matters most below about…', choices: ['15bb', '100bb'], answer: 0, why: 'Deeper stacks have room to raise-fold.' },
        { prompt: 'Two ways a shove wins are…', choices: ['Folds and winning when called', 'Only folds'], answer: 0, why: 'Fold equity plus showdown equity.' },
      ],
      drill: { route: '/train/math/play?kind=math.ev&d=silver', label: 'EV drill' },
    },
    {
      id: 'bubble',
      title: 'Bubble play',
      minutes: 3,
      blurb: 'Pressure the medium stacks',
      blocks: [
        { kind: 'p', text: 'On the bubble (just before the money), medium stacks must avoid busting, so they fold more. Big stacks can apply pressure; short stacks can pick spots against players who can’t call.' },
        { kind: 'p', text: () => { const e = icmEquity([5000, 3000, 3000, 1000], [50, 30, 20]); return `Four players, three paid (50/30/20), stacks 5,000/3,000/3,000/1,000: the 1,000 stack still has ${pct(e[3]! / 100)} of the prize pool because someone else might bust first.`; } },
        { kind: 'todo', text: 'Bubble strategy depends heavily on payouts and stacks; the guidance here is general.' },
        { kind: 'example', example: 'icm' },
      ],
      quiz: [
        { prompt: 'On the bubble, medium stacks should…', choices: ['Avoid marginal all-ins', 'Call everything'], answer: 0, why: 'Busting before the money is costly under ICM.' },
        { prompt: 'Big stacks on the bubble can…', choices: ['Apply pressure', 'Only play premiums'], answer: 0, why: 'Others fold to avoid busting.' },
        { prompt: 'A short stack on the bubble has…', choices: ['More than zero equity', 'Zero equity'], answer: 0, why: 'Others may bust first.' },
      ],
      drill: { route: '/train/math/play?kind=math.bluff&d=silver', label: 'Bluff math' },
    },
  ],
};

export const UNIT9: Unit = {
  id: 'mental-game',
  number: 9,
  title: 'Mental Game and Bankroll',
  blurb: 'Tilt, variance, results vs decisions, bankroll rules',
  lessons: [
    {
      id: 'tilt',
      title: 'Tilt',
      minutes: 2,
      blurb: 'Notice it, name it, stop',
      blocks: [
        { kind: 'p', text: 'Tilt is when emotion replaces decision-making: calling to “see it”, bluffing to get even, chasing losses. Everyone tilts sometimes; winners notice early.' },
        { kind: 'list', items: ['Set a stop-loss before you sit down.', 'Take a break after a big pot, win or lose.', 'Review the hand later with the analyser instead of replaying it in your head.'] },
        { kind: 'todo', text: 'Mental-game advice here is general guidance, not clinical advice.' },
        { kind: 'example', example: 'variance' },
      ],
      quiz: [
        { prompt: 'A sign of tilt is…', choices: ['Playing hands to “get even”', 'Folding a weak hand'], answer: 0, why: 'Decisions driven by results, not EV.' },
        { prompt: 'A good anti-tilt habit is…', choices: ['A stop-loss', 'Doubling the stakes'], answer: 0, why: 'It limits damage when your judgment slips.' },
        { prompt: 'After a bad beat, you should…', choices: ['Take a breath or a break', 'Play the next hand faster'], answer: 0, why: 'Reset before the next decision.' },
      ],
      drill: { route: '/review', label: 'Review a hand' },
    },
    {
      id: 'variance',
      title: 'Variance and downswings',
      minutes: 3,
      blurb: 'Why winners lose for weeks',
      blocks: [
        {
          kind: 'p',
          text: () => {
            const r = resultRange(5, 90, 10_000);
            return `A solid winner at 5bb/100 with a standard deviation of 90bb/100 expects +${n(Math.round(r.expected))}bb over 10,000 hands, but 95% of the time lands anywhere from ${n(Math.round(r.low))} to +${n(Math.round(r.high))}bb — and is behind ${pct(r.losingChance, 0)} of the time.`;
          },
        },
        { kind: 'example', example: 'variance' },
        { kind: 'todo', text: 'The 90bb/100 standard deviation is a typical assumed value for no-limit cash; your own number may differ.' },
      ],
      quiz: [
        { prompt: 'A winning player can be behind after 10,000 hands?', choices: ['Yes, fairly often', 'Never'], answer: 0, why: () => `About ${pct(resultRange(5, 90, 10_000).losingChance, 0)} of the time in this example.` },
        { prompt: 'The swing (standard deviation) grows with…', choices: ['The square root of hands played', 'Hands played, linearly'], answer: 0, why: 'Expected results grow linearly, swings with √hands — so skill shows over time.' },
        { prompt: 'Short samples mostly measure…', choices: ['Luck', 'Skill'], answer: 0, why: 'Variance dominates small samples.' },
      ],
      drill: { route: '/review', label: 'Session tracker' },
    },
    {
      id: 'results-vs-decisions',
      title: 'Results vs decisions',
      minutes: 2,
      blurb: 'Grade the decision, not the outcome',
      blocks: [
        { kind: 'p', text: 'A good decision can lose and a bad one can win. Judge your play by EV: the Play tab separates your net result from your “all-in adjusted” result, which replaces lucky and unlucky run-outs with your equity when the money went in.' },
        { kind: 'p', text: 'The gap between the two is luck; EV lost to mistakes is what you control.' },
        { kind: 'example', example: 'equity' },
      ],
      quiz: [
        { prompt: 'All-in adjusted results remove…', choices: ['Luck of the run-out', 'Your mistakes'], answer: 0, why: 'They use your equity at the moment of the all-in.' },
        { prompt: 'You got it in as an 80% favourite and lost. Your decision was…', choices: ['Good', 'Bad'], answer: 0, why: 'It was +EV.' },
        { prompt: 'What should you review after a session?', choices: ['Decisions graded Mistake', 'Only the pots you lost'], answer: 0, why: 'Mistakes are the part you can fix.' },
      ],
      drill: { route: '/play', label: 'Play with the coach' },
    },
    {
      id: 'bankroll',
      title: 'Bankroll rules',
      minutes: 3,
      blurb: 'How much you need to survive the swings',
      blocks: [
        {
          kind: 'p',
          text: () =>
            `Risk of ruin (cash, normal approximation) = exp(−2 × winrate × bankroll / sd²). A 5bb/100 winner with 90bb/100 standard deviation and 30 buy-ins of 100bb (3,000bb) has a ${pct(riskOfRuin(5, 90, 3000))} chance of going broke.`,
        },
        { kind: 'p', text: () => `For a 5% risk of ruin they’d need ${n(Math.round(bankrollFor(5, 90, 0.05)))}bb, or about ${Math.round(bankrollFor(5, 90, 0.05) / 100)} buy-ins of 100bb.` },
        { kind: 'p', text: () => `In a $20 home game at 40bb, one buy-in is ${bb(40)}; the same formula applies — plug in your own win rate once you have enough hands logged.` },
        { kind: 'todo', text: 'Tournament bankroll rules (often 50–100+ buy-ins) are widely cited heuristics that depend on field size; the app does not compute them.' },
        { kind: 'example', example: 'variance' },
      ],
      quiz: [
        { prompt: 'Doubling your bankroll makes risk of ruin…', choices: ['Much smaller (it’s exponential)', 'Half as big'], answer: 0, why: () => `exp(−2·wr·B/sd²) squares when B doubles: ${pct(riskOfRuin(5, 90, 3000))} → ${pct(riskOfRuin(5, 90, 6000))}.` },
        { prompt: 'A losing player’s risk of ruin is…', choices: ['100% eventually', '0%'], answer: 0, why: 'With negative win rate, the bankroll drifts to zero.' },
        { prompt: 'Higher variance means you need…', choices: ['A bigger bankroll', 'A smaller bankroll'], answer: 0, why: 'sd² is in the denominator.' },
      ],
      drill: { route: '/review', label: 'Session tracker' },
    },
  ],
};
