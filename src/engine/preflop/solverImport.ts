/**
 * Import solver output (JSON or CSV) as preflop chart overrides. Imported strategies replace the
 * built-in ranges for the spots they cover, so drills, the coach and the Play table all use them.
 *
 * JSON:
 *   { "chart": "cash-6max-100bb", "spots": [
 *       { "spot": "rfi.CO", "strategy": { "AKs": { "raise": 1 }, "A5s": { "raise": 0.5 }, "AhKh": { "raise": 1 } } },
 *       { "spot": "vsOpen.BB.BTN", "ranges": { "3bet": "QQ+,AKs", "call": "22-JJ,A2s+" } } ] }
 * CSV (header required; frequency 0..1 or 0..100):
 *   spot,hand,action,frequency
 *   rfi.CO,AKs,raise,1
 *   vsOpen.BB.BTN,A5s,3bet,40%
 *
 * Spots: rfi.SEAT, vsOpen.HERO.OPENER, vs3bet.SEAT. Actions: raise (rfi), 3bet/call (vsOpen),
 * 4bet/call (vs3bet). "fold" rows are ignored (fold is whatever is left).
 */
import { parseCardIndices } from '../cards';
import { HAND_GRID } from '../hands';
import { classComboIndices, comboIndex, emptyRange, parseRange, rangeToString, type Range } from '../range';
import type { Chart, ChartOverrides, PreflopAction } from './charts';

export interface SolverImportResult {
  chartId: string | null;
  overrides: ChartOverrides;
  spots: string[];
  rows: number;
  warnings: string[];
  errors: string[];
}

const ACTIONS: Record<string, readonly PreflopAction[]> = { rfi: ['raise'], vsOpen: ['3bet', 'call'], vs3bet: ['4bet', 'call'] };
const ACTION_ALIASES: Record<string, string> = { open: 'raise', r: 'raise', bet: 'raise', '3b': '3bet', threebet: '3bet', '4b': '4bet', fourbet: '4bet', c: 'call', f: 'fold' };
const CLASS_LABELS = new Set(HAND_GRID.flat().map((h) => h.label));

/** Resolve a spot name against a chart to its canonical override path (applies seat aliases). */
export function resolveSpotPath(chart: Chart, spot: string): { path: string; kind: string } | null {
  const [kind, a, b] = spot.trim().split('.');
  if (kind === 'rfi' && a) return chart.rfi(a) ? { path: `rfi.${a}`, kind } : null;
  if (kind === 'vsOpen' && a && b) {
    const s = chart.vsOpen(a, b);
    return s ? { path: s.path, kind } : null;
  }
  if (kind === 'vs3bet' && a) {
    const s = chart.vs3bet(a);
    return s ? { path: s.path, kind } : null;
  }
  return null;
}

/** Frequency from "0.5", "50", "50%". Values over 1 are read as percentages. */
export function parseFrequency(text: string | number): number | null {
  const raw = typeof text === 'number' ? text : Number(String(text).trim().replace(/%$/, ''));
  if (!Number.isFinite(raw) || raw < 0) return null;
  const pctForm = typeof text === 'string' && text.trim().endsWith('%');
  const f = pctForm || raw > 1 ? raw / 100 : raw;
  return f <= 1 + 1e-9 ? Math.min(1, f) : null;
}

/** Combo indices for a hand class ("AKs") or a specific combo ("AhKh"). */
export function handIndices(hand: string): readonly number[] | null {
  const h = hand.trim();
  const cls = /^[2-9tjqka]{2}[so]?$/i.test(h) ? h.slice(0, 2).toUpperCase() + h.slice(2).toLowerCase() : h;
  if (CLASS_LABELS.has(cls)) return classComboIndices(cls);
  if (/^([2-9TJQKA][shdc]){2}$/i.test(h)) {
    try {
      const [a, b] = parseCardIndices(h);
      if (a === undefined || b === undefined || a === b) return null;
      return [comboIndex(a, b)];
    } catch {
      return null;
    }
  }
  return null;
}

interface Row {
  spot: string;
  hand: string;
  action: string;
  frequency: string | number;
  line: string;
}

function splitCsvLine(line: string): string[] {
  return line.split(/[,;\t]/).map((c) => c.trim().replace(/^"|"$/g, ''));
}

