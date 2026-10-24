import { useMemo, useState } from 'react';
import { useInspector } from '@/app/store';
import type { Frame } from '@/core/frame';
import { diffJson } from '@/core/json-diff';
import { diffShapes, payloadOf, shapeOf, type JsonValue } from '@/core/payload';
import { formatBytes, formatClock, formatOffset } from '@/utils/format';
import { EventChip } from '../ui/event-chip';
import { Tabs } from '../ui/tabs';
import { JsonTree } from './json-tree';

type DetailTab = 'json' | 'raw' | 'shape' | 'diff';
const TABS: { id: DetailTab; label: string }[] = [
  { id: 'json', label: 'Payload' },
  { id: 'raw', label: 'Raw' },
  { id: 'shape', label: 'Shape' },
  { id: 'diff', label: 'Diff vs previous' },
];

export function DetailPane() {
  const frames = useInspector((s) => s.frames);
  const selected = useInspector((s) => s.selected);
  const [tab, setTab] = useState<DetailTab>('json');
  const frame = selected === null ? undefined : frames[selected];
  const base = frames[0]?.receivedAt ?? 0;

  const previous = useMemo(() => {
    if (!frame) return undefined;
    for (let i = frame.index - 1; i >= 0; i--) {
      const f = frames[i];
      if (f?.dispatched && f.event === frame.event) return f;
    }
    return undefined;
  }, [frames, frame]);

  return (
    <section
      aria-labelledby="detail-heading"
      className="flex min-h-0 flex-1 flex-col lg:border-l lg:border-line"
    >
      <div className="flex flex-col gap-1 border-b border-line px-3 py-2">
        <h2 id="detail-heading" className="text-sm font-semibold">
          Frame detail
        </h2>
        {frame ? (
          <FrameMeta frame={frame} offset={frame.receivedAt - base} />
        ) : (
          <p className="text-xs text-muted">Select a frame in the timeline.</p>
        )}
      </div>
      {frame && (
        <>
          <div className="px-3">
            <Tabs items={TABS} value={tab} onChange={setTab} label="Frame detail view" size="sm" />
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-3">
            {tab === 'json' && <PayloadView frame={frame} />}
            {tab === 'raw' && <RawView frame={frame} />}
            {tab === 'shape' && <ShapeView frame={frame} />}
            {tab === 'diff' && <DiffView frame={frame} previous={previous} />}
          </div>
        </>
      )}
    </section>
  );
}

function FrameMeta({ frame, offset }: { frame: Frame; offset: number }) {
  const items: [string, React.ReactNode][] = [
    ['#', frame.index],
    ['event', <EventChip key="e" name={frame.event} dispatched={frame.dispatched} />],
    ['offset', formatOffset(offset)],
    ['at', formatClock(frame.receivedAt)],
    ['size', formatBytes(frame.raw.length)],
    ['byte', frame.byteOffset],
  ];
  if (frame.id !== undefined) items.push(['id', frame.id]);
  if (frame.lastEventId !== undefined && frame.lastEventId !== frame.id)
    items.push(['lastEventId', frame.lastEventId]);
  if (frame.retry !== undefined) items.push(['retry', `${frame.retry} ms`]);
  return (
    <dl className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-muted">
      {items.map(([k, v]) => (
        <div key={k} className="flex items-center gap-1">
          <dt>{k}</dt>
          <dd className="text-fg">{v}</dd>
        </div>
      ))}
      {!frame.dispatched && <dd className="text-warning">not dispatched (no data)</dd>}
      {frame.incomplete && <dd className="text-error">incomplete — no terminating blank line</dd>}
      {frame.unknownFields?.map((f) => (
        <dd key={f} className="text-warning">
          unknown field `{f}`
        </dd>
      ))}
    </dl>
  );
}

function PayloadView({ frame }: { frame: Frame }) {
  const parsed = payloadOf(frame);
  if (parsed.kind === 'empty') {
    return (
      <p className="text-xs text-muted">
        No data.{' '}
        {frame.comments?.length
          ? `Comments: ${frame.comments.map((c) => `“${c}”`).join(', ')}`
          : ''}
      </p>
    );
  }
  if (parsed.kind === 'json' && parsed.json !== undefined) return <JsonTree value={parsed.json} />;
  return (
    <div className="flex flex-col gap-2">
      {parsed.brokenJson && (
        <p className="rounded-lg border border-error/40 bg-error/10 px-2 py-1 font-mono text-[11px] text-error">
          JSON parse failed: {parsed.error}
        </p>
      )}
      <pre className="whitespace-pre-wrap break-all font-mono text-xs leading-5 text-fg">
        {frame.data}
      </pre>
    </div>
  );
}

