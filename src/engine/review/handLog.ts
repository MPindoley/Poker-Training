/**
 * Hands logged from real games, and their analysis: villain's likely range each street, hero's
 * equity against it, the price, and a verdict with a plain-English summary.
 */
import { cardIndex, parseCard } from '../cards';
import { calculateEquity } from '../equity';
import type { Grade } from '../grading';
import { formatPercent } from '../math';
import { potOdds } from '../odds';
import type { Chart, PreflopAction } from '../preflop/charts';
import { strategyFor } from '../preflop/charts';
import { ACTION_NAMES } from '../preflop/reasons';
import { classifyPreflopDecision } from '../preflop/line';
import { isoSize } from '../preflop/sizing';
import { COMBOS, type Range } from '../range';
import { bettingRange, checkingRange, classifyRange, continuingRange, type Street } from '../postflop/narrow';
import { preflopLineRanges, type PreflopLine } from '../postflop/replay';
import { actsAfter, type Spot } from '../postflop/scenario';
import { analyzeSpot, signedBb, type SpotAnalysis } from '../strategy/analyze';
import { HERO_LINE_MODEL, forStreet, type VillainModel } from '../strategy/villainModel';
import { rangeVisual } from '../postflop/drills';
import type { StrategyVisual } from '../drills/types';
import { chartAction, type DecisionReview } from '../game/coach';

export type LogStreet = 'preflop' | Street;
export type LogActionType = 'fold' | 'check' | 'call' | 'bet' | 'raise';

export interface LoggedAction {
  street: LogStreet;
  actor: 'hero' | 'villain';
  type: LogActionType;
  /** For bet/raise: the street total ("raise to"), in big blinds. Null = "I don't remember". */
  amount: number | null;
}

export interface LoggedHand {
  id: string;
  date: string;
  heroCards: string[];
  board: string[];
  heroSeat: string;
  villainSeat: string;
  /** Custom profile id for the opponent, if tagged. */
  villainProfileId?: string;
  /** Limpers who limped before the logged action (not logged as players), for limper spots. */
  limpers?: number;
  /** Effective stack at the start, in big blinds. */
  stackBb: number;
  /** Real-money big blind, for display ($ per bb). */
  bigBlind: number;
  actions: LoggedAction[];
  notes: string;
}

export interface ResolvedAction extends LoggedAction {
  /** Amount after estimation. */
  resolvedTo: number;
  /** Chips this action added. */
  added: number;
  estimated: boolean;
  potBefore: number;
}

export interface ReplayedHand {
  actions: ResolvedAction[];
  finalPot: number;
  heroInvested: number;
  anyEstimated: boolean;
}

const r2 = (x: number) => Math.round(x * 100) / 100;

/**
 * Walk the actions, filling unknown amounts with estimates:
 * preflop open 3bb (+1 per limper), re-raise 3x; postflop bet 2/3 pot, raise 3x.
 */
export function replayAmounts(hand: LoggedHand): ReplayedHand {
  const streets: LogStreet[] = ['preflop', 'flop', 'turn', 'river'];
  let pot = 0;
  const invested = { hero: 0, villain: 0 };
  const out: ResolvedAction[] = [];
  let anyEstimated = false;
  // Blinds: whoever sits in SB/BB posts; any other blinds are dead money.
  const blind = (seat: string) => (seat === 'SB' ? 0.5 : seat === 'BB' ? 1 : 0);
  const heroBlind = blind(hand.heroSeat);
  const villainBlind = blind(hand.villainSeat);
  pot = 1.5;
  invested.hero = heroBlind;
  invested.villain = villainBlind;
  for (const st of streets) {
    const acts = hand.actions.filter((a) => a.street === st);
    const street = { hero: st === 'preflop' ? heroBlind : 0, villain: st === 'preflop' ? villainBlind : 0 };
    let current = st === 'preflop' ? 1 : 0;
    let limpers = 0;
    for (const a of acts) {
      const potBefore = pot;
      let to = street[a.actor];
      let estimated = false;
      if (a.type === 'call') to = Math.max(street[a.actor], current);
      if (a.type === 'call' && st === 'preflop' && current === 1) limpers++;
      if (a.type === 'bet' || a.type === 'raise') {
        if (a.amount !== null) to = a.amount;
        else {
          estimated = true;
          if (st === 'preflop') to = current <= 1 ? 3 + limpers : current * 3;
          else to = current === 0 ? r2(pot * (2 / 3)) : current * 3;
        }
        current = Math.max(current, to);
      }
      const cap = hand.stackBb - (invested[a.actor] - street[a.actor]);
      to = Math.min(to, cap);
      const added = Math.max(0, to - street[a.actor]);
      street[a.actor] = to;
      invested[a.actor] += added;
      pot = r2(pot + added);
      anyEstimated ||= estimated;
      out.push({ ...a, resolvedTo: r2(to), added: r2(added), estimated, potBefore });
    }
  }
  return { actions: out, finalPot: pot, heroInvested: invested.hero, anyEstimated };
}

