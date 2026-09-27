/**
 * Analyse a postflop spot: villain's range, hero's equity against it, board texture, SPR,
 * and every option with an EV estimate and a Best / Acceptable / Mistake grade from rules.ts.
 * Used by the Postflop Trainer and by "Replay my spot".
 */
import { indexToString } from '../cards';
import { calculateEquity } from '../equity';
import type { Grade } from '../grading';
import { formatPercent } from '../math';
import { bluffBreakeven, minimumDefenseFrequency, potOdds } from '../odds';
import { BUCKETS, BUCKET_NAMES, classifyHand, type HandInfo } from '../postflop/buckets';
import { classifyRange, composition, continuingRange, streetOf, type Composition } from '../postflop/narrow';
import type { Spot } from '../postflop/scenario';
import type { Range } from '../range';
import { classifyBoard, type BoardTexture } from '../texture';
import { CBET_PLAN_TEXT, RULES, cbetHandRule, cbetPlan, sizeClass, type CbetPlan } from './rules';
import { forStreet } from './villainModel';

export interface OptionEval {
  id: string;
  label: string;
  action: 'check' | 'bet' | 'fold' | 'call' | 'raise';
  /** Chips put in by this action (bb). */
  amount: number;
  /** Bet size as a fraction of the pot (bets/raises). */
  fraction: number | null;
  allIn: boolean;
  ev: number;
  /** Villain fold frequency against this option (bets/raises). */
  foldPct?: number;
  /** Hero equity when called (bets/raises). */
  equityWhenCalled?: number;
  grade: Grade;
}

export interface SpotAnalysis {
  hero: HandInfo;
  heroEquity: number;
  villainCombos: number;
  villainComposition: Composition;
  texture: BoardTexture;
  spr: number;
  /** Hero range equity vs villain range (range advantage). */
  rangeEquity: number;
  heroNutShare: number;
  villainNutShare: number;
  plan: CbetPlan | null;
  options: OptionEval[];
  best: OptionEval;
  summary: string;
  steps: string[];
}

const heroCode = (spot: Spot) => spot.hero.map(indexToString).join('');
const boardCode = (spot: Spot) => spot.board.map(indexToString).join('');
const fmt = (x: number) => (Math.abs(x - Math.round(x)) < 0.05 ? String(Math.round(x)) : x.toFixed(1));
export const bb = (x: number) => `${fmt(x)}bb`;
export const signedBb = (x: number) => (Math.abs(x) < 0.05 ? '0bb' : `${x > 0 ? '+' : '−'}${fmt(Math.abs(x))}bb`);

function equityVs(spot: Spot, ranges: Range[], seed: number): number {
  return calculateEquity([heroCode(spot), ...ranges], { board: boardCode(spot), maxExactBoards: 150_000, iterations: 6000, seed }).players[0]!.equity;
}

function totalOf(r: Range): number {
  let s = 0;
  for (let i = 0; i < 1326; i++) s += r.weights[i]!;
  return s;
}

function describeComposition(c: Composition): string {
  return BUCKETS.filter((b) => c.share[b] >= 0.005)
    .map((b) => `${BUCKET_NAMES[b].split(' (')[0]} ${formatPercent(c.share[b], 0)}`)
    .join(', ');
}

export interface AnalyzeOptions {
  /** Bet sizes to offer as pot fractions (first-to-act spots). */
  sizes?: number[];
  seed?: number;
  /** Grade by c-bet rules instead of EV. */
  gradeBy?: 'cbet' | 'ev';
}

