import { describe, expect, it } from 'vitest';
import {
  computeTokenStats,
  detectEventVariants,
  detectGaps,
  detectIdIssues,
  detectMalformed,
  detectMissingTerminal,
  detectShapeDrift,
  DEFAULT_DIAGNOSTICS_OPTIONS,
  runDiagnostics,
} from '../diagnostics';
import {
  CHAT_COMPLETIONS_STREAM,
  DUAL_SPELLING_STREAM,
  ID_GAPS_STREAM,
  MALFORMED_STREAM,
} from '../samples/all';
import { parseSseText } from '../sse-parser';
import { applyPastedTiming } from '../timing';

const load = (text: string) => applyPastedTiming(parseSseText(text));

describe('detectEventVariants', () => {
  it('flags thinking_state / thinking-state with differing shapes as an error', () => {
    const [d] = detectEventVariants(load(DUAL_SPELLING_STREAM));
    expect(d).toBeDefined();
    expect(d!.severity).toBe('error');
    expect(d!.meta?.normalized).toBe('thinking_state');
    expect(d!.meta?.shapesDiffer).toBe(true);
    expect(d!.frames).toEqual([1, 2, 3, 4, 5]);
  });
  it('downgrades to a warning when the shapes are identical', () => {
    const frames = load('event: token\ndata: {"t":"a"}\n\nevent: tokens\ndata: {"t":"b"}\n\n');
    const [d] = detectEventVariants(frames);
    expect(d?.severity).toBe('warning');
  });
  it('is silent for consistently spelled streams', () => {
    expect(detectEventVariants(load(CHAT_COMPLETIONS_STREAM))).toEqual([]);
  });
});

describe('detectShapeDrift', () => {
  it('reports an event whose payload shape changes', () => {
    const d = detectShapeDrift(load(MALFORMED_STREAM));
    const status = d.find((x) => x.meta?.event === 'status');
    expect(status).toBeDefined();
    expect(status!.detail).toContain('$.percent: number→string');
    const result = d.find((x) => x.meta?.event === 'result');
    expect(result!.detail).toContain('$.items[]: number→string');
  });
  it('warns only on a hard type change, info for optional fields', () => {
    const soft = detectShapeDrift(
      load(
        'event: r\ndata: {"a":1}\n\nevent: r\ndata: {"a":1,"b":"x"}\n\nevent: r\ndata: {"a":1,"b":null}\n\n',
      ),
    );
    expect(soft[0]?.severity).toBe('info');
    const hard = detectShapeDrift(load('event: r\ndata: {"a":1}\n\nevent: r\ndata: {"a":"1"}\n\n'));
    expect(hard[0]?.severity).toBe('warning');
  });
  it('ignores array-length differences', () => {
    const frames = load('event: r\ndata: {"a":[1]}\n\nevent: r\ndata: {"a":[1,2,3]}\n\n');
    expect(detectShapeDrift(frames)).toEqual([]);
  });
});

describe('detectIdIssues', () => {
  it('finds duplicate and out-of-order ids', () => {
    const d = detectIdIssues(load(ID_GAPS_STREAM));
    const dupe = d.find((x) => x.kind === 'id-duplicate');
    const order = d.find((x) => x.kind === 'id-out-of-order');
    expect(dupe?.meta?.ids).toEqual(['103', '104']);
    expect(order?.frames).toEqual([7]);
  });
  it('does not call non-numeric ids out of order', () => {
    const d = detectIdIssues(load('id: b\ndata: 1\n\nid: a\ndata: 2\n\n'));
    expect(d.find((x) => x.kind === 'id-out-of-order')).toBeUndefined();
  });
  it('is silent without ids', () => {
    expect(detectIdIssues(load('data: 1\n\ndata: 2\n\n'))).toEqual([]);
  });
});

describe('detectGaps', () => {
  it('flags silences above the threshold', () => {
    const d = detectGaps(load(ID_GAPS_STREAM), DEFAULT_DIAGNOSTICS_OPTIONS);
    expect(d).toHaveLength(1);
    expect(d[0]!.meta?.gapMs).toBe(7000);
    expect(d[0]!.frames).toEqual([8, 9]);
  });
  it('respects a custom threshold', () => {
    const frames = load(': t=0\ndata: a\n\n: t=300\ndata: b\n\n');
    expect(
      detectGaps(frames, { ...DEFAULT_DIAGNOSTICS_OPTIONS, gapThresholdMs: 100 }),
    ).toHaveLength(1);
    expect(
      detectGaps(frames, { ...DEFAULT_DIAGNOSTICS_OPTIONS, gapThresholdMs: 500 }),
    ).toHaveLength(0);
  });
});

