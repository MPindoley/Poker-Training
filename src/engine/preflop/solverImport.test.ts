import { describe, expect, it } from 'vitest';
import six from '../../data/ranges/cash-6max-100bb.json';
import nine from '../../data/ranges/cash-9max-100bb.json';
import { countCombos } from '../range';
import { buildCharts, strategyFor, type ChartJson } from './charts';
import { handIndices, importSolverOutput, parseFrequency, resolveSpotPath } from './solverImport';

const library = Object.fromEntries([six, nine].map((j) => [j.id, j as unknown as ChartJson]));
const charts = buildCharts(library);
const c6 = charts['cash-6max-100bb']!;

describe('solver import helpers', () => {
  it('reads frequencies as fractions or percentages', () => {
    expect(parseFrequency('0.5')).toBe(0.5);
    expect(parseFrequency('50')).toBe(0.5);
    expect(parseFrequency('50%')).toBe(0.5);
    expect(parseFrequency('1')).toBe(1);
    expect(parseFrequency(0.25)).toBe(0.25);
    expect(parseFrequency('-1')).toBeNull();
    expect(parseFrequency('abc')).toBeNull();
    expect(parseFrequency('150')).toBeNull();
  });
  it('reads hand classes and specific combos', () => {
    expect(handIndices('AKs')).toHaveLength(4);
    expect(handIndices('ako')).toHaveLength(12);
    expect(handIndices('QQ')).toHaveLength(6);
    expect(handIndices('AhKh')).toHaveLength(1);
    expect(handIndices('AhAh')).toBeNull();
    expect(handIndices('XYZ')).toBeNull();
  });
  it('resolves spots through seat aliases', () => {
    expect(resolveSpotPath(c6, 'rfi.CO')!.path).toBe('rfi.CO');
    expect(resolveSpotPath(c6, 'rfi.BB')).toBeNull();
    expect(resolveSpotPath(c6, 'vsOpen.BB.BTN')).not.toBeNull();
    expect(resolveSpotPath(c6, 'vsOpen.UTG.BTN')).toBeNull(); // impossible order
    const c9 = charts['cash-9max-100bb']!;
    const p = resolveSpotPath(c9, 'vsOpen.BB.MP');
    expect(p?.path).toBe(c9.vsOpen('BB', 'MP')!.path);
  });
});

describe('importSolverOutput', () => {
  it('imports CSV and the override replaces the built-in range', () => {
    const csv = ['spot,hand,action,frequency', 'rfi.CO,AA,raise,1', 'rfi.CO,AKs,raise,100%', 'rfi.CO,A5s,raise,0.5', 'rfi.CO,72o,fold,1'].join('\n');
    const r = importSolverOutput(csv, charts, 'cash-6max-100bb');
    expect(r.errors).toEqual([]);
    expect(r.spots).toEqual(['rfi.CO']);
    const chart = buildCharts(library, { [r.chartId!]: r.overrides })[r.chartId!]!;
    const spot = chart.rfi('CO')!;
    expect(countCombos(spot.ranges.raise!)).toBeCloseTo(6 + 4 + 2, 6); // AA 6 + AKs 4 + half of A5s' 4
    expect(strategyFor(spot, 'A5s').freq.raise).toBeCloseTo(0.5);
    expect(strategyFor(spot, 'KK').freq.raise ?? 0).toBe(0); // not in the solver output → fold
  });

  it('imports JSON with strategies, ranges and specific combos', () => {
    const json = JSON.stringify({
      chart: 'cash-6max-100bb',
      spots: [
        { spot: 'vsOpen.BB.BTN', strategy: { AA: { '3bet': 1 }, AhKh: { '3bet': 1 }, KQo: { call: 1 } } },
        { spot: 'vs3bet.CO', ranges: { '4bet': 'KK+', call: 'QQ-TT,AKs' } },
      ],
    });
    const r = importSolverOutput(json, charts);
    expect(r.errors).toEqual([]);
    const chart = buildCharts(library, { [r.chartId!]: r.overrides })[r.chartId!]!;
    const d = chart.vsOpen('BB', 'BTN')!;
    expect(countCombos(d.ranges['3bet']!)).toBe(7);
    expect(countCombos(d.ranges.call!)).toBe(12);
    const v = chart.vs3bet('CO')!;
    expect(countCombos(v.ranges['4bet']!)).toBe(12);
    expect(countCombos(v.ranges.call!)).toBe(18 + 4);
  });

  it('scales frequencies that add up to more than 100%', () => {
    const csv = 'spot,hand,action,frequency\nvsOpen.BB.BTN,AA,3bet,0.8\nvsOpen.BB.BTN,AA,call,0.8';
    const r = importSolverOutput(csv, charts, 'cash-6max-100bb');
    expect(r.warnings.some((w) => w.includes('scaled'))).toBe(true);
    const chart = buildCharts(library, { [r.chartId!]: r.overrides })[r.chartId!]!;
    const s = strategyFor(chart.vsOpen('BB', 'BTN')!, 'AA');
    expect(s.freq['3bet']).toBeCloseTo(0.5);
    expect(s.freq.call).toBeCloseTo(0.5);
  });

  it('reports bad input clearly', () => {
    expect(importSolverOutput('', charts).errors[0]).toMatch(/empty/);
    expect(importSolverOutput('{oops', charts).errors[0]).toMatch(/JSON/);
    expect(importSolverOutput('a,b\n1,2', charts, 'cash-6max-100bb').errors[0]).toMatch(/header/);
    expect(importSolverOutput('spot,hand,action,frequency\nrfi.CO,AA,raise,1', charts).errors[0]).toMatch(/which chart/);
    const bad = importSolverOutput('spot,hand,action,frequency\nrfi.XX,AA,raise,1\nrfi.CO,ZZ,raise,1\nrfi.CO,AA,call,1\nrfi.CO,AA,raise,2x', charts, 'cash-6max-100bb');
    expect(bad.errors).toHaveLength(4);
    expect(bad.spots).toEqual([]);
  });
});
