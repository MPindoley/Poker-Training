/** Registry of the Math Trainer drills. */
import type { Rng } from '../../rng';
import type { Difficulty, Question } from '../types';
import { BLUFF_VARIANTS, generateBluffQuestion } from './bluffDrill';
import { CALL_FOLD_VARIANTS, generateCallFoldQuestion } from './callFoldDrill';
import { COMBO_VARIANTS, generateCombosQuestion } from './combosDrill';
import { EV_VARIANTS, generateEvQuestion } from './evDrill';
import { MDF_VARIANTS, generateMdfQuestion } from './mdfDrill';
import { OUTS_VARIANTS, generateOutsQuestion } from './outsDrill';
import { POT_ODDS_VARIANTS, generatePotOddsQuestion } from './potOddsDrill';
import { RULE24_VARIANTS, generateRule24Question } from './rule24Drill';

export interface DrillDef {
  kind: string;
  title: string;
  blurb: string;
  glyph: string;
  /** Variants available at each non-diamond difficulty. */
  variants: Record<Exclude<Difficulty, 'diamond'>, readonly string[]>;
  generate: (rng: Rng, difficulty: Difficulty, variant: string, id: string) => Question;
}

type Gen<V extends string> = (rng: Rng, difficulty: Difficulty, variant: V, id: string) => Question;
const def = <V extends string>(d: Omit<DrillDef, 'generate' | 'variants'> & { variants: Record<Exclude<Difficulty, 'diamond'>, readonly V[]>; generate: Gen<V> }): DrillDef =>
  d as unknown as DrillDef;

export const MATH_DRILLS: DrillDef[] = [
  def({
    kind: 'math.outs',
    title: 'Count the Outs',
    blurb: 'Tap how many cards win it for you',
    glyph: '#',
    variants: { bronze: ['flush', 'straight'], silver: ['flush', 'straight', 'overcards', 'combo', 'turn'], gold: ['combo', 'turn', 'dirty'] },
    generate: generateOutsQuestion,
  }),
  def({
    kind: 'math.rule24',
    title: 'Rule of 2 & 4',
    blurb: 'Outs to percent, shortcut vs exact',
    glyph: '×4',
    variants: { bronze: ['flop-turn', 'flop-river', 'turn-river'], silver: [...RULE24_VARIANTS], gold: ['flop-river', 'turn-river'] },
    generate: generateRule24Question,
  }),
  def({
    kind: 'math.potodds',
    title: 'Pot Odds',
    blurb: 'Equity needed to call',
    glyph: '%',
    variants: { bronze: ['basic'], silver: ['sized'], gold: ['multiway', 'raised', 'sized'] },
    generate: generatePotOddsQuestion,
  }),
  def({
    kind: 'math.callfold',
    title: 'Call or Fold',
    blurb: 'Your equity vs the price',
    glyph: '?',
    variants: { bronze: ['direct'], silver: ['direct', 'implied', 'allin-flop'], gold: ['implied', 'vs-range', 'allin-flop'] },
    generate: generateCallFoldQuestion,
  }),
  def({
    kind: 'math.combos',
    title: 'Combo Counting',
    blurb: 'Blockers change everything',
    glyph: 'AK',
    variants: { bronze: ['single'], silver: ['single', 'pair', 'suited'], gold: ['suited', 'multi', 'pair'] },
    generate: generateCombosQuestion,
  }),
  def({
    kind: 'math.bluff',
    title: 'Bluff Math',
    blurb: 'Does the bluff print?',
    glyph: '!',
    variants: { bronze: ['pure'], silver: ['pure'], gold: ['pure', 'semi'] },
    generate: generateBluffQuestion,
  }),
  def({
    kind: 'math.mdf',
    title: 'Minimum Defense',
    blurb: "Don't get run over",
    glyph: 'MD',
    variants: { bronze: ['percent'], silver: ['percent'], gold: ['percent', 'combos'] },
    generate: generateMdfQuestion,
  }),
  def({
    kind: 'math.ev',
    title: 'EV Calculator',
    blurb: 'Fold, call or raise?',
    glyph: 'EV',
    variants: { bronze: ['turn'], silver: ['turn'], gold: ['turn'] },
    generate: generateEvQuestion,
  }),
];

export const MATH_DRILL_BY_KIND = new Map(MATH_DRILLS.map((d) => [d.kind, d]));

// Re-exported so every variant list is reachable from one place (and tests can iterate them).
export const ALL_MATH_VARIANTS = {
  'math.outs': OUTS_VARIANTS,
  'math.rule24': RULE24_VARIANTS,
  'math.potodds': POT_ODDS_VARIANTS,
  'math.callfold': CALL_FOLD_VARIANTS,
  'math.combos': COMBO_VARIANTS,
  'math.bluff': BLUFF_VARIANTS,
  'math.mdf': MDF_VARIANTS,
  'math.ev': EV_VARIANTS,
} as const;