describe('detectMissingTerminal', () => {
  it('accepts an event-name terminal', () => {
    expect(detectMissingTerminal(load(DUAL_SPELLING_STREAM), DEFAULT_DIAGNOSTICS_OPTIONS)).toEqual(
      [],
    );
  });
  it('accepts a data-literal terminal like [DONE]', () => {
    expect(
      detectMissingTerminal(load(CHAT_COMPLETIONS_STREAM), DEFAULT_DIAGNOSTICS_OPTIONS),
    ).toEqual([]);
  });
  it('errors when nothing terminal arrives', () => {
    const [d] = detectMissingTerminal(
      load('event: a\ndata: 1\n\nevent: b\ndata: 2\n\n'),
      DEFAULT_DIAGNOSTICS_OPTIONS,
    );
    expect(d?.severity).toBe('error');
    expect(d?.frames).toEqual([1]);
  });
  it('uses a custom terminal list', () => {
    const frames = load('event: finished\ndata: 1\n\n');
    expect(
      detectMissingTerminal(frames, { ...DEFAULT_DIAGNOSTICS_OPTIONS, terminalEvents: ['bye'] }),
    ).toHaveLength(1);
    expect(
      detectMissingTerminal(frames, {
        ...DEFAULT_DIAGNOSTICS_OPTIONS,
        terminalEvents: ['finished'],
      }),
    ).toHaveLength(0);
  });
  it('is silent for an empty stream', () => {
    expect(detectMissingTerminal([], DEFAULT_DIAGNOSTICS_OPTIONS)).toEqual([]);
  });
});

describe('detectMalformed', () => {
  const kinds = detectMalformed(load(MALFORMED_STREAM)).map((d) => d.kind);
  it('finds broken JSON', () => expect(kinds).toContain('broken-json'));
  it('finds data-less blocks', () => expect(kinds).toContain('no-data'));
  it('finds unknown fields', () => expect(kinds).toContain('unknown-field'));
  it('finds invalid retry', () => expect(kinds).toContain('invalid-retry'));
  it('finds an incomplete final block', () => expect(kinds).toContain('incomplete'));
  it('does not report heartbeats as no-data', () => {
    const d = detectMalformed(load(': ping\n\ndata: ok\n\n'));
    expect(d.map((x) => x.kind)).toEqual(['heartbeat']);
  });
  it('is clean for a well-formed stream', () => {
    expect(detectMalformed(load(DUAL_SPELLING_STREAM))).toEqual([]);
  });
});

describe('computeTokenStats', () => {
  it('counts *_delta frames and their characters', () => {
    const stats = computeTokenStats(load(DUAL_SPELLING_STREAM));
    expect(stats?.frames).toBe(6);
    expect(stats?.events).toEqual(['component_delta']);
    expect(stats?.chars).toBeGreaterThan(50);
    expect(stats?.durationMs).toBe(290);
  });
  it('recognises chat-completions delta payloads under the default event', () => {
    const stats = computeTokenStats(load(CHAT_COMPLETIONS_STREAM));
    expect(stats?.frames).toBe(15);
    expect(stats?.chars).toBe(
      'Server-Sent Events is a one-way HTTP push channel that reconnects for free.'.length,
    );
    expect(stats!.charsPerSec).toBeGreaterThan(0);
  });
  it('returns null when nothing looks like tokens', () => {
    expect(computeTokenStats(load(ID_GAPS_STREAM))).toBeNull();
  });
});

describe('runDiagnostics', () => {
  it('orders by severity and summarises counts', () => {
    const report = runDiagnostics(load(MALFORMED_STREAM));
    const sev = report.diagnostics.map((d) => d.severity);
    const rank = { error: 0, warning: 1, info: 2 };
    for (let i = 1; i < sev.length; i++)
      expect(rank[sev[i]!]).toBeGreaterThanOrEqual(rank[sev[i - 1]!]);
    expect(report.worst).toBe('error');
    expect(report.counts.error + report.counts.warning + report.counts.info).toBe(
      report.diagnostics.length,
    );
  });
  it('is clean and null-worst for an empty frame list', () => {
    expect(runDiagnostics([])).toEqual({
      diagnostics: [],
      tokenStats: null,
      counts: { error: 0, warning: 0, info: 0 },
      worst: null,
    });
  });
  it('reports the chat-completions sample as info-only (optional fields, no type change)', () => {
    const report = runDiagnostics(load(CHAT_COMPLETIONS_STREAM));
    expect(report.worst).toBe('info');
    expect(report.diagnostics.map((d) => d.kind)).toEqual(['shape-drift']);
  });
});
