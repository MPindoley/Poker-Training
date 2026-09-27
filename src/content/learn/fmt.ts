import { formatPercent } from '../../engine';
export const pct = (x: number, d = 1) => formatPercent(x, d);
export const n = (x: number) => x.toLocaleString('en-US');
export const bb = (x: number) => `${Math.round(x * 10) / 10}bb`;
