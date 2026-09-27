/** Small combinatorics helpers shared by the rest of the engine. */

/** Binomial coefficient n choose k, exact for the small numbers poker needs. */
export function choose(n: number, k: number): number {
  if (!Number.isInteger(n) || !Number.isInteger(k)) throw new Error('choose() needs integers');
  if (k < 0 || k > n) return 0;
  const kk = Math.min(k, n - k);
  let result = 1;
  for (let i = 1; i <= kk; i++) {
    result = (result * (n - kk + i)) / i;
  }
  return Math.round(result);
}

/** Round to a fixed number of decimals (for display only — keep raw values for math). */
export function roundTo(value: number, decimals = 1): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

/** Format a 0..1 fraction as a percent string, e.g. 0.253 -> "25.3%". */
export function formatPercent(fraction: number, decimals = 1): string {
  return `${roundTo(fraction * 100, decimals).toFixed(decimals)}%`;
}
