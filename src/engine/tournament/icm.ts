/**
 * Independent Chip Model (Malmuth–Harville): the chance of finishing in each place is
 * proportional to chips, recursively. Exact over subsets (fine for up to ~12 players).
 */
export function icmEquity(stacks: number[], payouts: number[]): number[] {
  const n = stacks.length;
  if (n > 14) throw new Error('ICM supports up to 14 players');
  if (stacks.some((s) => s < 0)) throw new Error('Stacks must be non-negative');
  const places = Math.min(payouts.length, n);
  const eq = new Array(n).fill(0);
  // prob[mask] = probability that exactly the players in `mask` have already finished in the top places.
  const prob = new Map<number, number>([[0, 1]]);
  let frontier = [0];
  for (let place = 0; place < places; place++) {
    const next = new Map<number, number>();
    for (const mask of frontier) {
      const p = prob.get(mask)!;
      let remaining = 0;
      for (let i = 0; i < n; i++) if (!(mask & (1 << i))) remaining += stacks[i]!;
      if (remaining <= 0) continue;
      for (let i = 0; i < n; i++) {
        if (mask & (1 << i) || stacks[i] === 0) continue;
        const pi = (p * stacks[i]!) / remaining;
        eq[i] += pi * payouts[place]!;
        const m2 = mask | (1 << i);
        next.set(m2, (next.get(m2) ?? 0) + pi);
      }
    }
    for (const [m, v] of next) prob.set(m, v);
    frontier = [...next.keys()];
  }
  return eq;
}
