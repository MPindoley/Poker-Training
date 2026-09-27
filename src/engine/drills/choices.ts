/** Helpers for building multiple-choice answer sets. */
import { formatPercent } from '../math';
import type { Grade } from '../grading';
import type { Rng } from '../rng';
import { shuffle } from '../rng';
import type { Choice } from './types';

export interface Candidate {
  label: string;
  grade: Grade;
  note?: string;
}

/**
 * Deduplicate by label (the first occurrence wins, so list the correct answer first),
 * cap the count and shuffle.
 */
export function finalizeChoices(candidates: Candidate[], rng: Rng, max = 4): Choice[] {
  const seen = new Set<string>();
  const unique: Candidate[] = [];
  for (const c of candidates) {
    if (seen.has(c.label)) continue;
    seen.add(c.label);
    unique.push(c);
    if (unique.length === max) break;
  }
  return shuffle(unique, rng).map((c, i) => ({ id: `c${i}`, ...c }));
}

/** Percent choices: correct fraction first, then distractor fractions. */
export function percentChoices(correct: number, distractors: number[], rng: Rng, acceptable: number[] = []): Choice[] {
  const cands: Candidate[] = [{ label: formatPercent(correct), grade: 'best' }];
  for (const a of acceptable) cands.push({ label: formatPercent(a), grade: 'acceptable' });
  for (const d of distractors) {
    if (d > 0 && d < 1) cands.push({ label: formatPercent(d), grade: 'mistake' });
  }
  // Pad with nudged values if distractors collided.
  let k = 1;
  while (new Set(cands.map((c) => c.label)).size < 4 && k < 20) {
    const delta = (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.05;
    const v = correct + delta;
    if (v > 0 && v < 1) cands.push({ label: formatPercent(v), grade: 'mistake' });
    k++;
  }
  return finalizeChoices(cands, rng);
}

/** Integer choices around a correct value. */
export function numberChoices(correct: number, rng: Rng, spread: number[] = [-2, -1, 1, 2, 3, -3], min = 0): Choice[] {
  const cands: Candidate[] = [{ label: String(correct), grade: 'best' }];
  for (const d of shuffle(spread, rng)) {
    const v = correct + d;
    if (v >= min) cands.push({ label: String(v), grade: 'mistake' });
  }
  return finalizeChoices(cands, rng);
}

/** Money with up to 2 decimals, "$12" or "$12.50". */
export function money(x: number): string {
  const r = Math.round(x * 100) / 100;
  const s = Number.isInteger(r) ? r.toString() : r.toFixed(2);
  return r < 0 ? `−$${s.slice(1)}` : `$${s}`;
}

export function signedMoney(x: number): string {
  if (Math.abs(x) < 0.005) return '$0';
  return x > 0 ? `+${money(x)}` : money(x);
}
