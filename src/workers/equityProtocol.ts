/**
 * Message protocol for the equity Web Worker. Only plain, cloneable data crosses the boundary.
 */
import { calculateEquity, type EquityOptions, type EquityResult } from '../engine';

export interface EquityJob {
  id: number;
  /** Hands ("AsKd") or range notation ("QQ+, AKs", "random"), one per player. */
  players: string[];
  options?: Omit<EquityOptions, 'board' | 'dead'> & { board?: string; dead?: string };
}

export type EquityReply = { id: number; ok: true; result: EquityResult } | { id: number; ok: false; error: string };

/** Pure handler, shared by the worker and by tests. */
export function handleEquityJob(job: EquityJob): EquityReply {
  try {
    return { id: job.id, ok: true, result: calculateEquity(job.players, job.options) };
  } catch (e) {
    return { id: job.id, ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
