/**
 * Builds the questions of a drill round. Variants are picked with spaced-repetition weights so
 * skills you miss come back more often; Diamond mixes drill types, favouring your weakest.
 */
import { createRng } from '../rng';
import type { DrillDef } from './math';
import { skillWeight, weightedPick, type SkillRecord } from './srs';
import type { Difficulty, Question } from './types';

export const ROUND_LENGTH = 10;

export interface RoundSpec {
  drills: readonly DrillDef[];
  difficulty: Difficulty;
  /** Skill records keyed by Question.skill. */
  skills: Readonly<Record<string, SkillRecord>>;
  seed: number;
}

function kindWeight(drill: DrillDef, skills: RoundSpec['skills']): number {
  const recs = Object.entries(skills).filter(([k]) => k.startsWith(drill.kind + ':')).map(([, r]) => r);
  if (!recs.length) return 3;
  return recs.reduce((s, r) => s + skillWeight(r), 0) / recs.length;
}

/** Deterministic for a given spec and index, so a round can be replayed. */
export function buildQuestion(spec: RoundSpec, index: number): Question {
  const rng = createRng(spec.seed + index * 7919);
  const drill = spec.drills.length === 1 ? spec.drills[0]! : weightedPick(spec.drills, (d) => kindWeight(d, spec.skills), rng);
  const level: Exclude<Difficulty, 'diamond'> = spec.difficulty === 'diamond' ? (rng() < 0.5 ? 'silver' : 'gold') : spec.difficulty;
  const variants = drill.variants[level];
  const variant = weightedPick(variants, (v) => skillWeight(spec.skills[`${drill.kind}:${v}`]), rng);
  const q = drill.generate(rng, level, variant, `${drill.kind}-${spec.seed}-${index}`);
  return spec.difficulty === 'diamond' ? { ...q, difficulty: 'diamond' } : q;
}
