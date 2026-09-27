/**
 * Message protocol for the engine Web Worker. Only plain, cloneable data crosses the boundary
 * (ranges are typed arrays, which structured-clone fine).
 */
import { analyzeSpot, calculateEquity, type AnalyzeOptions, type EquityOptions, type EquityResult, type Spot, type SpotAnalysis } from '../engine';

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

export type EngineJob = EquityJob | AnalyzeJob;

export type EquityReply = { id: number; ok: true; result: EquityResult } | { id: number; ok: false; error: string };
export type EngineReply = { id: number; ok: true; result: EquityResult | SpotAnalysis } | { id: number; ok: false; error: string };

/** Pure handler, shared by the worker and by tests. */
export function handleEquityJob(job: EquityJob): EquityReply {
  try {
    return { id: job.id, ok: true, result: calculateEquity(job.players, job.options) };
  } catch (e) {
    return { id: job.id, ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export function handleEngineJob(job: EngineJob): EngineReply {
  if (job.kind === 'analyze') {
    try {
      return { id: job.id, ok: true, result: analyzeSpot(job.spot, job.options) };
    } catch (e) {
      return { id: job.id, ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }
  return handleEquityJob(job);
}
