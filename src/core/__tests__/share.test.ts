import { describe, expect, it } from 'vitest';
import { decodeShare, encodeShare, SHARE_MAX_CHARS } from '../share';

describe('share links', () => {
  it('round-trips text and name through the hash', () => {
    const r = encodeShare({ text: 'event: a\ndata: {"x":1}\n\n', name: 'tiny' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.hash.startsWith('#s=')).toBe(true);
    expect(decodeShare(r.hash)).toEqual({
      v: 1,
      text: 'event: a\ndata: {"x":1}\n\n',
      name: 'tiny',
    });
  });
  it('refuses payloads that would exceed the URL budget', () => {
    const big = Array.from(
      { length: 4000 },
      (_, i) => `data: {"i":${i},"r":"${Math.random()}"}\n\n`,
    ).join('');
    const r = encodeShare({ text: big });
    expect(r.ok).toBe(false);
    expect(r.length).toBeGreaterThan(SHARE_MAX_CHARS);
  });
  it('returns null for missing, foreign or corrupt hashes', () => {
    expect(decodeShare('')).toBeNull();
    expect(decodeShare('#other=1')).toBeNull();
    expect(decodeShare('#s=notlzstring')).toBeNull();
  });
});
