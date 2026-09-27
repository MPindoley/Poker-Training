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
import { callingRange, classifyRange, composition, continuingRange, raisingRange, streetOf, type Composition } from '../postflop/narrow';
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
  /** Chance villain raises (check-raises) this bet/raise. */
  raisePct?: number;
  /** Villain's raise-to size (bb) if it raises. */
  raiseTo?: number;
  /** Hero equity against the raising range. */
  equityVsRaise?: number;
  /** Hero's best response if raised. */
  vsRaise?: 'fold' | 'call';
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

/**
 * Size of an action as the villain model reads it: the amount villain must call as a fraction of the
 * pot before it (a bet of B into P is B/P; a raise to R over a bet of b is (R − b) / (P + 2b)).
 */
export function betFractionFacing(potBefore: number, villainIn: number, heroTotal: number): number {
  return (heroTotal - villainIn) / (potBefore + 2 * villainIn);
}

export interface AnalyzeOptions {
  /** Bet sizes to offer as pot fractions (first-to-act spots). */
  sizes?: number[];
  seed?: number;
  /** Grade by c-bet rules instead of EV. */
  gradeBy?: 'cbet' | 'ev';
  /** Raise sizes offered when facing a bet, as multiples of the bet (default [3]). */
  raiseSizes?: number[];
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
  const sources = villainClassified;
  const liveRanges = (rs: Range[]) => rs.filter((r) => totalOf(r) > 0.001);
  let eqSeed = seed;

  /**
   * EV of hero putting `amount` in this street (a bet, or a raise over villain's `villainIn`), with each
   * villain folding, calling or raising per the model. If raised, hero takes the better of folding and
   * calling. Raise sizes are 3× (all-in when that's most of the stack).
   */
  const aggressive = (amount: number, villainIn: number) => {
    const allIn = amount >= stack;
    const price = betFractionFacing(pot, villainIn, amount);
    let fold = 1;
    let noRaise = 1;
    let expectedCallers = 0;
    let noCall = 1;
    const callRanges: Range[] = [];
    const raiseRanges: { range: Range; p: number }[] = [];
    for (let vi = 0; vi < sources.length; vi++) {
      const combos = sources[vi]!;
      const total = combos.reduce((t, c) => t + c.weight, 0);
      const m = forStreet(spot.villains[vi]?.model ?? spot.model, street);
      const callR = allIn ? continuingRange(combos, price, m) : callingRange(combos, price, m);
      const raiseR = allIn ? null : raisingRange(combos, price, m);
      const pc = total > 0 ? totalOf(callR) / total : 0;
      const pr = total > 0 && raiseR ? totalOf(raiseR) / total : 0;
      fold *= 1 - pc - pr;
      noRaise *= 1 - pr;
      noCall *= 1 - pc;
      expectedCallers += pc;
      callRanges.push(callR);
      if (raiseR && pr > 0) raiseRanges.push({ range: raiseR, p: pr });
    }
    const pRaise = 1 - noRaise;
    const pCall = Math.max(0, 1 - fold - pRaise);
    const callers = noCall < 1 ? Math.max(1, expectedCallers / (1 - noCall)) : 1;
    const live = liveRanges(callRanges);
    const eqCall = live.length ? equityVs(spot, live, ++eqSeed) : heroEquity;
    const evCalled = eqCall * (allIn ? 1 : realize) * (pot + amount * (1 + callers)) - amount;
    let evRaised = 0;
    let eqRaise: number | undefined;
    let raiseTo: number | undefined;
    let vsRaise: 'fold' | 'call' | undefined;
    if (pRaise > 0.0005) {
      raiseTo = Math.min(stack, amount * 3);
      if (raiseTo >= 0.6 * stack) raiseTo = stack;
      const totalP = raiseRanges.reduce((t, r) => t + r.p, 0);
      eqRaise = raiseRanges.reduce((t, r) => t + r.p * equityVs(spot, [r.range], ++eqSeed), 0) / totalP;
      const callRaise = eqRaise * (raiseTo >= stack ? 1 : realize) * (pot + 2 * raiseTo) - raiseTo;
      vsRaise = callRaise > -amount ? 'call' : 'fold';
      evRaised = Math.max(-amount, callRaise);
    }
    return {
      ev: fold * (pot + villainIn) + pCall * evCalled + pRaise * evRaised,
      fold,
      eqCall,
      raise: pRaise,
      raiseTo,
      eqRaise,
      vsRaise,
      allIn,
    };
  };
  const aggressiveOption = (id: string, label: string, action: 'bet' | 'raise', amount: number, villainIn: number): OptionEval => {
    const r = aggressive(amount, villainIn);
    return {
      id,
      label,
      action,
      amount,
      fraction: betFractionFacing(pot, villainIn, amount),
      allIn: r.allIn,
      ev: r.ev,
      foldPct: r.fold,
      equityWhenCalled: r.eqCall,
      raisePct: r.raise > 0.0005 ? r.raise : undefined,
      raiseTo: r.raiseTo,
      equityVsRaise: r.eqRaise,
      vsRaise: r.vsRaise,
      grade: 'mistake',
    };
  };

