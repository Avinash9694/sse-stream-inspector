import { parseSseText } from '@/core/sse-parser';
import { applyPastedTiming } from '@/core/timing';

export interface ParseRequest {
  id: number;
  text: string;
  gapMs: number;
}

export interface ParseResponse {
  id: number;
  frames: ReturnType<typeof parseSseText>;
  ms: number;
}

self.onmessage = (e: MessageEvent<ParseRequest>) => {
  const started = performance.now();
  const frames = applyPastedTiming(parseSseText(e.data.text), e.data.gapMs);
  const response: ParseResponse = { id: e.data.id, frames, ms: performance.now() - started };
  self.postMessage(response);
};
