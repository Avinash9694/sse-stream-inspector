import type { Frame } from '../frame';
import { isTerminalMarker } from '../normalize';
import type { Diagnostic, DiagnosticsOptions } from './types';

export function detectIdIssues(frames: readonly Frame[]): Diagnostic[] {
  const out: Diagnostic[] = [];
  const seen = new Map<string, number[]>();
  const outOfOrder: number[] = [];
  let prevNumeric: number | undefined;
  let numericIds = 0;
  let totalIds = 0;

  for (const frame of frames) {
    if (frame.id === undefined) continue;
    totalIds++;
    const list = seen.get(frame.id);
    if (list) list.push(frame.index);
    else seen.set(frame.id, [frame.index]);

    if (/^\d+$/.test(frame.id)) {
      numericIds++;
      const n = Number(frame.id);
      if (prevNumeric !== undefined && n < prevNumeric) outOfOrder.push(frame.index);
      prevNumeric = n;
    }
  }

  const dupes = [...seen.entries()].filter(([, idx]) => idx.length > 1);
  if (dupes.length) {
    out.push({
      id: 'id-duplicate',
      kind: 'id-duplicate',
      severity: 'warning',
      title: `${dupes.length} duplicate id${dupes.length === 1 ? '' : 's'}`,
      detail: `Ids reused across frames: ${dupes
        .slice(0, 5)
        .map(([id, idx]) => `\`${id}\` ×${idx.length}`)
        .join(
          ', ',
        )}${dupes.length > 5 ? ', …' : ''}. A reconnecting client resuming from Last-Event-ID cannot tell these apart.`,
      frames: dupes.flatMap(([, idx]) => idx).sort((a, b) => a - b),
      meta: { ids: dupes.map(([id]) => id) },
    });
  }

  if (outOfOrder.length && numericIds === totalIds) {
    out.push({
      id: 'id-out-of-order',
      kind: 'id-out-of-order',
      severity: 'warning',
      title: `${outOfOrder.length} frame${outOfOrder.length === 1 ? '' : 's'} with a decreasing id`,
      detail:
        'Numeric ids went backwards. Either the server interleaves producers or a replay was spliced in; Last-Event-ID resume will skip or repeat frames.',
      frames: outOfOrder,
    });
  }
  return out;
}

export function detectGaps(frames: readonly Frame[], options: DiagnosticsOptions): Diagnostic[] {
  const out: Diagnostic[] = [];
  let prev: Frame | undefined;
  for (const cur of frames) {
    if (!prev) {
      prev = cur;
      continue;
    }
    const gap = cur.receivedAt - prev.receivedAt;
    if (gap > options.gapThresholdMs) {
      out.push({
        id: `gap:${cur.index}`,
        kind: 'gap',
        severity: 'warning',
        title: `${formatMs(gap)} silence before frame #${cur.index}`,
        detail: `Nothing arrived between frame #${prev.index} and #${cur.index} for ${formatMs(gap)} (threshold ${formatMs(options.gapThresholdMs)}). Proxies and load balancers often cut idle streams around 30–60 s; a keep-alive comment avoids that.`,
        frames: [prev.index, cur.index],
        meta: { gapMs: gap },
      });
    }
    prev = cur;
  }
  return out;
}

export function detectMissingTerminal(
  frames: readonly Frame[],
  options: DiagnosticsOptions,
): Diagnostic[] {
  const dispatched = frames.filter((f) => f.dispatched);
  if (dispatched.length === 0) return [];
  const hasTerminal = dispatched.some(
    (f) =>
      isTerminalMarker(f.event, options.terminalEvents) ||
      isTerminalMarker(f.data.trim(), options.terminalEvents),
  );
  if (hasTerminal) return [];
  const last = dispatched.at(-1);
  if (!last) return [];
  return [
    {
      id: 'missing-terminal',
      kind: 'missing-terminal',
      severity: 'error',
      title: 'No terminal event',
      detail: `The stream ended on \`${last.event}\` without any of: ${options.terminalEvents
        .map((t) => `\`${t}\``)
        .join(
          ', ',
        )}. A client waiting for completion will spin forever on a turn that is already dead.`,
      frames: [last.index],
    },
  ];
}

export function formatMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(ms < 10_000 ? 2 : 1)} s`;
  return `${(ms / 60_000).toFixed(1)} min`;
}
