/**
 * Postflop Trainer drill packs, one per theme. Filters (street, pot type) are encoded in the
 * variant string "theme|street|potType|extra" so the spaced-repetition layer tracks them too.
 */
import { indexToString } from '../cards';
import type { Grade } from '../grading';
import { HAND_GRID } from '../hands';
import { formatPercent } from '../math';
import type { Chart } from '../preflop/charts';
import { classComboIndices, COMBOS, type Range } from '../range';
import type { Rng } from '../rng';
import { analyzeSpot, bb, signedBb, type SpotAnalysis } from '../strategy/analyze';
import { RULES } from '../strategy/rules';
import type { VillainModel } from '../strategy/villainModel';
import { finalizeChoices, percentChoices, type Candidate } from '../drills/choices';
import type { DrillDef } from '../drills/math';
import type { Difficulty, Question, StrategyVisual } from '../drills/types';
import { BUCKET_NAMES } from './buckets';
import { classifyRange, composition, continuingRange, type Street } from './narrow';
import { POT_TYPE_NAMES, THEME_NAMES, generateSpot, type PotType, type Spot, type Theme } from './scenario';

export const THEMES: readonly Theme[] = ['cbet', 'value', 'bluff', 'facing', 'reading', 'short'];
export const STREETS: readonly Street[] = ['flop', 'turn', 'river'];
export const POT_TYPES: readonly PotType[] = ['srp', '3bet', 'limped', 'multiway'];

export interface PostflopFilters {
  streets?: Street[];
  potTypes?: PotType[];
}

export interface PostflopContext {
  chart: Chart;
  /** 40bb spots use this chart instead (e.g. the home-game chart). */
  shortChart: Chart;
  model: VillainModel;
  filters: PostflopFilters;
}

const THEME_SIZES: Record<Theme, number[]> = {
  cbet: [0.25, 0.33, 0.5, 0.66, 0.75, 1, 1.5],
  value: [0.33, 0.5, 0.66, 1, 1.5],
  bluff: [0.33, 0.5, 0.75, 1, 1.5],
  facing: [],
  reading: [],
  short: [0.33, 0.5, 99],
};

export function rangeVisual(range: Range, caption: string, highlight?: string, color = '#f5b820'): StrategyVisual {
  const cells: StrategyVisual['cells'] = {};
  for (const h of HAND_GRID.flat()) {
    const idx = classComboIndices(h.label);
    cells[h.label] = { in: idx.reduce((s, i) => s + range.weights[i]!, 0) / idx.length };
  }
  return { kind: 'strategy', cells, actions: [{ id: 'in', label: 'In range', color }], highlight, caption };
}

function heroLabel(spot: Spot): string {
  const [a, b] = spot.hero.slice().sort((x, y) => y - x) as [number, number];
  return COMBOS.find((c) => c.c1 === a && c.c2 === b)!.label;
}

function baseContext(spot: Spot, a: SpotAnalysis): Question['context'] {
  const v = spot.villains.map((x) => x.seat).join(' & ');
  return {
    hero: spot.hero.map(indexToString),
    board: spot.board.map(indexToString),
    villain: `You: ${spot.heroSeat} (${spot.heroIP ? 'in position' : 'out of position'}) vs ${v}${spot.villains.length > 1 ? '' : ` · ${spot.model.name}`}`,
    lines: [
      ...spot.history.map((h) => h.text),
      spot.facingBet !== null
        ? `Now: ${spot.heroIP ? '' : 'you check, '}${spot.villains[0]!.seat} bets ${bb(spot.facingBet)} into ${bb(spot.pot)}.`
        : spot.checkedTo
          ? `Now: ${v} check${spot.villains.length > 1 ? '' : 's'} to you.`
          : 'Now: you act first.',
    ],
    facts: [
      { label: 'Pot', value: bb(spot.pot) },
      { label: 'Stack', value: bb(spot.effectiveStack) },
      { label: 'SPR', value: a.spr.toFixed(1) },
      { label: 'Your equity', value: formatPercent(a.heroEquity) },
      { label: 'Board', value: a.texture.summary },
    ],
  };
}