  if (spot.facingRaise) {
    // Hero bet and villain raised (check-raised): fold, call, or move all-in.
    const { heroBet, raiseTo } = spot.facingRaise;
    const callAmt = Math.min(raiseTo, stack) - heroBet;
    options.push({ id: 'fold', label: 'Fold', action: 'fold', amount: 0, fraction: null, allIn: false, ev: 0, grade: 'mistake' });
    options.push({
      id: 'call',
      label: `Call ${bb(callAmt)}`,
      action: 'call',
      amount: callAmt,
      fraction: null,
      allIn: raiseTo >= stack,
      ev: heroEquity * (raiseTo >= stack ? 1 : realize) * (pot + 2 * Math.min(raiseTo, stack)) - callAmt,
      grade: 'mistake',
    });
    if (stack > raiseTo) {
      // Villain can't raise an all-in: it folds or calls.
      const price = betFractionFacing(pot, raiseTo, stack);
      const combos = sources[0]!;
      const total = combos.reduce((t, c) => t + c.weight, 0);
      const cont = continuingRange(combos, price, forStreet(spot.villains[0]!.model ?? spot.model, street));
      const pc = total > 0 ? totalOf(cont) / total : 0;
      const eqJ = pc > 0 ? equityVs(spot, [cont], ++eqSeed) : heroEquity;
      options.push({
        id: 'jam',
        label: `All-in ${bb(stack)}`,
        action: 'raise',
        amount: stack - heroBet,
        fraction: price,
        allIn: true,
        ev: (1 - pc) * (pot + heroBet + raiseTo) + pc * (eqJ * (pot + 2 * stack) - (stack - heroBet)),
        foldPct: 1 - pc,
        equityWhenCalled: eqJ,
        grade: 'mistake',
      });
    }
  } else if (spot.facingBet !== null) {
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
      ev: heroEquity * (callAmt >= stack ? 1 : realize) * (pot + b + callAmt) - callAmt,
      grade: 'mistake',
    });
    if (stack > b) {
      const seen = new Set<number>();
      for (const mult of opts.raiseSizes ?? [3]) {
        const raiseTo = Math.min(stack, Math.round(b * mult * 2) / 2);
        if (seen.has(raiseTo)) continue;
        seen.add(raiseTo);
        const allIn = raiseTo >= stack;
        const word = spot.heroIP ? 'Raise' : 'Check-raise';
        options.push(aggressiveOption(`raise-${mult}`, allIn ? `All-in ${bb(raiseTo)}` : `${word} to ${bb(raiseTo)}`, 'raise', raiseTo, b));
      }
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
      options.push(
        aggressiveOption(`bet-${f}`, allIn ? `All-in ${bb(amount)}` : `Bet ${bb(amount)} (${f >= 1 ? (f === 1 ? 'pot' : `${f}x pot`) : `${Math.round(f * 100)}%`})`, 'bet', amount, 0),
      );
    }
  }

  // Grading.
  let plan: CbetPlan | null = null;
  let why = '';
  const bestEv = Math.max(...options.map((o) => o.ev));
  const tol = RULES.evTolerance * pot;
  if (opts.gradeBy === 'cbet' && spot.facingBet === null && !spot.facingRaise) {
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
  if (spot.facingRaise) {
    const { heroBet, raiseTo } = spot.facingRaise;
    const callAmt = Math.min(raiseTo, stack) - heroBet;
    const po = potOdds(pot + heroBet + raiseTo, callAmt);
    steps.push(`Price to call the raise: ${fmt(callAmt)} / (${fmt(pot + heroBet + raiseTo)} + ${fmt(callAmt)}) = ${formatPercent(po.requiredEquity)}; you have ${formatPercent(heroEquity)} vs the raising range.`);
  }
  for (const o of options) {
    const parts = [`${o.label}: EV ≈ ${signedBb(o.ev)}`];
    if (o.foldPct !== undefined) parts.push(`${spot.villains.length > 1 && !spot.facingRaise ? 'everyone folds' : 'villain folds'} ${formatPercent(o.foldPct, 0)}${o.action === 'bet' ? ` (breakeven ${formatPercent(bluffBreakeven(pot, o.amount), 0)})` : ''}`);
    if (o.equityWhenCalled !== undefined) parts.push(`equity when called ${formatPercent(o.equityWhenCalled, 0)}`);
    if (o.raisePct !== undefined && o.raisePct >= 0.005)
      parts.push(`raised ${formatPercent(o.raisePct, 0)} to ${bb(o.raiseTo!)} (you have ${formatPercent(o.equityVsRaise!, 0)} vs raises → ${o.vsRaise})`);
    steps.push(parts.join(' · '));
  }
  if (spr <= RULES.commitment.committedSpr && (hero.bucket === 'monster' || hero.bucket === 'strong' || hero.strongDraw)) {
    steps.push(`Commitment: at SPR ${spr.toFixed(1)} (≤ ${RULES.commitment.committedSpr}) this hand should be happy to get all the money in.`);
  }
  else if (spr <= RULES.commitment.topPairSpr && (hero.bucket === 'monster' || hero.bucket === 'strong')) {
    steps.push(`Commitment: at SPR ${spr.toFixed(1)} (≤ ${RULES.commitment.topPairSpr}) top pair good kicker or better is usually committed — plan to get the stack in by the river.`);
  }
  steps.push(
    `EVs are one-street estimates from the villain model: villains fold, call or raise (raises are 3×; if raised you fold or call)${street !== 'river' ? `, equity realization ${realize}` : ''}.`,
  );

  const summary = plan
    ? `${best.label} is best. ${CBET_PLAN_TEXT[plan]} ${why}`
    : spot.facingRaise
      ? `${best.label} is best: you have ${formatPercent(heroEquity)} against the hands that raise here${best.action === 'fold' ? ', not enough for the price' : best.action === 'call' ? ', enough to continue' : ' — get the rest in'}.`
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
