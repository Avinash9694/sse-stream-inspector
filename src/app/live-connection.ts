import type { Frame } from '@/core/frame';
import { reconstructRaw } from '@/core/session';
import { SseParser } from '@/core/sse-parser';

export type LiveStatus = 'idle' | 'connecting' | 'open' | 'closed' | 'error';
export type LiveMode = 'fetch' | 'eventsource';

export interface LiveConfig {
  url: string;
  method: 'GET' | 'POST';
  /** One `Name: value` per line. */
  headers: string;
  body: string;
  mode: LiveMode;
  /** Comma-separated named events to subscribe to in EventSource mode. */
  eventNames: string;
}

export interface LiveHandlers {
  onFrames: (frames: Frame[]) => void;
  onStatus: (status: LiveStatus, detail?: string) => void;
  onBytes: (total: number) => void;
}

export interface LiveConnection {
  stop: () => void;
}

export const DEFAULT_LIVE_CONFIG: LiveConfig = {
  url: 'http://localhost:8787/stream/dual-spelling',
  method: 'GET',
  headers: 'Accept: text/event-stream',
  body: '',
  mode: 'fetch',
  eventNames: 'message, thinking_state, thinking-state, component_delta, done',
};

export function parseHeaderLines(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split('\n')) {
    const i = line.indexOf(':');
    if (i <= 0) continue;
    const name = line.slice(0, i).trim();
    const value = line.slice(i + 1).trim();
    if (name) out[name] = value;
  }
  return out;
}

export function startLiveConnection(config: LiveConfig, handlers: LiveHandlers): LiveConnection {
  return config.mode === 'eventsource'
    ? startEventSource(config, handlers)
    : startFetch(config, handlers);
}

function startFetch(config: LiveConfig, handlers: LiveHandlers): LiveConnection {
  const controller = new AbortController();
  const parser = new SseParser();
  let bytes = 0;
  handlers.onStatus('connecting');

  void (async () => {
    try {
      const init: RequestInit = {
        method: config.method,
        headers: parseHeaderLines(config.headers),
        signal: controller.signal,
      };
      if (config.method === 'POST' && config.body) init.body = config.body;
      const res = await fetch(config.url, init);
      if (!res.ok) {
        handlers.onStatus('error', `HTTP ${res.status} ${res.statusText}`.trim());
        return;
      }
      if (!res.body) {
        handlers.onStatus('error', 'Response had no body to stream.');
        return;
      }
      const type = res.headers.get('content-type') ?? '';
      handlers.onStatus(
        'open',
        /text\/event-stream/i.test(type)
          ? undefined
          : `Content-Type is "${type || 'unset'}", parsing anyway.`,
      );
      const reader = res.body.getReader();
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        handlers.onBytes(bytes);
        const frames = parser.push(value);
        if (frames.length) handlers.onFrames(frames);
      }
      const tail = parser.end();
      if (tail.length) handlers.onFrames(tail);
      handlers.onStatus('closed');
    } catch (err) {
      if (controller.signal.aborted) {
        const tail = parser.end();
        if (tail.length) handlers.onFrames(tail);
        handlers.onStatus('closed', 'Stopped.');
        return;
      }
      handlers.onStatus('error', describeFetchError(err));
    }
  })();

  return { stop: () => controller.abort() };
}

function describeFetchError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/failed to fetch|networkerror|load failed/i.test(msg)) {
    return `${msg} — usually CORS: the server must send Access-Control-Allow-Origin for this page's origin, or is unreachable.`;
  }
  return msg;
}

function startEventSource(config: LiveConfig, handlers: LiveHandlers): LiveConnection {
  if (typeof EventSource === 'undefined') {
    handlers.onStatus('error', 'EventSource is not available in this browser.');
    return { stop: () => undefined };
  }
  handlers.onStatus('connecting');
  const es = new EventSource(config.url);
  let index = 0;
  let bytes = 0;
  const names = new Set(
    config.eventNames
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );
  names.add('message');

  const handle = (e: MessageEvent<string>) => {
    const data = typeof e.data === 'string' ? e.data : String(e.data);
    const frame: Frame = {
      index: index++,
      event: e.type,
      data,
      receivedAt: Date.now(),
      byteOffset: bytes,
      raw: '',
      dispatched: true,
    };
    if (e.lastEventId) frame.id = e.lastEventId;
    if (e.lastEventId) frame.lastEventId = e.lastEventId;
    frame.raw = reconstructRaw(frame);
    bytes += frame.raw.length + 2;
    handlers.onBytes(bytes);
    handlers.onFrames([frame]);
  };
  for (const name of names) es.addEventListener(name, handle as EventListener);
  es.onopen = () =>
    handlers.onStatus(
      'open',
      'EventSource only surfaces events whose names are listed; ids and comments are not visible.',
    );
  es.onerror = () => {
    if (es.readyState === EventSource.CLOSED)
      handlers.onStatus(
        'error',
        'Connection failed or was refused (check CORS and that the server speaks text/event-stream).',
      );
    else handlers.onStatus('connecting', 'Connection dropped, browser is reconnecting…');
  };
  return {
    stop: () => {
      es.close();
      handlers.onStatus('closed', 'Stopped.');
    },
  };
}