function preflopLine(actions: LoggedAction[]): PreflopLine {
  const raises = actions.filter((a) => a.street === 'preflop' && a.type === 'raise');
  if (!raises.length) return 'limped';
  const last = raises[raises.length - 1]!;
  if (raises.length === 1) return last.actor === 'hero' ? 'hero-open' : 'villain-open';
  return last.actor === 'hero' ? 'hero-3bet' : 'villain-3bet';
}

export interface StreetAnalysis {
  street: LogStreet;
  heroAction: ResolvedAction;
  analysis: SpotAnalysis | null;
  review: DecisionReview;
  /** Plain-English verdict. */
  summary: string;
  villainRange: StrategyVisual | null;
  potOddsNeeded: number | null;
}

export interface LoggedHandAnalysis {
  decisions: StreetAnalysis[];
  anyEstimated: boolean;
  line: PreflopLine;
  error: string | null;
}

const VERDICT: Record<Grade, string> = { best: 'right', acceptable: 'reasonable', mistake: 'a mistake' };

function actionLabel(a: ResolvedAction): string {
  const est = a.estimated ? ' (estimated)' : '';
  switch (a.type) {
    case 'fold':
      return 'Fold';
    case 'check':
      return 'Check';
    case 'call':
      return `Call ${a.added}bb`;
    case 'bet':
      return `Bet ${a.resolvedTo}bb${est}`;
    default:
      return `Raise to ${a.resolvedTo}bb${est}`;
  }
}

function actionVerb(a: ResolvedAction): string {
  switch (a.type) {
    case 'fold':
      return 'Folding';
    case 'check':
      return 'Checking';
    case 'call':
      return 'Calling';
    case 'bet':
      return `Betting ${a.resolvedTo}bb`;
    default:
      return `Raising to ${a.resolvedTo}bb`;
  }
}

