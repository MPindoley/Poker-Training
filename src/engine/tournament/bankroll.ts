/**
 * Bankroll math (normal approximation for cash games). Win rate and standard deviation are per
 * 100 hands in big blinds, as trackers report them.
 */

/** Risk of ruin: exp(−2 · winrate · bankroll / sd²). */
export function riskOfRuin(winrateBb100: number, sdBb100: number, bankrollBb: number): number {
  if (winrateBb100 <= 0) return 1;
  return Math.exp((-2 * winrateBb100 * bankrollBb) / (sdBb100 * sdBb100));
}

/** Bankroll needed for a target risk of ruin. */
export function bankrollFor(winrateBb100: number, sdBb100: number, risk: number): number {
  if (winrateBb100 <= 0) return Infinity;
  return (-Math.log(risk) * sdBb100 * sdBb100) / (2 * winrateBb100);
}

/** Inverse standard normal CDF (Acklam's approximation). */
export function normalQuantile(p: number): number {
  if (p <= 0 || p >= 1) throw new Error('p must be in (0, 1)');
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const q = Math.min(p, 1 - p);
  let x: number;
  if (q < 0.02425) {
    const r = Math.sqrt(-2 * Math.log(q));
    x = (((((c[0]! * r + c[1]!) * r + c[2]!) * r + c[3]!) * r + c[4]!) * r + c[5]!) / ((((d[0]! * r + d[1]!) * r + d[2]!) * r + d[3]!) * r + 1);
  } else {
    const r = q - 0.5;
    const s = r * r;
    x = ((((((a[0]! * s + a[1]!) * s + a[2]!) * s + a[3]!) * s + a[4]!) * s + a[5]!) * r) / (((((b[0]! * s + b[1]!) * s + b[2]!) * s + b[3]!) * s + b[4]!) * s + 1);
    return p < 0.5 ? x : -x;
  }
  return p < 0.5 ? x : -x;
}

export interface ResultRange {
  expected: number;
  low: number;
  high: number;
  /** Probability of being behind after this many hands. */
  losingChance: number;
}

/** Expected result and a central interval after `hands` hands. */
export function resultRange(winrateBb100: number, sdBb100: number, hands: number, confidence = 0.95): ResultRange {
  const k = hands / 100;
  const mean = winrateBb100 * k;
  const sd = sdBb100 * Math.sqrt(k);
  const z = normalQuantile(0.5 + confidence / 2);
  const cdf = (x: number) => 0.5 * (1 + erf(x / Math.SQRT2));
  return { expected: mean, low: mean - z * sd, high: mean + z * sd, losingChance: sd > 0 ? cdf(-mean / sd) : mean < 0 ? 1 : 0 };
}

function erf(x: number): number {
  // Abramowitz–Stegun 7.1.26
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return x >= 0 ? y : -y;
}
