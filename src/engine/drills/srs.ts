/**
 * Lightweight spaced repetition (Leitner boxes). Missed skills drop to box 0 and come back often;
 * skills answered correctly climb toward box 4 and show up less.
 */
import type { Rng } from '../rng';

export const MAX_BOX = 4;

export interface SkillRecord {
  box: number;
  attempts: number;
  correct: number;
  totalMs: number;
  /** Timestamp of the last attempt (ms). */
  last: number;
}

export function emptySkill(): SkillRecord {
  return { box: 0, attempts: 0, correct: 0, totalMs: 0, last: 0 };
}

/** Update a record after an answer. Acceptable answers keep the box; mistakes reset it. */
export function recordAnswer(rec: SkillRecord, outcome: 'best' | 'acceptable' | 'mistake', ms: number, now = Date.now()): SkillRecord {
  const box = outcome === 'best' ? Math.min(MAX_BOX, rec.box + 1) : outcome === 'acceptable' ? rec.box : 0;
  return {
    box,
    attempts: rec.attempts + 1,
    correct: rec.correct + (outcome === 'mistake' ? 0 : 1),
    totalMs: rec.totalMs + ms,
    last: now,
  };
}

/** Weight for picking a skill: unseen = 3, box 0 (missed) = 6 … box 4 = 1. */
export function skillWeight(rec: SkillRecord | undefined): number {
  if (!rec || rec.attempts === 0) return 3;
  return Math.max(1, 6 - (rec.box * 5) / MAX_BOX);
}

/** Weighted random pick. */
export function weightedPick<T>(items: readonly T[], weight: (item: T) => number, rng: Rng): T {
  if (!items.length) throw new Error('Nothing to pick from');
  const weights = items.map(weight);
  const total = weights.reduce((a, b) => a + b, 0);
  let x = rng() * total;
  for (let i = 0; i < items.length; i++) {
    x -= weights[i]!;
    if (x < 0) return items[i]!;
  }
  return items[items.length - 1]!;
}

export function accuracy(rec: SkillRecord | undefined): number | null {
  return rec && rec.attempts ? rec.correct / rec.attempts : null;
}

export function averageMs(rec: SkillRecord | undefined): number | null {
  return rec && rec.attempts ? rec.totalMs / rec.attempts : null;
}
