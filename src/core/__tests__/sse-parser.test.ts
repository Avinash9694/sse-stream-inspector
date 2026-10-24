import { describe, expect, it } from 'vitest';
import { SseParser, parseSseText, utf8Length } from '../sse-parser';

const tick = () => {
  let t = 0;
  return () => (t += 10);
};

describe('SseParser — spec cases', () => {
  it('dispatches a simple data frame as `message`', () => {
    const [frame] = parseSseText('data: hello\n\n');
    expect(frame).toMatchObject({ index: 0, event: 'message', data: 'hello', dispatched: true });
  });

  it('honours `event:` and `id:`', () => {
    const [frame] = parseSseText('event: ping\nid: 42\ndata: {}\n\n');
    expect(frame).toMatchObject({ event: 'ping', id: '42', lastEventId: '42', data: '{}' });
  });

  it('joins multi-line data with LF and drops the trailing newline', () => {
    const [frame] = parseSseText('data: line one\ndata: line two\ndata:\n\n');
    expect(frame?.data).toBe('line one\nline two\n');
  });

  it('strips exactly one leading space from a value', () => {
    const [a, b] = parseSseText('data:  two spaces\n\ndata:none\n\n');
    expect(a?.data).toBe(' two spaces');
    expect(b?.data).toBe('none');
  });

  it('treats a line without a colon as a field with empty value', () => {
    const [frame] = parseSseText('data\n\n');
    expect(frame?.data).toBe('');
    expect(frame?.dispatched).toBe(true);
  });

  it('records comments and does not dispatch comment-only blocks', () => {
    const frames = parseSseText(': keep-alive\n\n: t=50\ndata: x\n\n');
    expect(frames).toHaveLength(2);
    expect(frames[0]).toMatchObject({ dispatched: false, comments: ['keep-alive'], event: '' });
    expect(frames[1]).toMatchObject({ dispatched: true, comments: ['t=50'] });
  });

  it('does not dispatch a block with fields but no data, yet still emits it', () => {
    const [frame] = parseSseText('event: progress\nid: 9\n\n');
    expect(frame).toMatchObject({ dispatched: false, event: 'progress', id: '9', data: '' });
  });

  it('parses numeric retry and records invalid ones', () => {
    const [a, b] = parseSseText('retry: 2500\ndata: a\n\nretry: soon\ndata: b\n\n');
    expect(a?.retry).toBe(2500);
    expect(b?.retry).toBeUndefined();
    expect(b?.invalidRetry).toEqual(['soon']);
  });

  it('ignores an id containing NUL and keeps the previous lastEventId', () => {
    const frames = parseSseText('id: 1\ndata: a\n\nid: bad\u0000id\ndata: b\n\n');
    expect(frames[1]?.id).toBeUndefined();
    expect(frames[1]?.lastEventId).toBe('1');
  });

  it('collects unknown fields instead of throwing', () => {
    const [frame] = parseSseText('foo: bar\nbaz: qux\ndata: ok\n\n');
    expect(frame?.unknownFields).toEqual(['foo', 'baz']);
  });

  it('handles CRLF, CR and LF line endings alike', () => {
    const lf = parseSseText('event: a\ndata: 1\n\ndata: 2\n\n');
    const crlf = parseSseText('event: a\r\ndata: 1\r\n\r\ndata: 2\r\n\r\n');
    const cr = parseSseText('event: a\rdata: 1\r\rdata: 2\r\r');
    for (const frames of [lf, crlf, cr]) {
      expect(frames.map((f) => [f.event, f.data])).toEqual([
        ['a', '1'],
        ['message', '2'],
      ]);
    }
  });

  it('strips a leading BOM', () => {
    const [frame] = parseSseText('﻿data: bom\n\n');
    expect(frame?.data).toBe('bom');
    expect(frame?.byteOffset).toBe(3);
  });

  it('keeps `raw` as the block text without the blank line', () => {
    const [frame] = parseSseText(': c\nevent: e\ndata: d\n\n');
    expect(frame?.raw).toBe(': c\nevent: e\ndata: d');
  });

  it('tracks UTF-8 byte offsets across frames', () => {
    const frames = parseSseText('data: héllo\n\ndata: x\n\n');
    expect(frames[0]?.byteOffset).toBe(0);
    // "data: héllo\n" is 13 bytes (é = 2), plus the blank line = 14.
    expect(frames[1]?.byteOffset).toBe(14);
  });

  it('counts UTF-8 bytes including astral characters', () => {
    expect(utf8Length('a')).toBe(1);
    expect(utf8Length('é')).toBe(2);
    expect(utf8Length('€')).toBe(3);
    expect(utf8Length('😀')).toBe(4);
  });
});

describe('SseParser — streaming', () => {
  it('reassembles a line split across chunks', () => {
    const p = new SseParser({ now: tick() });
    expect(p.push('data: hel')).toEqual([]);
    expect(p.push('lo wor')).toEqual([]);
    const frames = p.push('ld\n\n');
    expect(frames[0]?.data).toBe('hello world');
  });

  it('reassembles a field name split across chunks', () => {
    const p = new SseParser();
    p.push('ev');
    p.push('ent: split\nda');
    const frames = p.push('ta: 1\n\n');
    expect(frames[0]).toMatchObject({ event: 'split', data: '1' });
  });

  it('waits for the LF of a CRLF split across chunks', () => {
    const p = new SseParser();
    expect(p.push('data: a\r')).toEqual([]);
    expect(p.push('\n\r')).toEqual([]);
    const frames = p.push('\n');
    expect(frames).toHaveLength(1);
    expect(frames[0]?.data).toBe('a');
  });

  it('decodes multibyte UTF-8 split across byte chunks', () => {
    const bytes = new TextEncoder().encode('data: é€😀\n\n');
    const p = new SseParser();
    const frames = [
      ...p.push(bytes.slice(0, 8)),
      ...p.push(bytes.slice(8, 12)),
      ...p.push(bytes.slice(12)),
    ];
    expect(frames[0]?.data).toBe('é€😀');
  });

  it('flushes an incomplete trailing block on end() and flags it', () => {
    const p = new SseParser();
    expect(p.push('event: done\ndata: {"ok":true')).toEqual([]);
    const frames = p.end();
    expect(frames[0]).toMatchObject({
      event: 'done',
      data: '{"ok":true',
      incomplete: true,
      dispatched: true,
    });
  });

  it('end() on an empty parser returns nothing', () => {
    expect(new SseParser().end()).toEqual([]);
  });

  it('numbers frames continuously across pushes and honours startIndex', () => {
    const p = new SseParser({ startIndex: 5 });
    const a = p.push('data: 1\n\n');
    const b = p.push('data: 2\n\ndata: 3\n\n');
    expect([...a, ...b].map((f) => f.index)).toEqual([5, 6, 7]);
    expect(p.nextIndex).toBe(8);
  });

  it('stamps receivedAt from the injected clock', () => {
    const frames = parseSseText('data: a\n\ndata: b\n\n', { now: tick() });
    expect(frames.map((f) => f.receivedAt)).toEqual([10, 20]);
  });

  it('parses 10k frames quickly', () => {
    const text = Array.from({ length: 10_000 }, (_, i) => `id: ${i}\ndata: {"i":${i}}\n\n`).join(
      '',
    );
    const start = performance.now();
    const frames = parseSseText(text);
    expect(frames).toHaveLength(10_000);
    expect(performance.now() - start).toBeLessThan(2000);
  });
});