function optionQuestion(spot: Spot, a: SpotAnalysis, difficulty: Difficulty, id: string, skill: string): Question {
  return {
    id,
    kind: `postflop.${spot.theme}`,
    skill,
    tags: [`postflop.street:${spot.street}`, `postflop.pot:${spot.potType}`],
    difficulty,
    prompt: spot.facingBet !== null ? 'Villain bets. Fold, call or raise?' : `${spot.street[0]!.toUpperCase()}${spot.street.slice(1)}: check or bet — and how much?`,
    context: baseContext(spot, a),
    choices: a.options.map((o, i) => ({ id: `o${i}`, label: o.label, grade: o.grade, note: `EV ≈ ${signedBb(o.ev)}` })),
    explanation: { summary: a.summary, steps: a.steps },
    visual: rangeVisual(spot.villains[0]!.range, `Villain's estimated range now (${POT_TYPE_NAMES[spot.potType]})`, heroLabel(spot)),
  };
}

// ---------------------------------------------------------------------------

function parseVariant(v: string): { theme: Theme; street?: Street; potType?: PotType; extra?: string } {
  const [theme, street, potType, extra] = v.split('|');
  return {
    theme: theme as Theme,
    street: street && street !== '*' ? (street as Street) : undefined,
    potType: potType && potType !== '*' ? (potType as PotType) : undefined,
    extra: extra || undefined,
  };
}

function spotFor(ctx: PostflopContext, rng: Rng, theme: Theme, street?: Street, potType?: PotType, extra?: Partial<Parameters<typeof generateSpot>[1]>): Spot {
  return generateSpot(rng, {
    theme,
    street,
    potType,
    chart: theme === 'short' ? ctx.shortChart : ctx.chart,
    model: ctx.model,
    ...extra,
  });
}

function themeQuestion(ctx: PostflopContext, rng: Rng, difficulty: Difficulty, variant: string, id: string): Question {
  const { theme, street, potType, extra } = parseVariant(variant);
  if (theme === 'reading') return readingQuestion(ctx, rng, difficulty, street, potType, id, variant);
  if (theme === 'value' && extra === 'streets') return streetsQuestion(ctx, rng, difficulty, potType, id, variant);
  if (theme === 'bluff' && extra === 'blockers') return blockerQuestion(ctx, rng, difficulty, potType, id, variant);
  const spot = spotFor(
    ctx,
    rng,
    theme,
    extra === 'tp-turn' ? 'turn' : street,
    potType,
    extra === 'tp-turn' ? { heroBuckets: ['strong', 'medium'], facingSize: [0.75, 1.25] } : undefined,
  );
  const a = analyzeSpot(spot, { sizes: THEME_SIZES[theme], gradeBy: theme === 'cbet' ? 'cbet' : 'ev', seed: Math.floor(rng() * 1e9) });
  const q = optionQuestion(spot, a, difficulty, id, `postflop.${variant}`);
  if (extra === 'tp-turn') q.prompt = 'Top pair facing a big turn bet. Fold, call or raise?';
  return q;
}

function streetsQuestion(ctx: PostflopContext, rng: Rng, difficulty: Difficulty, potType: PotType | undefined, id: string, variant: string): Question {
  const spot = spotFor(ctx, rng, 'value', 'flop', potType);
  const a = analyzeSpot(spot, { sizes: [0.66], seed: Math.floor(rng() * 1e9) });
  const bet = a.options.find((o) => o.action === 'bet')!;
  const eq = bet.equityWhenCalled ?? a.heroEquity;
  const [one, two, three] = RULES.streetsOfValue;
  const streets = eq >= three ? 3 : eq >= two ? 2 : eq >= one ? 1 : 0;
  const near = [one, two, three].some((t) => Math.abs(eq - t) < 0.03);
  const cands: Candidate[] = [0, 1, 2, 3].map((n) => ({
    label: n === 0 ? '0 (check)' : `${n} street${n > 1 ? 's' : ''}`,
    grade: (n === streets ? 'best' : near && Math.abs(n - streets) === 1 ? 'acceptable' : 'mistake') as Grade,
  }));
  return {
    id,
    kind: 'postflop.value',
    skill: `postflop.${variant}`,
    tags: [`postflop.street:flop`, `postflop.pot:${spot.potType}`],
    difficulty,
    prompt: `How many streets of value can ${a.hero.description.toLowerCase()} get here?`,
    context: baseContext(spot, a),
    choices: cands.map((c, i) => ({ id: `c${i}`, ...c })),
    explanation: {
      summary: `Against the hands that call a 2/3-pot bet you have ${formatPercent(eq)} equity, so plan for ${streets} street${streets === 1 ? '' : 's'} of value.`,
      steps: [
        a.steps[0]!,
        `Villain continues vs 2/3 pot ${formatPercent(1 - (bet.foldPct ?? 0), 0)} of the time; your equity vs those hands: ${formatPercent(eq)}.`,
        `Rule of thumb (rules.ts): ≥ ${formatPercent(three, 0)} → 3 streets, ≥ ${formatPercent(two, 0)} → 2, ≥ ${formatPercent(one, 0)} → 1, else check.`,
        'Each street the calling range gets stronger, so thin value runs out fast.',
      ],
    },
    visual: rangeVisual(continuingRange(classifyRange(spot.villains[0]!.range, spot.board, spot.hero), 0.66, ctx.model), 'Hands that call a 2/3-pot bet', heroLabel(spot)),
  };
}

