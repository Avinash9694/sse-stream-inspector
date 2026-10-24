import { describe, expect, it } from 'vitest';
import { runDiagnostics } from '../diagnostics';
import { DEFAULT_SAMPLE_ID, findSample, generateLargeStream, SAMPLE_STREAMS } from '../samples';
import { parseSseText } from '../sse-parser';
import { applyPastedTiming } from '../timing';

describe('sample streams', () => {
  it('all parse and the default exists', () => {
    expect(findSample(DEFAULT_SAMPLE_ID)).toBeDefined();
    for (const s of SAMPLE_STREAMS) expect(parseSseText(s.text()).length).toBeGreaterThan(0);
  });
  it('the generated stream has the requested size and plants a spelling drift', () => {
    const frames = applyPastedTiming(parseSseText(generateLargeStream(2000)));
    expect(frames).toHaveLength(2000);
    const report = runDiagnostics(frames);
    expect(report.diagnostics.some((d) => d.kind === 'event-variants')).toBe(true);
    expect(frames[frames.length - 1]!.event).toBe('done');
  });
  it('is deterministic', () => {
    expect(generateLargeStream(300)).toBe(generateLargeStream(300));
  });
});