/** Parse the text of a JSON or CSV solver export. */
export function importSolverOutput(text: string, charts: Record<string, Chart>, fallbackChartId?: string): SolverImportResult {
  const result: SolverImportResult = { chartId: null, overrides: {}, spots: [], rows: 0, warnings: [], errors: [] };
  const trimmed = text.trim();
  if (!trimmed) {
    result.errors.push('The file is empty.');
    return result;
  }
  const rows: Row[] = [];
  const direct: { spot: string; action: string; notation: string }[] = [];
  let chartId = fallbackChartId;

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    let json: unknown;
    try {
      json = JSON.parse(trimmed);
    } catch (e) {
      result.errors.push(`Not valid JSON: ${(e as Error).message}`);
      return result;
    }
    const obj = (Array.isArray(json) ? { spots: json } : json) as { chart?: string; spots?: unknown };
    if (typeof obj.chart === 'string') chartId = obj.chart;
    if (!Array.isArray(obj.spots)) {
      result.errors.push('JSON needs a "spots" array.');
      return result;
    }
    obj.spots.forEach((raw, i) => {
      const s = raw as { spot?: string; strategy?: Record<string, Record<string, number | string>>; ranges?: Record<string, string> };
      if (typeof s.spot !== 'string') {
        result.errors.push(`Spot #${i + 1} has no "spot" name.`);
        return;
      }
      for (const [hand, actions] of Object.entries(s.strategy ?? {}))
        for (const [action, frequency] of Object.entries(actions ?? {})) rows.push({ spot: s.spot, hand, action, frequency, line: `spot #${i + 1} ${hand}` });
      for (const [action, notation] of Object.entries(s.ranges ?? {})) direct.push({ spot: s.spot, action, notation });
      if (!s.strategy && !s.ranges) result.warnings.push(`Spot ${s.spot} has no "strategy" or "ranges"; skipped.`);
    });
  } else {
    const lines = trimmed.split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith('#'));
    const header = splitCsvLine(lines[0]!).map((h) => h.toLowerCase());
    const col = (name: string) => header.indexOf(name);
    const [si, hi, ai, fi, ci] = [col('spot'), col('hand'), col('action'), col('frequency') >= 0 ? col('frequency') : col('freq'), col('chart')];
    if (si < 0 || hi < 0 || ai < 0 || fi < 0) {
      result.errors.push('CSV header must include spot, hand, action and frequency columns.');
      return result;
    }
    lines.slice(1).forEach((line, i) => {
      const c = splitCsvLine(line);
      if (ci >= 0 && c[ci]) chartId = c[ci];
      rows.push({ spot: c[si] ?? '', hand: c[hi] ?? '', action: c[ai] ?? '', frequency: c[fi] ?? '', line: `line ${i + 2}` });
    });
  }

  const chart = chartId ? charts[chartId] : undefined;
  if (!chart) {
    result.errors.push(chartId ? `Unknown chart "${chartId}". Known: ${Object.keys(charts).join(', ')}.` : 'Say which chart this is for ("chart" field or column).');
    return result;
  }
  result.chartId = chart.id;

  // path -> action -> range
  const built = new Map<string, Map<string, Range>>();
  const totals = new Map<string, Float64Array>();
  const touch = (path: string, action: string) => {
    if (!built.has(path)) built.set(path, new Map());
    const m = built.get(path)!;
    if (!m.has(action)) m.set(action, emptyRange());
    if (!totals.has(path)) totals.set(path, new Float64Array(1326));
    return m.get(action)!;
  };
  const normAction = (a: string) => ACTION_ALIASES[a.trim().toLowerCase()] ?? a.trim().toLowerCase();

  for (const row of rows) {
    const spot = resolveSpotPath(chart, row.spot);
    if (!spot) {
      result.errors.push(`${row.line}: unknown spot "${row.spot}" for ${chart.name}.`);
      continue;
    }
    const action = normAction(row.action);
    if (action === 'fold') continue;
    if (!ACTIONS[spot.kind]!.includes(action as PreflopAction)) {
      result.errors.push(`${row.line}: action "${row.action}" doesn't exist in ${spot.kind} spots (use ${ACTIONS[spot.kind]!.join('/')}).`);
      continue;
    }
    const idx = handIndices(row.hand);
    if (!idx) {
      result.errors.push(`${row.line}: can't read hand "${row.hand}" (use AKs, QQ, T9o or a combo like AhKh).`);
      continue;
    }
    const f = parseFrequency(row.frequency);
    if (f === null) {
      result.errors.push(`${row.line}: frequency "${row.frequency}" must be 0–1 or 0–100%.`);
      continue;
    }
    const range = touch(spot.path, action);
    for (const i of idx) range.weights[i] = f;
    result.rows++;
  }

  for (const d of direct) {
    const spot = resolveSpotPath(chart, d.spot);
    const action = normAction(d.action);
    if (!spot || !ACTIONS[spot.kind]!.includes(action as PreflopAction)) {
      result.errors.push(`Unknown spot/action "${d.spot} ${d.action}".`);
      continue;
    }
    try {
      const r = parseRange(d.notation);
      const range = touch(spot.path, action);
      for (let i = 0; i < 1326; i++) range.weights[i] = r.weights[i]!;
      result.rows++;
    } catch (e) {
      result.errors.push(`${d.spot} ${d.action}: ${(e as Error).message}`);
    }
  }

  for (const [path, actions] of built) {
    const total = totals.get(path)!;
    for (const r of actions.values()) for (let i = 0; i < 1326; i++) total[i]! += r.weights[i]!;
    let over = 0;
    for (let i = 0; i < 1326; i++) if (total[i]! > 1 + 1e-6) over++;
    if (over) {
      // Scale each combo's actions down so they sum to 100%.
      for (const r of actions.values()) for (let i = 0; i < 1326; i++) if (total[i]! > 1 + 1e-6) r.weights[i] = r.weights[i]! / total[i]!;
      result.warnings.push(`${path}: ${over} combos had action frequencies above 100%; scaled them down to sum to 100%.`);
    }
    // Actions the import didn't mention become empty, so the solver's strategy fully replaces the spot.
    const kind = path.split('.')[0]!;
    for (const a of ACTIONS[kind]!) {
      const r = actions.get(a);
      result.overrides[`${path}.${a}`] = r ? rangeToString(r) : '';
      if (!r) result.warnings.push(`${path}: no "${a}" rows, so ${a} is set to never.`);
    }
    result.spots.push(path);
  }
  if (!result.spots.length && !result.errors.length) result.errors.push('Nothing to import.');
  return result;
}
