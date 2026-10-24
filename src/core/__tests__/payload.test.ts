import { describe, expect, it } from 'vitest';
import {
  diffShapes,
  parsePayload,
  payloadOf,
  shapeOf,
  shapePaths,
  shapeSignature,
} from '../payload';

describe('parsePayload', () => {
  it('parses JSON objects', () => {
    expect(parsePayload('{"a":1}')).toEqual({ kind: 'json', json: { a: 1 } });
  });
  it('treats plain text as text', () => {
    expect(parsePayload('hello world').kind).toBe('text');
  });
  it('flags JSON-looking data that fails to parse as broken', () => {
    const p = parsePayload('{"a":');
    expect(p.kind).toBe('text');
    expect(p.brokenJson).toBe(true);
    expect(p.error).toBeTruthy();
  });
  it('reports empty data', () => {
    expect(parsePayload('').kind).toBe('empty');
  });
  it('parses bare literals', () => {
    expect(parsePayload('[DONE]')).toEqual({ kind: 'text' });
    expect(parsePayload('true')).toEqual({ kind: 'json', json: true });
    expect(parsePayload('42')).toEqual({ kind: 'json', json: 42 });
  });
  it('memoises per frame object', () => {
    const frame = { data: '{"x":1}' };
    expect(payloadOf(frame)).toBe(payloadOf(frame));
  });
});

describe('shapePaths', () => {
  it('produces sorted leaf paths with primitive types', () => {
    expect(shapePaths({ b: 1, a: 'x', c: { d: true, e: null } })).toEqual([
      '$.a: string',
      '$.b: number',
      '$.c.d: boolean',
      '$.c.e: null',
    ]);
  });
  it('is independent of key order and array length', () => {
    const a = shapeSignature({ items: [{ id: 1 }, { id: 2 }], ok: true });
    const b = shapeSignature({ ok: false, items: [{ id: 9 }] });
    expect(a).toBe(b);
  });
  it('unions mixed array element types', () => {
    expect(shapePaths({ v: [1, 'a', null] })).toEqual(['$.v[]: null|number|string']);
  });
  it('marks empty arrays and objects', () => {
    expect(shapePaths({ a: [], b: {} })).toEqual(['$.a[]: empty', '$.b: {}']);
  });
  it('quotes keys that are not identifiers', () => {
    expect(shapePaths({ 'content-type': 'x' })).toEqual(['$."content-type": string']);
  });
  it('describes a root primitive', () => {
    expect(shapePaths('s')).toEqual(['$: string']);
  });
  it('shapeOf returns null for non-JSON frames', () => {
    expect(shapeOf({ data: 'plain' })).toBeNull();
    expect(shapeOf({ data: '{"a":1}' })).toEqual(['$.a: number']);
  });
});

describe('diffShapes', () => {
  it('reports added, removed and changed paths', () => {
    const from = shapePaths({ a: 1, b: 'x', c: true });
    const to = shapePaths({ a: '1', b: 'y', d: null });
    expect(diffShapes(from, to)).toEqual({
      added: ['$.d'],
      removed: ['$.c'],
      changed: [{ path: '$.a', from: 'number', to: 'string' }],
    });
  });
  it('is empty for identical shapes', () => {
    const s = shapePaths({ a: [1] });
    expect(diffShapes(s, s)).toEqual({ added: [], removed: [], changed: [] });
  });
});
