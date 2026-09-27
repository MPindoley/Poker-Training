import type { ChartJson } from '../../engine';
import six from './cash-6max-100bb.json';
import nine from './cash-9max-100bb.json';
import home from './home-40bb.json';

/** Built-in preflop charts, keyed by id. Edit the JSON files or override in the Range Editor. */
export const CHART_LIBRARY: Record<string, ChartJson> = Object.fromEntries(
  [nine, six, home].map((j) => [j.id, j as unknown as ChartJson]),
);

export const CHART_IDS = Object.keys(CHART_LIBRARY);