function blockerQuestion(ctx: PostflopContext, rng: Rng, difficulty: Difficulty, potType: PotType | undefined, id: string, variant: string): Question {
  for (let tries = 0; tries < 12; tries++) {
    const spot = spotFor(ctx, rng, 'bluff', 'river', potType, { heroBuckets: ['air'] });
    const air = classifyRange(spot.heroRange, spot.board).filter((c) => c.info.bucket === 'air');
    if (air.length < 2) continue;
    const bluffEv = (c1: number, c2: number) => {
      const combos = classifyRange(spot.villains[0]!.range, spot.board, [c1, c2]);
      const all = combos.reduce((s, c) => s + c.weight, 0);
      const cont = continuingRange(combos, 1, ctx.model);
      let calls = 0;
      cont.weights.forEach((w) => (calls += w));
      const fold = all > 0 ? 1 - calls / all : 0;
      return { fold, calls, ev: fold * spot.pot - (1 - fold) * spot.pot };
    };
    // Score a sample of hero's bluffs and contrast the best blocker hand with the worst.
    const sample = [...new Map(Array.from({ length: Math.min(30, air.length) }, () => air[Math.floor(rng() * air.length)]!).map((c) => [c.index, c])).values()];
    if (sample.length < 2) continue;
    const scored = sample
      .map((c) => {
        const h = [COMBOS[c.index]!.c1, COMBOS[c.index]!.c2];
        return { h, e: bluffEv(h[0]!, h[1]!) };
      })
      .sort((x, y) => y.e.ev - x.e.ev);
    const top = scored[0]!;
    const bottom = scored[scored.length - 1]!;
    if (top.e.ev - bottom.e.ev < 0.01 * spot.pot) continue;
    const [first, second] = rng() < 0.5 ? [top, bottom] : [bottom, top];
    const h1 = first.h;
    const h2 = second.h;
    const e1 = first.e;
    const e2 = second.e;
    const better = e1.ev > e2.ev ? 1 : 2;
    const choice = (n: 1 | 2, h: number[], e: typeof e1): Candidate => ({
      label: `${h.map((c) => `{${indexToString(c)}}`).join('')}`,
      grade: n === better ? 'best' : 'mistake',
      note: `villain folds ${formatPercent(e.fold, 0)} · EV ${signedBb(e.ev)}`,
    });
    const a = analyzeSpot({ ...spot, hero: (better === 1 ? h1 : h2) as [number, number] }, { sizes: [1], seed: 7 });
    const tokens = (h: number[]) => h.map((c) => `{${indexToString(c)}}`).join(' ');
    return {
      id,
      kind: 'postflop.bluff',
      skill: `postflop.${variant}`,
      tags: [`postflop.street:river`, `postflop.pot:${spot.potType}`],
      difficulty,
      prompt: 'You want to bluff the pot on the river. Which hand is the better bluff?',
      context: { ...baseContext(spot, a), hero: undefined },
      choices: finalizeChoices([choice(1, h1, e1), choice(2, h2, e2)], rng),
      explanation: {
        summary: `${tokens(better === 1 ? h1 : h2)} is better: it removes more of the hands villain calls with (blockers), so villain folds more often.`,
        steps: [
          a.steps[0]!,
          `With ${tokens(h1)}: villain has ${e1.calls.toFixed(1)} calling combos, folds ${formatPercent(e1.fold, 0)} → EV ${signedBb(e1.ev)}`,
          `With ${tokens(h2)}: villain has ${e2.calls.toFixed(1)} calling combos, folds ${formatPercent(e2.fold, 0)} → EV ${signedBb(e2.ev)}`,
          `A pot-size bluff needs ${formatPercent(0.5, 0)} folds to break even (bet / (pot + bet)).`,
        ],
      },
      visual: rangeVisual(continuingRange(classifyRange(spot.villains[0]!.range, spot.board), 1, ctx.model), 'Villain’s calls vs a pot-size bet'),
    };
  }
  throw new Error('Could not build a blocker spot');
}

