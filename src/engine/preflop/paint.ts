/** Scoring for "Paint the Range": compare painted hand classes to the chart by combos. */
import { HAND_GRID } from '../hands';
import { classComboIndices, type Range } from '../range';

export interface PaintScore {
  /** Combos you painted that are in the range (weighted by the range's frequency). */
  correct: number;
  /** Range combos you didn't paint. */
  missed: number;
  /** Combos you painted that aren't in the range. */
  extra: number;
  /** correct / (correct + missed + extra), 0..1. */
  accuracy: number;
  missedLabels: string[];
  extraLabels: string[];
}

export function scorePaint(painted: ReadonlySet<string>, range: Range): PaintScore {
  let correct = 0;
  let missed = 0;
  let extra = 0;
  const missedLabels: string[] = [];
  const extraLabels: string[] = [];
  for (const h of HAND_GRID.flat()) {
    const idx = classComboIndices(h.label);
    const inRange = idx.reduce((s, i) => s + range.weights[i]!, 0);
    const size = idx.length;
    if (painted.has(h.label)) {
      correct += inRange;
      extra += size - inRange;
      if (inRange < size / 2) extraLabels.push(h.label);
    } else {
      missed += inRange;
      if (inRange >= size / 2) missedLabels.push(h.label);
    }
  }
  const denom = correct + missed + extra;
  return { correct, missed, extra, accuracy: denom ? correct / denom : 1, missedLabels, extraLabels };
}
