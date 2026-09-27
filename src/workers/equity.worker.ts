/// <reference lib="webworker" />
import { handleEngineJob, type EngineJob } from './equityProtocol';

const ctx = self as unknown as { onmessage: ((e: MessageEvent<EngineJob>) => void) | null; postMessage: (msg: unknown) => void };

ctx.onmessage = (e) => ctx.postMessage(handleEngineJob(e.data));
