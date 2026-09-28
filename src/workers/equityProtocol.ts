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
  runLab,
  nextCardGrid,
  type LabScenario,
  type LabResult,
  type NextCardGrid,
  type ShoveResult,
  type AnalyzeOptions,
  type ChartJson,
  type ChartOverrides,
  type EquityOptions,
  type EquityResult,
  type AnalyzeLoggedOptions,
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
  /** Per-player models / stats / names (tagged profiles). */
  options?: AnalyzeLoggedOptions;
}

export interface PushJob {
  id: number;
  kind: 'push';
  stack: number;
  callFraction: number;
}

export interface LabJob {
  id: number;
  kind: 'lab' | 'labGrid';
  scenario: LabScenario;
}

export type EngineJob = EquityJob | AnalyzeJob | LoggedJob | PushJob | LabJob;

export type EquityReply = { id: number; ok: true; result: EquityResult } | { id: number; ok: false; error: string };
export type EngineReply = { id: number; ok: true; result: EquityResult | SpotAnalysis | LoggedHandAnalysis | Record<string, ShoveResult> | LabResult | NextCardGrid } | { id: number; ok: false; error: string };

/** Pure handler, shared by the worker and by tests. */
export function handleEquityJob(job: EquityJob): EquityReply {
  try {
    return { id: job.id, ok: true, result: calculateEquity(job.players, job.options) };
  } catch (e) {
    return { id: job.id, ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export function handleEngineJob(job: EngineJob): EngineReply {
  if ('scenario' in job) {
    try {
      return { id: job.id, ok: true, result: job.kind === 'lab' ? runLab(job.scenario) : nextCardGrid(job.scenario) };
    } catch (e) {
      return { id: job.id, ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }
  if (job.kind === 'push') {
    try {
      return { id: job.id, ok: true, result: pushChart(job.stack, job.callFraction) };
    } catch (e) {
      return { id: job.id, ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }
  if (job.kind === 'logged') {
    try {
      const chart = buildCharts(job.library, job.overrides)[job.chartId]!;
      return { id: job.id, ok: true, result: analyzeLoggedHand(job.hand, chart, job.model, job.options) };
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
  return handleEquityJob(job as EquityJob);
}
