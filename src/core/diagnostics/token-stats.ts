import type { Frame } from '../frame';
import type { JsonValue } from '../payload';
import { payloadOf } from '../payload';
import type { TokenStats } from './types';

const TOKEN_EVENT = /(^|[_-])(delta|token|chunk)s?$|^delta$/i;
const TOKEN_KEY = /^(delta|content|text|token|tokens|chunk|delta_text|output_text)$/i;

/**
 * Frames that carry incremental model output: event names like
 * `component_delta` / `message-delta`, or chat-completions style payloads with
 * a `delta` object. Characters are summed over the string leaves under
 * content-ish keys so a wrapper object does not inflate the count.
 */
export function isTokenFrame(frame: Frame): boolean {
  if (!frame.dispatched) return false;
  if (TOKEN_EVENT.test(frame.event)) return true;
  const parsed = payloadOf(frame);
  if (parsed.kind !== 'json' || parsed.json === undefined) return false;
  return hasKeyDeep(parsed.json, 'delta', 3);
}

export function tokenChars(frame: Frame): number {
  const parsed = payloadOf(frame);
  if (parsed.kind !== 'json' || parsed.json === undefined) return frame.data.length;
  let chars = 0;
  let matched = false;
  const visit = (v: JsonValue, key: string): void => {
    if (typeof v === 'string') {
      if (TOKEN_KEY.test(key)) {
        chars += v.length;
        matched = true;
      }
      return;
    }
    if (Array.isArray(v)) {
      for (const item of v) visit(item, key);
      return;
    }
    if (v && typeof v === 'object') {
      for (const [k, child] of Object.entries(v)) visit(child, k);
    }
  };
  visit(parsed.json, '');
  return matched ? chars : 0;
}

export function computeTokenStats(frames: readonly Frame[]): TokenStats | null {
  const tokenFrames = frames.filter(isTokenFrame);
  if (tokenFrames.length === 0) return null;
  const chars = tokenFrames.reduce((sum, f) => sum + tokenChars(f), 0);
  const first = tokenFrames[0];
  const last = tokenFrames.at(-1);
  if (!first || !last) return null;
  const durationMs = Math.max(0, last.receivedAt - first.receivedAt);
  const seconds = durationMs / 1000;
  const events = [...new Set(tokenFrames.map((f) => f.event))];
  return {
    frames: tokenFrames.length,
    chars,
    durationMs,
    charsPerSec: seconds > 0 ? chars / seconds : chars,
    framesPerSec: seconds > 0 ? tokenFrames.length / seconds : tokenFrames.length,
    events,
  };
}

function hasKeyDeep(value: JsonValue, key: string, depth: number): boolean {
  if (depth < 0 || value === null || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some((v) => hasKeyDeep(v, key, depth - 1));
  if (key in value) return true;
  return Object.values(value).some((v) => hasKeyDeep(v, key, depth - 1));
}
