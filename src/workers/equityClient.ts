/**
 * Runs equity calculations off the main thread so the UI never freezes.
 * One worker is reused; starting a new job while one is running cancels the old one.
 */
import type { EquityResult } from '../engine';
import { handleEquityJob, type EquityJob, type EquityReply } from './equityProtocol';

let worker: Worker | null = null;
let nextId = 1;
let pending: { id: number; reject: (e: Error) => void } | null = null;

function getWorker(): Worker {
  worker ??= new Worker(new URL('./equity.worker.ts', import.meta.url), { type: 'module' });
  return worker;
}

export class EquityCancelled extends Error {
  constructor() {
    super('Equity calculation cancelled');
    this.name = 'EquityCancelled';
  }
}

/** Cancel the running job (terminates the worker; a fresh one starts on the next call). */
export function cancelEquity(): void {
  if (!pending) return;
  worker?.terminate();
  worker = null;
  pending.reject(new EquityCancelled());
  pending = null;
}

export function runEquity(players: string[], options: EquityJob['options'] = {}): Promise<EquityResult> {
  const job: EquityJob = { id: nextId++, players, options };
  const unwrap = (reply: EquityReply) => {
    if (reply.ok) return reply.result;
    throw new Error(reply.error);
  };
  // Environments without workers (tests, very old browsers) compute inline.
  if (typeof Worker === 'undefined') return Promise.resolve().then(() => unwrap(handleEquityJob(job)));

  cancelEquity();
  const w = getWorker();
  return new Promise<EquityResult>((resolve, reject) => {
    pending = { id: job.id, reject };
    w.onmessage = (e: MessageEvent<EquityReply>) => {
      if (e.data.id !== job.id) return;
      pending = null;
      try {
        resolve(unwrap(e.data));
      } catch (err) {
        reject(err as Error);
      }
    };
    w.onerror = (e) => {
      pending = null;
      reject(new Error(e.message || 'Equity worker failed'));
    };
    w.postMessage(job);
  });
}