function readingQuestion(ctx: PostflopContext, rng: Rng, difficulty: Difficulty, street: Street | undefined, potType: PotType | undefined, id: string, variant: string): Question {
  const spot = spotFor(ctx, rng, 'reading', street ?? (rng() < 0.5 ? 'turn' : 'river'), potType);
  const villain = spot.villains[0]!;
  const comp = composition(classifyRange(villain.range, spot.board, spot.hero));
  const strong = comp.share.monster + comp.share.strong;
  const firstComp = composition(classifyRange(spot.rangeTrail[0]!.range, spot.board, spot.hero));
  const a = analyzeSpot(spot, { sizes: [0.5], seed: 3 });
  const visuals = spot.rangeTrail.map((t) => rangeVisual(t.range, `${villain.seat}: ${t.label}`));
  const count = (r: Range) => classifyRange(r, spot.board, spot.hero).reduce((s, c) => s + c.weight, 0);
  return {
    id,
    kind: 'postflop.reading',
    skill: `postflop.${variant}`,
    tags: [`postflop.street:${spot.street}`, `postflop.pot:${spot.potType}`],
    difficulty,
    prompt: `After this action, what share of ${villain.seat}'s range is top pair good kicker or better?`,
    context: baseContext(spot, a),
    choices: percentChoices(strong, [firstComp.share.monster + firstComp.share.strong, strong + 0.2, strong * 0.5, strong + 0.35], rng),
    explanation: {
      summary: `Each action removes hands: ${villain.seat}'s range went from ${formatPercent(firstComp.share.monster + firstComp.share.strong, 0)} strong-or-better (on this board) to ${formatPercent(strong, 0)} now.`,
      steps: [
        ...spot.rangeTrail.map((t) => `${t.label}: ${count(t.range).toFixed(1)} combos`),
        `Now: ${BUCKET_NAMES.monster.split(' (')[0]} ${formatPercent(comp.share.monster, 0)} + ${BUCKET_NAMES.strong.split(' (')[0]} ${formatPercent(comp.share.strong, 0)} = ${formatPercent(strong)}`,
        `Your ${a.hero.description.toLowerCase()} has ${formatPercent(a.heroEquity)} equity against the range now.`,
      ],
    },
    visuals,
  };
}

// ---------------------------------------------------------------------------

export function postflopVariants(theme: Theme, filters: PostflopFilters): string[] {
  const streets = (filters.streets?.length ? filters.streets : ['*']) as (Street | '*')[];
  const pots = (filters.potTypes?.length ? filters.potTypes : ['*']) as (PotType | '*')[];
  const out: string[] = [];
  for (const s of streets) for (const p of pots) {
    if (theme === 'cbet' && (p === 'limped' || s === 'river')) continue;
    if (theme === 'short' && (p === 'multiway' || p === 'limped')) continue;
    out.push(`${theme}|${s}|${p}`);
    if (theme === 'value' && (s === '*' || s === 'flop')) out.push(`${theme}|flop|${p}|streets`);
    if (theme === 'bluff' && (s === '*' || s === 'river')) out.push(`${theme}|river|${p}|blockers`);
    if (theme === 'facing' && (s === '*' || s === 'turn')) out.push(`${theme}|turn|${p}|tp-turn`);
  }
  return out.length ? out : [`${theme}|*|srp`];
}

export function makePostflopDrills(ctx: PostflopContext): DrillDef[] {
  return THEMES.map((theme) => {
    const variants = postflopVariants(theme, ctx.filters);
    return {
      kind: `postflop.${theme}`,
      title: THEME_NAMES[theme],
      blurb: '',
      glyph: '',
      variants: { bronze: variants, silver: variants, gold: variants },
      generate: (rng: Rng, d: Difficulty, v: string, id: string) => themeQuestion(ctx, rng, d, v, id),
    };
  });
}

