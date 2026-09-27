import { useMemo } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { buildCharts, type Chart, type ChartOverrides } from '../engine';
import { CHART_LIBRARY } from '../data/ranges';
import { idbStateStorage } from '../storage/db';

export interface SolverImportRecord {
  name: string;
  date: string;
  /** Override keys (path.action) this import set, so it can be removed cleanly. */
  keys: string[];
}

interface ChartState {
  chartId: string;
  overrides: Record<string, ChartOverrides>;
  /** Solver imports per chart, newest last. */
  solverImports: Record<string, SolverImportRecord[]>;
  applyImport: (chartId: string, overrides: ChartOverrides, name: string) => void;
  removeImport: (chartId: string, index: number) => void;
  setChart: (id: string) => void;
  setOverride: (chartId: string, key: string, notation: string) => void;
  clearOverride: (chartId: string, key: string) => void;
  resetChart: (chartId: string) => void;
}

export const useChartStore = create<ChartState>()(
  persist(
    (set, get) => ({
      chartId: 'home-40bb',
      overrides: {},
      solverImports: {},
      applyImport: (chartId, overrides, name) => {
        const o = get().overrides;
        const imports = get().solverImports ?? {};
        set({
          overrides: { ...o, [chartId]: { ...(o[chartId] ?? {}), ...overrides } },
          solverImports: { ...imports, [chartId]: [...(imports[chartId] ?? []), { name, date: new Date().toISOString(), keys: Object.keys(overrides) }] },
        });
      },
      removeImport: (chartId, index) => {
        const imports = [...((get().solverImports ?? {})[chartId] ?? [])];
        const [gone] = imports.splice(index, 1);
        if (!gone) return;
        // Keys still set by a later import stay.
        const stillUsed = new Set(imports.flatMap((i) => i.keys));
        const o = { ...(get().overrides[chartId] ?? {}) };
        for (const k of gone.keys) if (!stillUsed.has(k)) delete o[k];
        set({ overrides: { ...get().overrides, [chartId]: o }, solverImports: { ...get().solverImports, [chartId]: imports } });
      },
      setChart: (chartId) => set({ chartId }),
      setOverride: (chartId, key, notation) => {
        const o = get().overrides;
        set({ overrides: { ...o, [chartId]: { ...(o[chartId] ?? {}), [key]: notation } } });
      },
      clearOverride: (chartId, key) => {
        const o = { ...(get().overrides[chartId] ?? {}) };
        delete o[key];
        set({ overrides: { ...get().overrides, [chartId]: o } });
      },
      resetChart: (chartId) => {
        const o = { ...get().overrides };
        delete o[chartId];
        set({ overrides: o, solverImports: { ...(get().solverImports ?? {}), [chartId]: [] } });
      },
    }),
    { name: 'charts', storage: createJSONStorage(() => idbStateStorage) },
  ),
);

/** All charts with the user's edits applied. */
export function useCharts(): Record<string, Chart> {
  const overrides = useChartStore((s) => s.overrides);
  const imports = useChartStore((s) => s.solverImports);
  return useMemo(
    () => buildCharts(CHART_LIBRARY, overrides, Object.fromEntries(Object.entries(imports ?? {}).map(([id, list]) => [id, list.flatMap((i) => i.keys)]))),
    [overrides, imports],
  );
}

export function useActiveChart(): Chart {
  const charts = useCharts();
  const id = useChartStore((s) => s.chartId);
  return charts[id] ?? Object.values(charts)[0]!;
}
