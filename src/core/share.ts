import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';

export const SHARE_HASH_KEY = 's';
export const SHARE_MAX_CHARS = 30_000;

export interface SharePayload {
  v: 1;
  /** Raw `text/event-stream` text. */
  text: string;
  name?: string;
}

export type ShareResult =
  { ok: true; hash: string; length: number } | { ok: false; length: number };

export function encodeShare(payload: Omit<SharePayload, 'v'>): ShareResult {
  const encoded = compressToEncodedURIComponent(JSON.stringify({ v: 1, ...payload }));
  const hash = `#${SHARE_HASH_KEY}=${encoded}`;
  if (hash.length > SHARE_MAX_CHARS) return { ok: false, length: hash.length };
  return { ok: true, hash, length: hash.length };
}

export function decodeShare(hash: string): SharePayload | null {
  const m = new RegExp(`(?:^#|&)${SHARE_HASH_KEY}=([^&]+)`).exec(hash);
  if (!m?.[1]) return null;
  try {
    const json = decompressFromEncodedURIComponent(m[1]);
    if (!json) return null;
    const parsed: unknown = JSON.parse(json);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const p = parsed as Partial<SharePayload>;
    if (p.v !== 1 || typeof p.text !== 'string') return null;
    return { v: 1, text: p.text, ...(typeof p.name === 'string' ? { name: p.name } : {}) };
  } catch {
    return null;
  }
}
