/// <reference lib="webworker" />
import { handleEquityJob, type EquityJob } from './equityProtocol';

const ctx = self as unknown as { onmessage: ((e: MessageEvent<EquityJob>) => void) | null; postMessage: (msg: unknown) => void };

ctx.onmessage = (e) => ctx.postMessage(handleEquityJob(e.data));
