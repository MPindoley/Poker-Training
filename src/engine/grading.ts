/**
 * Judgment-call grading. Strategy answers are graded Best / Acceptable / Mistake
 * rather than pretending there is a single right answer.
 */

export type Grade = 'best' | 'acceptable' | 'mistake';

export const GRADE_LABEL: Record<Grade, string> = {
  best: 'Best',
  acceptable: 'Acceptable',
  mistake: 'Mistake',
};

export const GRADE_XP: Record<Grade, number> = {
  best: 20,
  acceptable: 10,
  mistake: 2,
};

/**
 * Grade an EV loss (in big blinds) against thresholds. Smaller losses are better.
 * Defaults: within 0.1bb of the top option is Best, within 0.5bb is Acceptable.
 */
export function gradeByEvLoss(evLossBb: number, bestWithin = 0.1, acceptableWithin = 0.5): Grade {
  if (evLossBb <= bestWithin) return 'best';
  if (evLossBb <= acceptableWithin) return 'acceptable';
  return 'mistake';
}
