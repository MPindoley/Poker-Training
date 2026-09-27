/** XP awards, weighted by difficulty and accuracy. */
import { DIFFICULTY_INFO, type Difficulty } from '../drills/types';
import { GRADE_XP, type Grade } from '../grading';
import { MISTAKE_WEIGHT, type Confidence } from '../strategy/confidence';

/**
 * XP for one answer: the grade's base XP times the difficulty multiplier. A mistake in a close or
 * read-dependent spot is less severe (MISTAKE_WEIGHT), so it earns part of the way toward Acceptable XP.
 */
export function answerXp(grade: Grade, difficulty: Difficulty, confidence?: Confidence): number {
  let base = GRADE_XP[grade];
  if (grade === 'mistake' && confidence) base += (GRADE_XP.acceptable - GRADE_XP.mistake) * (1 - MISTAKE_WEIGHT[confidence]);
  return Math.round(base * DIFFICULTY_INFO[difficulty].xpMultiplier);
}

/** Bonus XP per question at 100% accuracy (scaled by difficulty). */
export const ROUND_BONUS_PER_QUESTION = 5;

export interface RoundBonus {
  xp: number;
  working: string;
}

/**
 * End-of-round accuracy bonus. Nothing at or below 50% right, growing linearly to
 * 5 XP × questions × multiplier at 100%.
 */
export function roundBonusXp(correct: number, total: number, difficulty: Difficulty): RoundBonus {
  const mult = DIFFICULTY_INFO[difficulty].xpMultiplier;
  if (total <= 0) return { xp: 0, working: 'No questions answered' };
  const acc = correct / total;
  const factor = Math.max(0, (acc - 0.5) / 0.5);
  const xp = Math.round(ROUND_BONUS_PER_QUESTION * total * mult * factor);
  return {
    xp,
    working: `${ROUND_BONUS_PER_QUESTION} × ${total} questions × ${mult} (${DIFFICULTY_INFO[difficulty].label}) × ${factor.toFixed(2)} (accuracy above 50%) = ${xp} XP`,
  };
}
