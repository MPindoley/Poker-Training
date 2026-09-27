/**
 * A queue-based client for background analysis (coach, hand review). Unlike runEquity, jobs don't
 * cancel each other; they run in order on a dedicated worker.
 */
import type { AnalyzeOptions, Spot, SpotAnalysis } from '../engine';
import { handleEngineJob, type EngineJob, type EngineReply } from './equityProtocol';

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, { resolve: (v: SpotAnalysis) => void; reject: (e: Error) => void }>();

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL('./equity.worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (e: MessageEvent<EngineReply>) => {
    const p = pending.get(e.data.id);
    if (!p) return;
    pending.delete(e.data.id);
    if (e.data.ok) p.resolve(e.data.result as SpotAnalysis);
    else p.reject(new Error(e.data.error));
  };
  worker.onerror = (e) => {
    for (const p of pending.values()) p.reject(new Error(e.message || 'Engine worker failed'));
    pending.clear();
    worker = null;
  };
  return worker;
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