/** Analyse every hero decision in a logged hand. */
export function analyzeLoggedHand(hand: LoggedHand, chart: Chart, model: VillainModel): LoggedHandAnalysis {
  const replay = replayAmounts(hand);
  const line = preflopLine(hand.actions);
  const decisions: StreetAnalysis[] = [];
  try {
    const heroCards = hand.heroCards.map((c) => cardIndex(parseCard(c))) as [number, number];
    const boardAll = hand.board.map((c) => cardIndex(parseCard(c)));
    const pre = preflopLineRanges(chart, { heroSeat: hand.heroSeat, villainSeat: hand.villainSeat, preflop: line });
    let heroRange: Range = pre.hero;
    let villainRange: Range = pre.villain;
    const heroIP = actsAfter(hand.heroSeat, hand.villainSeat);
    const heroLabel = (() => {
      const [a, b] = [...heroCards].sort((x, y) => y - x);
      return COMBOS.find((c) => c.c1 === a && c.c2 === b)!.label;
    })();

    // Preflop hero decisions: graded by the chart for the spot the action so far creates
    // (first in, behind limpers, squeeze, limped-and-raised, facing a 3-bet or 4-bet).
    const preActs = replay.actions.filter((a) => a.street === 'preflop');
    let raisesSeen = 0;
    for (let i = 0; i < preActs.length; i++) {
      const a = preActs[i]!;
      if (a.type === 'raise') raisesSeen++;
      if (a.actor !== 'hero') continue;
      const prior = preActs.slice(0, i).map((p) => ({ actor: p.actor, type: p.type }));
      const decision = classifyPreflopDecision(prior, 'hero', i === 0 || !prior.some((p) => p.type === 'raise') ? hand.limpers ?? 0 : 0);
      const kind = decision.kind;
      const spot =
        kind === 'vsOpen'
          ? chart.vsOpen(hand.heroSeat, hand.villainSeat)
          : kind === 'none'
            ? null
            : chart.spot({ kind, seat: hand.heroSeat, limpers: decision.count, callers: decision.count });
      const chosen: PreflopAction = chartAction(kind, a.type);
      let grade: Grade | null = null;
      let note = 'No chart for this preflop spot.';
      let evLost: number | null = null;
      const bbCheck = a.type === 'check' && (kind === 'rfi' || (kind === 'vsLimpers' && hand.heroSeat !== 'BB'));
      if (spot && !bbCheck) {
        const strat = strategyFor(spot, heroLabel);
        const f = strat.freq[chosen] ?? 0;
        grade = chosen === strat.main ? 'best' : f >= 0.25 ? 'acceptable' : 'mistake';
        const where =
          kind === 'vsOpen'
            ? ` vs ${hand.villainSeat}`
            : kind === 'vsLimpers'
              ? ` behind ${decision.count} limper${decision.count === 1 ? '' : 's'}`
              : kind === 'squeeze'
                ? ` facing an open and ${decision.count} caller${decision.count === 1 ? '' : 's'}`
                : kind === 'vsLimpRaise'
                  ? ' after limping into a raise'
                  : kind === 'vs4bet'
                    ? ' facing a 4-bet'
                    : '';
        note = `Chart plays ${heroLabel} from ${hand.heroSeat}${where} as ${(Object.entries(strat.freq) as [PreflopAction, number][])
          .filter(([, v]) => v > 0.005)
          .map(([k, v]) => `${k === 'limp' && kind === 'vsLimpers' ? 'Overlimp' : ACTION_NAMES[k]} ${formatPercent(v, 0)}`)
          .join(', ')}.`;
        // Blind calls: estimate the cost of a bad call with equity vs the opener's range.
        if (kind === 'vsOpen' && a.type === 'call' && grade === 'mistake') {
          const opener = chart.rfi(hand.villainSeat)?.ranges.raise;
          if (opener) {
            const eq = calculateEquity([hand.heroCards.join(''), opener], { iterations: 3000, seed: 5, forceMonteCarlo: true }).players[0]!.equity;
            const call = a.added;
            const ev = eq * 0.8 * (a.potBefore + call) - call;
            evLost = r2(Math.max(0, -ev));
          }
        }
      }
      decisions.push({
        street: 'preflop',
        heroAction: a,
        analysis: null,
        review: {
          street: 'preflop',
          action: actionLabel(a),
          grade,
          evLost,
          equity: null,
          best: spot ? ACTION_NAMES[strategyFor(spot, heroLabel).main] : null,
          note,
          tags: {
            facingBet: raisesSeen - (a.type === 'raise' ? 1 : 0) > 0,
            heroPos: hand.heroSeat,
            actionType: a.type,
            preflopKind: kind,
            preflopCount: decision.count,
            isoSize:
              kind === 'vsLimpers' && a.type === 'raise'
                ? { chosen: a.resolvedTo, recommended: isoSize(chart.id.startsWith('home') ? 'home' : 'casino', hand.heroSeat, decision.count).best }
                : undefined,
          },
        },
        summary: grade ? `${actionVerb(a)} ${heroLabel} preflop was ${VERDICT[grade]}. ${note}` : note,
        villainRange: null,
        potOddsNeeded: null,
      });
    }

    // Postflop: walk actions, narrowing ranges, analysing each hero decision.
    const streets: Street[] = ['flop', 'turn', 'river'];
    for (const st of streets) {
      const n = st === 'flop' ? 3 : st === 'turn' ? 4 : 5;
      const acts = replay.actions.filter((a) => a.street === st);
      if (!acts.length) continue;
      if (boardAll.length < n) break;
      const board = boardAll.slice(0, n);
      const streetIn = { hero: 0, villain: 0 };
      for (const a of acts) {
        const facing = Math.max(0, streetIn.villain - streetIn.hero);
        if (a.actor === 'hero') {
          const before = replay.actions.slice(0, replay.actions.indexOf(a)).filter((x) => x.actor === 'hero' && x.street !== st);
          const blindIn = hand.heroSeat === 'SB' ? 0.5 : hand.heroSeat === 'BB' ? 1 : 0;
          const stackLeft = hand.stackBb - blindIn - before.reduce((sum, x) => sum + x.added, 0);
          const spot: Spot = {
            theme: facing > 0 ? 'facing' : 'value',
            potType: line.includes('3bet') ? '3bet' : line === 'limped' ? 'limped' : 'srp',
            street: st,
            stackBb: hand.stackBb,
            board,
            hero: heroCards,
            heroSeat: hand.heroSeat,
            heroRange,
            heroIP,
            heroAggressor: line === 'hero-open' || line === 'hero-3bet',
            villains: [{ seat: hand.villainSeat, range: villainRange, stack: stackLeft, aggressor: false }],
            pot: a.potBefore - facing,
            effectiveStack: Math.max(0.5, stackLeft - streetIn.hero),
            facingBet: facing > 0 ? facing : null,
            checkedTo: facing === 0 && heroIP,
            history: [],
            rangeTrail: [],
            model,
          };
          const analysis = analyzeSpot(spot, { sizes: [0.33, 0.5, 0.75, 1] });
          const opt =
            a.type === 'fold'
              ? analysis.options.find((o) => o.action === 'fold')
              : a.type === 'check'
                ? analysis.options.find((o) => o.action === 'check')
                : a.type === 'call'
                  ? analysis.options.find((o) => o.action === 'call')
                  : [...analysis.options.filter((o) => o.action === 'bet' || o.action === 'raise')].sort((x, y) => Math.abs(x.amount - a.added) - Math.abs(y.amount - a.added))[0];
          const grade = opt?.grade ?? null;
          const need = facing > 0 ? potOdds(a.potBefore, facing).requiredEquity : null;
          const eq = analysis.heroEquity;
          const close = need !== null && Math.abs(eq - need) < 0.04;
          const vName = model.name === 'Solid regular (default)' ? 'villain' : model.name;
          const summary =
            grade === null
              ? analysis.summary
              : need !== null
                ? `${actionVerb(a)} ${analysis.hero.description.toLowerCase()} here was ${VERDICT[grade]}: against ${vName}'s ${st} betting range you had about ${formatPercent(eq, 0)} equity and needed ${formatPercent(need, 0)}.${close ? ' Close spot.' : ''}${grade !== 'best' ? ` Better: ${analysis.best.label}.` : ''}`
                : `${actionVerb(a)} with ${analysis.hero.description.toLowerCase()} was ${VERDICT[grade]}: you had about ${formatPercent(eq, 0)} equity against ${vName}'s range. ${grade !== 'best' ? `Best: ${analysis.best.label} (EV ≈ ${signedBb(analysis.best.ev)}).` : `EV ≈ ${signedBb(opt!.ev)}.`}`;
          const bestFrac = analysis.best.fraction;
          decisions.push({
            street: st,
            heroAction: a,
            analysis,
            review: {
              street: st,
              action: actionLabel(a),
              grade,
              evLost: opt ? r2(Math.max(0, analysis.best.ev - opt.ev)) : null,
              equity: eq,
              best: analysis.best.label,
              note: summary,
              tags: {
                facingBet: facing > 0,
                bucket: analysis.hero.bucket,
                heroPos: hand.heroSeat,
                villainArchetype: model.id.startsWith('arch:') ? model.id.slice(5) : undefined,
                villainFoldRiver: undefined,
                chosenFraction: a.type === 'bet' || a.type === 'raise' ? a.added / Math.max(1, a.potBefore) : null,
                bestFraction: bestFrac,
                actionType: a.type,
              },
            },
            summary,
            villainRange: rangeVisual(villainRange, `${hand.villainSeat}'s likely range on the ${st}`),
            potOddsNeeded: need,
          });
        }
        // Narrow ranges by this action.
        const frac = a.added / Math.max(1, a.potBefore);
        const facingFrac = facing / Math.max(1, a.potBefore - facing);
        const who = a.actor === 'hero' ? 'hero' : 'villain';
        const combos = classifyRange(who === 'hero' ? heroRange : villainRange, board);
        const m = who === 'hero' ? HERO_LINE_MODEL : forStreet(model, st);
        const next =
          a.type === 'bet' || a.type === 'raise'
            ? bettingRange(combos, Math.max(0.2, frac), m, st)
            : a.type === 'call'
              ? continuingRange(combos, a.actor === 'hero' ? facingFrac : Math.max(0.1, (streetIn.hero - streetIn.villain) / Math.max(1, a.potBefore - (streetIn.hero - streetIn.villain))), m)
              : a.type === 'check'
                ? checkingRange(combos, 0.5, m, st)
                : null;
        if (next) {
          if (who === 'hero') heroRange = next;
          else villainRange = next;
        }
        streetIn[a.actor] = a.resolvedTo;
      }
    }
    return { decisions, anyEstimated: replay.anyEstimated, line, error: null };
  } catch (e) {
    return { decisions, anyEstimated: replay.anyEstimated, line, error: (e as Error).message };
  }
}
