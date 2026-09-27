import { useMemo } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { buildCharts, type Chart, type ChartOverrides } from '../engine';
import { CHART_LIBRARY } from '../data/ranges';
import { idbStateStorage } from '../storage/db';

interface ChartState {
  chartId: string;
  overrides: Record<string, ChartOverrides>;
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
        set({ overrides: o });
      },
    }),
    { name: 'charts', storage: createJSONStorage(() => idbStateStorage) },
  ),
);

/** All charts with the user's edits applied. */
export function useCharts(): Record<string, Chart> {
  const overrides = useChartStore((s) => s.overrides);
  return useMemo(() => buildCharts(CHART_LIBRARY, overrides), [overrides]);
}

export function useActiveChart(): Chart {
  const charts = useCharts();
  const id = useChartStore((s) => s.chartId);
  return charts[id] ?? Object.values(charts)[0]!;
}
