/**
 * A queue-based client for background analysis (coach, hand review). Unlike runEquity, jobs don't
 * cancel each other; they run in order on a dedicated worker.
 */
import type { AnalyzeOptions, ChartJson, ChartOverrides, LoggedHand, LoggedHandAnalysis, Spot, SpotAnalysis, VillainModel } from '../engine';
import { handleEngineJob, type EngineJob, type EngineReply } from './equityProtocol';

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, { resolve: (v: never) => void; reject: (e: Error) => void }>();

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL('./equity.worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (e: MessageEvent<EngineReply>) => {
    const p = pending.get(e.data.id);
    if (!p) return;
    pending.delete(e.data.id);
    if (e.data.ok) p.resolve(e.data.result as never);
    else p.reject(new Error(e.data.error));
  };
  worker.onerror = (e) => {
    for (const p of pending.values()) p.reject(new Error(e.message || 'Engine worker failed'));
    pending.clear();
    worker = null;
  };
  return worker;
}

function run<T>(job: EngineJob): Promise<T> {
  if (typeof Worker === 'undefined') {
    return Promise.resolve().then(() => {
      const r = handleEngineJob(job);
      if (!r.ok) throw new Error(r.error);
      return r.result as T;
    });
  }
  return new Promise<T>((resolve, reject) => {
    pending.set(job.id, { resolve: resolve as (v: never) => void, reject });
    getWorker().postMessage(job);
  });
}

export function analyzeLoggedInWorker(
  hand: LoggedHand,
  library: Record<string, ChartJson>,
  overrides: Record<string, ChartOverrides>,
  chartId: string,
  model: VillainModel,
): Promise<LoggedHandAnalysis> {
  return run<LoggedHandAnalysis>({ id: nextId++, kind: 'logged', hand, library, overrides, chartId, model });
}

export function analyzeInWorker(spot: Spot, options?: AnalyzeOptions): Promise<SpotAnalysis> {
  const job: EngineJob = { id: nextId++, kind: 'analyze', spot, options };
  if (typeof Worker === 'undefined') {
    return Promise.resolve().then(() => {
      const r = handleEngineJob(job);
      if (!r.ok) throw new Error(r.error);
      return r.result as SpotAnalysis;
    });
  }
  return new Promise((resolve, reject) => {
    pending.set(job.id, { resolve, reject });
    getWorker().postMessage(job);
  });
}
