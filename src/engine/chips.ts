/** Break an amount into chip denominations for display (greedy, largest first). Fractions are dropped. */

export interface ChipCount {
  denom: number;
  count: number;
}

export const DEFAULT_DENOMS = [1000, 500, 100, 25, 5, 1] as const;

export function breakdownChips(amount: number, denoms: readonly number[] = DEFAULT_DENOMS): ChipCount[] {
  if (amount < 0) throw new Error('amount must be >= 0');
  const sorted = [...denoms].sort((a, b) => b - a);
  const result: ChipCount[] = [];
  let remaining = Math.floor(amount + 1e-9);
  for (const denom of sorted) {
    const count = Math.floor(remaining / denom);
    if (count > 0) {
      result.push({ denom, count });
      remaining -= count * denom;
    }
  }
  return result;
}
