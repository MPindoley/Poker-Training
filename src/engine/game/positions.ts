/** Position names for a table, counted from the button. */
export const POSITION_ORDER: Record<number, string[]> = {
  2: ['BTN', 'BB'],
  3: ['BTN', 'SB', 'BB'],
  4: ['BTN', 'SB', 'BB', 'CO'],
  5: ['BTN', 'SB', 'BB', 'HJ', 'CO'],
  6: ['BTN', 'SB', 'BB', 'UTG', 'HJ', 'CO'],
  7: ['BTN', 'SB', 'BB', 'UTG', 'LJ', 'HJ', 'CO'],
  8: ['BTN', 'SB', 'BB', 'UTG', 'MP', 'LJ', 'HJ', 'CO'],
  9: ['BTN', 'SB', 'BB', 'UTG', 'UTG+1', 'MP', 'LJ', 'HJ', 'CO'],
};

/**
 * Map seat index -> position name for the players dealt in.
 * `active` lists seat indices dealt in, `button` is the dealer seat index.
 */
export function positionsFor(active: number[], button: number, totalSeats: number): Record<number, string> {
  const n = active.length;
  const names = POSITION_ORDER[Math.min(9, Math.max(2, n))]!;
  const ordered: number[] = [];
  for (let k = 0; k < totalSeats; k++) {
    const i = (button + k) % totalSeats;
    if (active.includes(i)) ordered.push(i);
  }
  // Heads-up: button is also the small blind.
  const out: Record<number, string> = {};
  ordered.forEach((seat, k) => (out[seat] = n === 2 ? (k === 0 ? 'BTN' : 'BB') : names[k]!));
  return out;
}
