/**
 * Preflop hand ranking: every hand class ordered by its equity against one random hand,
 * computed by the engine (seeded Monte Carlo, memoised). Used to turn VPIP/PFR stats into ranges.
 */
import { calculateEquity } from '../equity';
import { HAND_GRID } from '../hands';
import { classComboIndices, emptyRange, type Range } from '../range';

let cache: { label: string; equity: number }[] | null = null;

export function preflopRanking(iterations = 3000): { label: string; equity: number }[] {
  if (cache) return cache;
  cache = HAND_GRID.flat()
    .map((h, i) => ({ label: h.label, equity: calculateEquity([h.label, 'random'], { iterations, seed: 1000 + i, forceMonteCarlo: true }).players[0]!.equity }))
    .sort((a, b) => b.equity - a.equity);
  return cache;
}

/** The top `fraction` of all hands (by combos) from the ranking, optionally skipping the top `skip` fraction. */
export function topRange(fraction: number, skip = 0): Range {
  const r = emptyRange();
  let acc = 0;
  for (const { label } of preflopRanking()) {
    const idx = classComboIndices(label);
    const share = idx.length / 1326;
    const start = acc;
    acc += share;
    if (acc <= skip + 1e-9) continue;
    if (start >= skip + fraction - 1e-9) break;
    // Partial overlap at either edge gets a partial weight.
    const lo = Math.max(start, skip);
    const hi = Math.min(acc, skip + fraction);
    const w = Math.max(0, Math.min(1, (hi - lo) / share));
    for (const i of idx) r.weights[i] = w;
  }
  return r;
}
