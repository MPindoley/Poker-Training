/**
 * Message protocol for the engine Web Worker. Only plain, cloneable data crosses the boundary
 * (ranges are typed arrays, which structured-clone fine).
 */
import {
  analyzeLoggedHand,
  analyzeSpot,
  buildCharts,
  calculateEquity,
  pushChart,
  type ShoveResult,
  type AnalyzeOptions,
  type ChartJson,
  type ChartOverrides,
  type EquityOptions,
  type EquityResult,
  type LoggedHand,
  type LoggedHandAnalysis,
  type Spot,
  type SpotAnalysis,
  type VillainModel,
} from '../engine';

export interface EquityJob {
  id: number;
  kind?: 'equity';
  /** Hands ("AsKd") or range notation ("QQ+, AKs", "random"), one per player. */
  players: string[];
  options?: Omit<EquityOptions, 'board' | 'dead'> & { board?: string; dead?: string };
}

export interface AnalyzeJob {
  id: number;
  kind: 'analyze';
  spot: Spot;
  options?: AnalyzeOptions;
}

export interface LoggedJob {
  id: number;
  kind: 'logged';
  hand: LoggedHand;
  library: Record<string, ChartJson>;
  overrides: Record<string, ChartOverrides>;
  chartId: string;
  model: VillainModel;
}

export interface PushJob {
  id: number;
  kind: 'push';
  stack: number;
  callPercent: number;
}

export type EngineJob = EquityJob | AnalyzeJob | LoggedJob | PushJob;

export type EquityReply = { id: number; ok: true; result: EquityResult } | { id: number; ok: false; error: string };
export type EngineReply = { id: number; ok: true; result: EquityResult | SpotAnalysis | LoggedHandAnalysis | Record<string, ShoveResult> } | { id: number; ok: false; error: string };

/** Pure handler, shared by the worker and by tests. */
export function handleEquityJob(job: EquityJob): EquityReply {
  try {
    return { id: job.id, ok: true, result: calculateEquity(job.players, job.options) };
  } catch (e) {
    return { id: job.id, ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export function handleEngineJob(job: EngineJob): EngineReply {
  if (job.kind === 'push') {
    try {
      return { id: job.id, ok: true, result: pushChart(job.stack, job.callPercent) };
    } catch (e) {
      return { id: job.id, ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }
  if (job.kind === 'logged') {
    try {
      const chart = buildCharts(job.library, job.overrides)[job.chartId]!;
      return { id: job.id, ok: true, result: analyzeLoggedHand(job.hand, chart, job.model) };
    } catch (e) {
      return { id: job.id, ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }
  if (job.kind === 'analyze') {
    try {
      return { id: job.id, ok: true, result: analyzeSpot(job.spot, job.options) };
    } catch (e) {
      return { id: job.id, ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }
  return handleEquityJob(job);
}
