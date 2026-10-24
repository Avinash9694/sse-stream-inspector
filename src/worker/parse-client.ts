import type { Frame } from '@/core/frame';
import { parseSseText } from '@/core/sse-parser';
import { applyPastedTiming, DEFAULT_SYNTHETIC_GAP_MS } from '@/core/timing';
import type { ParseRequest, ParseResponse } from './parse-worker';

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<
  number,
  { resolve: (r: ParseResponse) => void; reject: (e: Error) => void }
>();

function getWorker(): Worker | null {
  if (typeof Worker === 'undefined') return null;
  if (worker) return worker;
  try {
    worker = new Worker(new URL('./parse-worker.ts', import.meta.url), { type: 'module' });
  } catch {
    return null;
  }
  worker.onmessage = (e: MessageEvent<ParseResponse>) => {
    const p = pending.get(e.data.id);
    if (!p) return;
    pending.delete(e.data.id);
    p.resolve(e.data);
  };
  worker.onerror = () => {
    for (const p of pending.values()) p.reject(new Error('Parser worker crashed'));
    pending.clear();
    worker?.terminate();
    worker = null;
  };
  return worker;
}

/** Parses pasted text off the main thread when a Worker is available, inline otherwise. */
export async function parseTextAsync(
  text: string,
  gapMs = DEFAULT_SYNTHETIC_GAP_MS,
): Promise<{ frames: Frame[]; ms: number; offThread: boolean }> {
  const w = getWorker();
  if (!w) {
    const started = performance.now();
    const frames = applyPastedTiming(parseSseText(text), gapMs);
    return { frames, ms: performance.now() - started, offThread: false };
  }
  const id = nextId++;
  const result = await new Promise<ParseResponse>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    const req: ParseRequest = { id, text, gapMs };
    w.postMessage(req);
  });
  return { frames: result.frames, ms: result.ms, offThread: true };
}
