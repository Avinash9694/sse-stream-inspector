import type { Frame } from './frame';

export const SESSION_VERSION = 1;

export type SourceKind = 'paste' | 'live' | 'har' | 'session' | 'share' | 'generated';

export interface SessionSource {
  kind: SourceKind;
  label: string;
  url?: string;
}

export interface Session {
  version: typeof SESSION_VERSION;
  app: 'sse-stream-inspector';
  exportedAt: string;
  source: SessionSource;
  frames: Frame[];
}

export function exportSession(frames: readonly Frame[], source: SessionSource): string {
  const session: Session = {
    version: SESSION_VERSION,
    app: 'sse-stream-inspector',
    exportedAt: new Date().toISOString(),
    source,
    frames: [...frames],
  };
  return JSON.stringify(session, null, 2);
}

export class SessionImportError extends Error {}

export function importSession(text: string): Session {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new SessionImportError('Not valid JSON.');
  }
  if (!isRecord(parsed)) throw new SessionImportError('Session file must be a JSON object.');
  if (parsed.app !== 'sse-stream-inspector')
    throw new SessionImportError('Not an SSE Stream Inspector session.');
  if (parsed.version !== SESSION_VERSION)
    throw new SessionImportError(`Unsupported session version ${String(parsed.version)}.`);
  if (!Array.isArray(parsed.frames)) throw new SessionImportError('Session has no frames array.');
  const frames: Frame[] = parsed.frames.map((f, i) => {
    if (!isRecord(f) || typeof f.data !== 'string' || typeof f.event !== 'string') {
      throw new SessionImportError(`Frame ${i} is malformed.`);
    }
    return {
      ...(f as unknown as Frame),
      index: i,
      receivedAt: typeof f.receivedAt === 'number' ? f.receivedAt : i,
      byteOffset: typeof f.byteOffset === 'number' ? f.byteOffset : 0,
      raw: typeof f.raw === 'string' ? f.raw : reconstructRaw(f as unknown as Frame),
      dispatched: typeof f.dispatched === 'boolean' ? f.dispatched : f.data !== '',
    };
  });
  const source =
    isRecord(parsed.source) && typeof parsed.source.label === 'string'
      ? (parsed.source as unknown as SessionSource)
      : { kind: 'session' as const, label: 'Imported session' };
  return {
    version: SESSION_VERSION,
    app: 'sse-stream-inspector',
    exportedAt:
      typeof parsed.exportedAt === 'string' ? parsed.exportedAt : new Date(0).toISOString(),
    source,
    frames,
  };
}

/** Rebuild `text/event-stream` text from frames (uses `raw` when present). */
export function exportRawStream(frames: readonly Frame[]): string {
  return frames.map((f) => f.raw || reconstructRaw(f)).join('\n\n') + '\n\n';
}

export function reconstructRaw(
  frame: Pick<Frame, 'event' | 'data' | 'id' | 'retry' | 'comments'>,
): string {
  const lines: string[] = [];
  for (const c of frame.comments ?? []) lines.push(`: ${c}`);
  if (frame.event && frame.event !== 'message') lines.push(`event: ${frame.event}`);
  if (frame.id !== undefined) lines.push(`id: ${frame.id}`);
  if (frame.retry !== undefined) lines.push(`retry: ${frame.retry}`);
  if (frame.data !== '') for (const d of frame.data.split('\n')) lines.push(`data: ${d}`);
  return lines.join('\n');
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