function RawView({ frame }: { frame: Frame }) {
  return (
    <pre className="whitespace-pre-wrap break-all font-mono text-xs leading-5 text-fg">
      {frame.raw}
    </pre>
  );
}

function ShapeView({ frame }: { frame: Frame }) {
  const paths = shapeOf(frame);
  if (!paths)
    return (
      <p className="text-xs text-muted">
        Not JSON — no shape signature. Plain-text frames compare by exact string only.
      </p>
    );
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted">
        {paths.length} leaf path{paths.length === 1 ? '' : 's'}. Sorted, array-length-independent,
        key-order-independent — two frames with the same list have the same structure.
      </p>
      <ol className="font-mono text-xs leading-5">
        {paths.map((p) => {
          const sep = p.lastIndexOf(': ');
          return (
            <li key={p} className="flex gap-2">
              <span className="text-fg">{p.slice(0, sep)}</span>
              <span className="text-muted">{p.slice(sep + 2)}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function DiffView({ frame, previous }: { frame: Frame; previous: Frame | undefined }) {
  if (!previous)
    return (
      <p className="text-xs text-muted">
        No earlier <code className="font-mono">{frame.event || 'message'}</code> frame to compare
        with.
      </p>
    );
  const a = payloadOf(previous);
  const b = payloadOf(frame);
  const shapeA = shapeOf(previous);
  const shapeB = shapeOf(frame);
  const shapeDiff = shapeA && shapeB ? diffShapes(shapeA, shapeB) : null;
  const shapeChanged = shapeDiff
    ? shapeDiff.added.length + shapeDiff.removed.length + shapeDiff.changed.length > 0
    : null;

  return (
    <div className="flex flex-col gap-3 text-xs">
      <p className="text-muted">
        Comparing with frame <span className="font-mono text-fg">#{previous.index}</span> (
        {formatOffset(frame.receivedAt - previous.receivedAt)} earlier).
      </p>
      {shapeDiff && (
        <div
          className={`rounded-lg border px-2 py-1.5 ${shapeChanged ? 'border-warning/40 bg-warning/10' : 'border-line bg-panel-2'}`}
        >
          <p className={`font-medium ${shapeChanged ? 'text-warning' : 'text-ok'}`}>
            {shapeChanged ? 'Shape changed' : 'Same shape'}
          </p>
          {shapeChanged && (
            <ul className="mt-1 font-mono text-[11px] leading-5">
              {shapeDiff.added.map((p) => (
                <li key={`+${p}`} className="text-ok">
                  + {p}
                </li>
              ))}
              {shapeDiff.removed.map((p) => (
                <li key={`-${p}`} className="text-error">
                  − {p}
                </li>
              ))}
              {shapeDiff.changed.map((c) => (
                <li key={`~${c.path}`} className="text-warning">
                  ~ {c.path}: {c.from} → {c.to}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {a.kind === 'json' && b.kind === 'json' && a.json !== undefined && b.json !== undefined ? (
        <ValueDiff from={a.json} to={b.json} />
      ) : (
        <TextDiff from={previous.data} to={frame.data} />
      )}
    </div>
  );
}

function ValueDiff({ from, to }: { from: JsonValue; to: JsonValue }) {
  const changes = useMemo(() => diffJson(from, to), [from, to]);
  if (changes.length === 0) return <p className="text-muted">Payloads are identical.</p>;
  return (
    <ul className="flex flex-col gap-1 font-mono text-[11px] leading-5">
      {changes.map((c, i) => (
        <li key={`${c.path}-${i}`} className="rounded-md border border-line bg-panel-2 px-2 py-1">
          <span
            className={
              c.type === 'CREATE' ? 'text-ok' : c.type === 'REMOVE' ? 'text-error' : 'text-warning'
            }
          >
            {c.type === 'CREATE' ? '+' : c.type === 'REMOVE' ? '−' : '~'}
          </span>{' '}
          <span className="text-fg">{c.path}</span>
          {c.type !== 'CREATE' && (
            <span className="block break-all pl-4 text-error/90">− {JSON.stringify(c.from)}</span>
          )}
          {c.type !== 'REMOVE' && (
            <span className="block break-all pl-4 text-ok/90">+ {JSON.stringify(c.to)}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

function TextDiff({ from, to }: { from: string; to: string }) {
  if (from === to) return <p className="text-muted">Payloads are identical.</p>;
  return (
    <div className="grid gap-2 font-mono text-[11px] leading-5 sm:grid-cols-2">
      <pre className="whitespace-pre-wrap break-all rounded-md border border-line bg-panel-2 p-2 text-error/90">
        − {from}
      </pre>
      <pre className="whitespace-pre-wrap break-all rounded-md border border-line bg-panel-2 p-2 text-ok/90">
        + {to}
      </pre>
    </div>
  );
}
