import { describe, expect, it } from 'vitest';
import { parseSseText } from '../sse-parser';
import {
  exportRawStream,
  exportSession,
  importSession,
  reconstructRaw,
  SessionImportError,
} from '../session';

const TEXT = ': hello\nevent: ping\nid: 7\nretry: 100\ndata: {"a":1}\ndata: {"b":2}\n\n';

describe('session export/import', () => {
  it('round-trips frames', () => {
    const frames = parseSseText(TEXT);
    const json = exportSession(frames, { kind: 'paste', label: 'test' });
    const session = importSession(json);
    expect(session.frames).toEqual(frames);
    expect(session.source.label).toBe('test');
  });
  it('rejects foreign JSON with a clear error', () => {
    expect(() => importSession('{"hello":1}')).toThrow(SessionImportError);
    expect(() => importSession('nope')).toThrow('Not valid JSON.');
    expect(() => importSession('{"app":"sse-stream-inspector","version":99,"frames":[]}')).toThrow(
      /version/,
    );
  });
  it('re-indexes frames and fills defaults on import', () => {
    const session = importSession(
      JSON.stringify({
        app: 'sse-stream-inspector',
        version: 1,
        frames: [{ event: 'x', data: 'y', index: 40 }],
      }),
    );
    expect(session.frames[0]).toMatchObject({
      index: 0,
      dispatched: true,
      raw: 'event: x\ndata: y',
    });
  });
});

describe('raw export', () => {
  it('reproduces the original stream text from raw blocks', () => {
    const frames = parseSseText(TEXT);
    expect(exportRawStream(frames)).toBe(TEXT.trimEnd() + '\n\n');
  });
  it('reconstructs a block from fields when raw is missing', () => {
    expect(reconstructRaw({ event: 'e', data: 'l1\nl2', id: '3', retry: 5, comments: ['c'] })).toBe(
      ': c\nevent: e\nid: 3\nretry: 5\ndata: l1\ndata: l2',
    );
    expect(reconstructRaw({ event: 'message', data: 'x' })).toBe('data: x');
  });
});
