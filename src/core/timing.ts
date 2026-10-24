import type { Frame } from './frame';

/** Default spacing applied to pasted input that carries no timing annotation. */
export const DEFAULT_SYNTHETIC_GAP_MS = 40;

const TIMING_COMMENT = /^\s*t\s*=\s*(\d+(?:\.\d+)?)\s*(ms|s)?\s*$/i;

/**
 * Pasted text has no clock, so every frame is first stamped from a synthetic
 * one. A comment line of the form `: t=1250` (ms offset, or `t=1.25s`)
 * immediately preceding a block overrides that frame's timestamp; frames
 * after it continue at the default gap until the next annotation.
 */
export function applyPastedTiming(frames: Frame[], gapMs = DEFAULT_SYNTHETIC_GAP_MS): Frame[] {
  let cursor = 0;
  return frames.map((frame, i) => {
    const explicit = readTimingAnnotation(frame.comments);
    if (explicit !== undefined) {
      cursor = explicit;
    } else if (i > 0) {
      cursor += gapMs;
    }
    return { ...frame, receivedAt: cursor };
  });
}

export function readTimingAnnotation(comments: readonly string[] | undefined): number | undefined {
  if (!comments) return undefined;
  for (const c of comments) {
    const m = TIMING_COMMENT.exec(c);
    if (m?.[1] !== undefined) {
      const n = Number(m[1]);
      return m[2]?.toLowerCase() === 's' ? n * 1000 : n;
    }
  }
  return undefined;
}

export function hasTimingAnnotations(frames: readonly Frame[]): boolean {
  return frames.some((f) => readTimingAnnotation(f.comments) !== undefined);
}
