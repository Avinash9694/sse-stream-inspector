export interface HarSseEntry {
  index: number;
  url: string;
  method: string;
  status: number;
  mimeType: string;
  startedDateTime: string;
  /** Decoded response body. */
  body: string;
  /** True when matched by content sniffing rather than mime type. */
  sniffed: boolean;
}

export class HarImportError extends Error {}

const SSE_LINE = /^(data|event|id|retry):/m;

/** Pulls every `text/event-stream` response (or body that looks like one) out of a HAR 1.2 file. */
export function extractSseEntries(harText: string): HarSseEntry[] {
  let har: unknown;
  try {
    har = JSON.parse(harText);
  } catch {
    throw new HarImportError('Not valid JSON.');
  }
  const entries = (har as { log?: { entries?: unknown } } | null)?.log?.entries;
  if (!Array.isArray(entries))
    throw new HarImportError('No `log.entries` array — is this a HAR 1.2 file?');

  const out: HarSseEntry[] = [];
  entries.forEach((entry: unknown, index) => {
    if (typeof entry !== 'object' || entry === null) return;
    const e = entry as {
      request?: { url?: string; method?: string };
      response?: {
        status?: number;
        content?: { mimeType?: string; text?: string; encoding?: string };
      };
      startedDateTime?: string;
    };
    const content = e.response?.content;
    if (!content || typeof content.text !== 'string' || content.text === '') return;
    const mimeType = content.mimeType ?? '';
    const body = content.encoding === 'base64' ? decodeBase64(content.text) : content.text;
    const isSse = /text\/event-stream/i.test(mimeType);
    if (!isSse && !SSE_LINE.test(body)) return;
    out.push({
      index,
      url: e.request?.url ?? '(unknown url)',
      method: e.request?.method ?? 'GET',
      status: e.response?.status ?? 0,
      mimeType,
      startedDateTime: e.startedDateTime ?? '',
      body,
      sniffed: !isSse,
    });
  });
  return out;
}

function decodeBase64(b64: string): string {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
