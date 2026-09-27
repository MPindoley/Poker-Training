/** Seat geometry around an oval table. Seat 0 (hero) sits at the bottom centre. */
export interface Point {
  x: number;
  y: number;
}

export function seatPoint(i: number, n: number, w: number, h: number, inset = 0): Point {
  const a = Math.PI / 2 + (i * 2 * Math.PI) / n;
  const rx = w / 2 - 34 - inset;
  const ry = h / 2 - 44 - inset;
  return { x: w / 2 + rx * Math.cos(a), y: h / 2 + ry * Math.sin(a) };
}

export function betPoint(i: number, n: number, w: number, h: number): Point {
  const a = Math.PI / 2 + (i * 2 * Math.PI) / n;
  return { x: w / 2 + (w / 2 - 92) * Math.cos(a), y: h / 2 + (h / 2 - 108) * Math.sin(a) };
}

export const bbText = (x: number) => `${Math.round(x * 10) / 10}`;
export const dollars = (bbAmount: number, bb: number) => `$${(bbAmount * bb).toFixed(bb < 1 ? 2 : 0)}`;
