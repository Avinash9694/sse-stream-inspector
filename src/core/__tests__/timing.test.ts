import { describe, expect, it } from 'vitest';
import { parseSseText } from '../sse-parser';
import { applyPastedTiming, hasTimingAnnotations, readTimingAnnotation } from '../timing';

describe('applyPastedTiming', () => {
  it('uses `: t=` annotations when present and the default gap otherwise', () => {
    const frames = applyPastedTiming(
      parseSseText(': t=0\ndata: a\n\ndata: b\n\n: t=500\ndata: c\n\ndata: d\n\n'),
      40,
    );
    expect(frames.map((f) => f.receivedAt)).toEqual([0, 40, 500, 540]);
  });
  it('understands seconds', () => {
    expect(readTimingAnnotation(['t=1.5s'])).toBe(1500);
    expect(readTimingAnnotation(['t = 250 ms'])).toBe(250);
    expect(readTimingAnnotation(['keep-alive'])).toBeUndefined();
    expect(readTimingAnnotation(undefined)).toBeUndefined();
  });
  it('reports whether any annotation exists', () => {
    expect(hasTimingAnnotations(parseSseText('data: a\n\n'))).toBe(false);
    expect(hasTimingAnnotations(parseSseText(': t=9\ndata: a\n\n'))).toBe(true);
  });
});