export function analyzeSpot(spot: Spot, opts: AnalyzeOptions = {}): SpotAnalysis {
  const seed = opts.seed ?? 20260927;
  const street = streetOf(spot.board);
  const hero = classifyHand(spot.hero[0], spot.hero[1], spot.board);
  const texture = classifyBoard(spot.board.map(indexToString).join(''));
  const dead = spot.hero;
  const villainClassified = spot.villains.map((v) => classifyRange(v.range, spot.board, dead));
  const comp = composition(villainClassified[0]!);
  const villainCombos = villainClassified[0]!.reduce((s, c) => s + c.weight, 0);
  const ranges = spot.villains.map((v) => v.range);
  const heroEquity = equityVs(spot, ranges, seed);
  const pot = spot.pot;
  const stack = spot.effectiveStack;
  const spr = stack / pot;
  const realize = street === 'river' ? 1 : spot.heroIP ? RULES.realization.ip : RULES.realization.oop;

  // Range and nut advantage (hero's whole range vs villain's).
  const rangeEquity = calculateEquity([spot.heroRange, ranges[0]!], { board: boardCode(spot), iterations: 2500, seed, forceMonteCarlo: true }).players[0]!.equity;
  const heroComp = composition(classifyRange(spot.heroRange, spot.board));
  const heroNutShare = heroComp.share.monster;
  const villainNutShare = comp.share.monster;

  const options: OptionEval[] = [];
  const foldAndCallEquity = (fraction: number, sourceRanges: { combos: ReturnType<typeof classifyRange> }[]) => {
    let fold = 1;
    let expectedCallers = 0;
    const cont: Range[] = [];
    for (const { combos } of sourceRanges) {
      const c = continuingRange(combos, fraction, forStreet(spot.model, street));
      const kept = combos.reduce((s, x) => s + x.weight, 0);
      const p = kept > 0 ? totalOf(c) / kept : 0;
      fold *= 1 - p;
      expectedCallers += p;
      cont.push(c);
    }
    const anyContinue = cont.every((r) => totalOf(r) > 0.001);
    // Average number of callers given that at least one calls (1 heads-up).
    const callersWhenCalled = fold < 1 ? expectedCallers / (1 - fold) : 1;
    return { fold, eq: anyContinue ? equityVs(spot, cont, seed + 1) : heroEquity, callers: Math.max(1, callersWhenCalled) };
  };
  const sources = spot.villains.map((_, i) => ({ combos: villainClassified[i]! }));

  if (spot.facingBet !== null) {
    const b = spot.facingBet;
    options.push({ id: 'fold', label: 'Fold', action: 'fold', amount: 0, fraction: null, allIn: false, ev: 0, grade: 'mistake' });
    const callAmt = Math.min(b, stack);
    options.push({
      id: 'call',
      label: `Call ${bb(callAmt)}`,
      action: 'call',
      amount: callAmt,
      fraction: null,
      allIn: callAmt >= stack,
      ev: heroEquity * realize * (pot + b + callAmt) - callAmt,
      grade: 'mistake',
    });
    if (stack > b) {
      const raiseTo = Math.min(stack, b * 3);
      const facing = (raiseTo - b) / (pot + b + raiseTo);
      const { fold, eq } = foldAndCallEquity(facing, sources);
      const allIn = raiseTo >= stack;
      options.push({
        id: 'raise',
        label: allIn ? `All-in ${bb(raiseTo)}` : `Raise to ${bb(raiseTo)}`,
        action: 'raise',
        amount: raiseTo,
        fraction: facing,
        allIn,
        ev: fold * (pot + b) + (1 - fold) * (eq * (allIn ? 1 : realize) * (pot + 2 * raiseTo) - raiseTo),
        foldPct: fold,
        equityWhenCalled: eq,
        grade: 'mistake',
      });
    }
  } else {
    options.push({ id: 'check', label: 'Check', action: 'check', amount: 0, fraction: null, allIn: false, ev: heroEquity * realize * pot, grade: 'mistake' });
    const sizes = opts.sizes ?? [0.33, 0.5, 0.75, 1];
    const seen = new Set<number>();
    for (const f of sizes) {
      const amount = Math.min(stack, Math.max(1, Math.round(pot * f * 2) / 2));
      if (seen.has(amount)) continue;
      seen.add(amount);
      const allIn = amount >= stack;
      const fraction = amount / pot;
      const { fold, eq, callers } = foldAndCallEquity(fraction, sources);
      options.push({
        id: `bet-${f}`,
        label: allIn ? `All-in ${bb(amount)}` : `Bet ${bb(amount)} (${f >= 1 ? (f === 1 ? 'pot' : `${f}x pot`) : `${Math.round(f * 100)}%`})`,
        action: 'bet',
        amount,
        fraction,
        allIn,
        ev: fold * pot + (1 - fold) * (eq * (allIn ? 1 : realize) * (pot + amount + callers * amount) - amount),
        foldPct: fold,
        equityWhenCalled: eq,
        grade: 'mistake',
      });
    }
  }

  // Grading.
  let plan: CbetPlan | null = null;
  let why = '';
  const bestEv = Math.max(...options.map((o) => o.ev));
  const tol = RULES.evTolerance * pot;
  if (opts.gradeBy === 'cbet' && spot.facingBet === null) {
    plan = cbetPlan(rangeEquity, heroNutShare - villainNutShare, texture.wetness);
    const rule = cbetHandRule(plan, hero, heroEquity);
    why = rule.why;
    for (const o of options) {
      const cls = sizeClass(o.action === 'check' ? null : o.fraction);
      o.grade = cls === rule.best ? 'best' : rule.acceptable.includes(cls) ? 'acceptable' : 'mistake';
    }
    // An option the EV estimate supports is never a Mistake (the estimate is one-street and rough).
    const ruleBestEv = Math.max(...options.filter((o) => o.grade === 'best').map((o) => o.ev), -Infinity);
    for (const o of options) if (o.grade === 'mistake' && Number.isFinite(ruleBestEv) && o.ev >= ruleBestEv - tol) o.grade = 'acceptable';
    // Exactly one Best: the best-EV option within the best size class.
    const bests = options.filter((o) => o.grade === 'best');
    if (bests.length > 1) {
      const top = bests.reduce((a, b) => (b.ev > a.ev ? b : a));
      for (const o of bests) if (o !== top) o.grade = 'acceptable';
    } else if (bests.length === 0) {
      // Rule's size class isn't offered (e.g. stack too short): fall back to EV.
      options.reduce((a, b) => (b.ev > a.ev ? b : a)).grade = 'best';
    }
  } else {
    const top = options.reduce((a, b) => (b.ev > a.ev ? b : a));
    for (const o of options) o.grade = o === top ? 'best' : bestEv - o.ev <= tol ? 'acceptable' : 'mistake';
  }
  const best = options.find((o) => o.grade === 'best')!;

  // Explanation: villain's range, how hero does against it, and why the size fits.
  const steps: string[] = [];
  steps.push(`Villain's range (${fmt(villainCombos)} combos): ${describeComposition(comp)}`);
  steps.push(`Your hand: ${hero.description} — ${formatPercent(heroEquity)} equity vs that range (engine${spot.villains.length > 1 ? `, vs ${spot.villains.length} opponents` : ''}).`);
  steps.push(`Board: ${texture.summary}. SPR = ${fmt(stack)} / ${fmt(pot)} = ${spr.toFixed(1)}.`);
  const evTop = options.reduce((a, b) => (b.ev > a.ev ? b : a));
  if (plan && evTop !== best && evTop.ev - best.ev > tol) {
    steps.push(
      `EV check: the one-street estimate prefers ${evTop.label} (≈ ${signedBb(evTop.ev)} vs ${signedBb(best.ev)}). The c-bet rule still prefers ${best.label}: it accounts for later streets and keeping your ranges balanced, which a one-street estimate can't see.`,
    );
  }
  if (plan) {
    steps.push(`Range advantage: your range has ${formatPercent(rangeEquity)} equity vs villain's. Nut share: you ${formatPercent(heroNutShare, 0)} vs villain ${formatPercent(villainNutShare, 0)}.`);
    steps.push(`Plan: ${CBET_PLAN_TEXT[plan]}`);
    steps.push(`For this hand: ${why}`);
  }
  if (spot.facingBet !== null) {
    const b = spot.facingBet;
    const po = potOdds(pot + b, b);
    steps.push(`Price: call / (pot + bet + call) = ${fmt(b)} / (${fmt(pot + b)} + ${fmt(b)}) = ${formatPercent(po.requiredEquity)}; you have ${formatPercent(heroEquity)}${street !== 'river' ? ` (× ${realize} realization ${spot.heroIP ? 'in position' : 'out of position'})` : ''}.`);
    steps.push(`MDF vs this bet: pot / (pot + bet) = ${formatPercent(minimumDefenseFrequency(pot, b))} of your range should continue.`);
  }
  for (const o of options) {
    const parts = [`${o.label}: EV ≈ ${signedBb(o.ev)}`];
    if (o.foldPct !== undefined) parts.push(`villain folds ${formatPercent(o.foldPct, 0)}${o.action === 'bet' ? ` (breakeven ${formatPercent(bluffBreakeven(pot, o.amount), 0)})` : ''}`);
    if (o.equityWhenCalled !== undefined) parts.push(`equity when called ${formatPercent(o.equityWhenCalled, 0)}`);
    steps.push(parts.join(' · '));
  }
  if (spr <= RULES.commitment.committedSpr && (hero.bucket === 'monster' || hero.bucket === 'strong' || hero.strongDraw)) {
    steps.push(`Commitment: at SPR ${spr.toFixed(1)} (≤ ${RULES.commitment.committedSpr}) this hand should be happy to get all the money in.`);
  }
  else if (spr <= RULES.commitment.topPairSpr && (hero.bucket === 'monster' || hero.bucket === 'strong')) {
    steps.push(`Commitment: at SPR ${spr.toFixed(1)} (≤ ${RULES.commitment.topPairSpr}) top pair good kicker or better is usually committed — plan to get the stack in by the river.`);
  }
  steps.push(`EVs are one-street estimates from the villain model (no raises${street !== 'river' ? `, equity realization ${realize}` : ''}).`);

  const summary = plan
    ? `${best.label} is best. ${CBET_PLAN_TEXT[plan]} ${why}`
    : spot.facingBet !== null
      ? `${best.label} is best: with ${formatPercent(heroEquity)} equity against villain's betting range, ${best.action === 'fold' ? 'the price is too high' : best.action === 'call' ? 'the price is right' : 'raising wins the most'}.`
      : `${best.label} has the highest EV (≈ ${signedBb(best.ev)}): ${hero.description.toLowerCase()} with ${formatPercent(heroEquity)} equity vs villain's range.`;

  return {
    hero,
    heroEquity,
    villainCombos,
    villainComposition: comp,
    texture,
    spr,
    rangeEquity,
    heroNutShare,
    villainNutShare,
    plan,
    options,
    best,
    summary,
    steps,
  };
}
