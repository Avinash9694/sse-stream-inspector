import { describe, expect, it } from 'vitest';
import { extractSseEntries, HarImportError } from '../har';

const har = (entries: unknown[]) => JSON.stringify({ log: { version: '1.2', entries } });
const entry = (over: Record<string, unknown>) => ({
  startedDateTime: '2026-10-24T10:00:00Z',
  request: { method: 'POST', url: 'https://api.example.com/chat' },
  response: { status: 200, content: { mimeType: 'text/event-stream', text: 'data: a\n\n' } },
  ...over,
});

describe('extractSseEntries', () => {
  it('returns event-stream responses with decoded bodies', () => {
    const out = extractSseEntries(har([entry({})]));
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      url: 'https://api.example.com/chat',
      method: 'POST',
      status: 200,
      body: 'data: a\n\n',
      sniffed: false,
    });
  });
  it('decodes base64 bodies', () => {
    const text = 'event: x\ndata: {"é":1}\n\n';
    const b64 = btoa(String.fromCharCode(...new TextEncoder().encode(text)));
    const out = extractSseEntries(
      har([
        entry({
          response: {
            status: 200,
            content: {
              mimeType: 'text/event-stream; charset=utf-8',
              text: b64,
              encoding: 'base64',
            },
          },
        }),
      ]),
    );
    expect(out[0]?.body).toBe(text);
  });
  it('sniffs SSE-looking bodies served under another mime type', () => {
    const out = extractSseEntries(
      har([
        entry({
          response: {
            status: 200,
            content: { mimeType: 'application/octet-stream', text: 'data: hi\n\n' },
          },
        }),
        entry({
          response: { status: 200, content: { mimeType: 'application/json', text: '{"a":1}' } },
        }),
      ]),
    );
    expect(out).toHaveLength(1);
    expect(out[0]?.sniffed).toBe(true);
  });
  it('skips entries without a body', () => {
    expect(
      extractSseEntries(
        har([entry({ response: { status: 200, content: { mimeType: 'text/event-stream' } } })]),
      ),
    ).toEqual([]);
  });
  it('throws for non-HAR input', () => {
    expect(() => extractSseEntries('garbage')).toThrow(HarImportError);
    expect(() => extractSseEntries('{"log":{}}')).toThrow(/log.entries/);
  });
});
