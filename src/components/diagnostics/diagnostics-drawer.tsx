import { useEffect, useRef, useState } from 'react';
import { useInspector } from '@/app/store';
import type { Diagnostic, DiagnosticsReport, Severity } from '@/core/diagnostics';
import { formatMs } from '@/core/diagnostics';
import { Button } from '../ui/button';
import { CloseIcon } from '../ui/icons';
import { severityClass, severityLabel } from '@/utils/severity';
import { SeverityDot } from '../ui/severity-badge';

const ORDER: Severity[] = ['error', 'warning', 'info'];

export function DiagnosticsDrawer({ report }: { report: DiagnosticsReport }) {
  const open = useInspector((s) => s.drawerOpen);
  const setOpen = useInspector((s) => s.setDrawerOpen);
  const focusDiagnostic = useInspector((s) => s.focusDiagnostic);
  const options = useInspector((s) => s.options);
  const setOptions = useInspector((s) => s.setOptions);
  const frames = useInspector((s) => s.frames);
  const panelRef = useRef<HTMLElement>(null);
  const [terminalText, setTerminalText] = useState(options.terminalEvents.join(', '));

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, setOpen]);

  if (!open) return null;
  const { diagnostics, tokenStats, counts } = report;

  return (
    <aside
      id="diagnostics-drawer"
      ref={panelRef}
      tabIndex={-1}
      aria-label="Diagnostics"
      className="card fixed inset-x-2 bottom-2 top-16 z-20 flex flex-col overflow-hidden outline-none sm:inset-x-auto sm:right-3 sm:w-[420px] lg:top-14"
    >
      <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
        <h2 className="text-sm font-semibold">
          Diagnostics{' '}
          <span className="font-mono text-xs font-normal text-muted">
            {counts.error}E · {counts.warning}W · {counts.info}I
          </span>
        </h2>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => setOpen(false)}
          aria-label="Close diagnostics"
        >
          <CloseIcon />
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-3">
        {frames.length === 0 ? (
          <p className="text-sm text-muted">Load a stream to analyse it.</p>
        ) : diagnostics.length === 0 ? (
          <p className="rounded-lg border border-line bg-panel-2 p-3 text-sm text-ok">
            Clean stream — consistent event names, stable shapes, ordered ids, terminal event
            present.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {ORDER.flatMap((sev) => diagnostics.filter((d) => d.severity === sev)).map((d) => (
              <DiagnosticCard
                key={d.id}
                diagnostic={d}
                onJump={() => focusDiagnostic(d.frames, d.title)}
              />
            ))}
          </ul>
        )}

        {tokenStats && (
          <section
            aria-labelledby="token-stats"
            className="mt-4 rounded-lg border border-line bg-panel-2 p-3"
          >
            <h3 id="token-stats" className="text-xs font-semibold">
              Token stream
            </h3>
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-[11px]">
              <Stat k="delta frames" v={tokenStats.frames.toLocaleString()} />
              <Stat k="chars" v={tokenStats.chars.toLocaleString()} />
              <Stat k="chars / s" v={tokenStats.charsPerSec.toFixed(1)} />
              <Stat k="frames / s" v={tokenStats.framesPerSec.toFixed(1)} />
              <Stat k="span" v={formatMs(tokenStats.durationMs)} />
              <Stat k="events" v={tokenStats.events.join(', ')} />
            </dl>
          </section>
        )}

        <section aria-labelledby="diag-options" className="mt-4 flex flex-col gap-2">
          <h3 id="diag-options" className="text-xs font-semibold">
            Thresholds
          </h3>
          <label className="flex items-center justify-between gap-2 text-xs text-muted">
            Gap warning above (ms)
            <input
              type="number"
              min={0}
              step={100}
              value={options.gapThresholdMs}
              onChange={(e) =>
                setOptions({ gapThresholdMs: Math.max(0, Number(e.target.value) || 0) })
              }
              className="h-9 w-28 rounded-lg border border-line bg-bg px-2 font-mono text-xs text-fg"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Terminal events or data literals (comma-separated)
            <input
              value={terminalText}
              onChange={(e) => setTerminalText(e.target.value)}
              onBlur={() =>
                setOptions({
                  terminalEvents: terminalText
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
              className="h-9 rounded-lg border border-line bg-bg px-2 font-mono text-xs text-fg"
            />
          </label>
        </section>
      </div>
    </aside>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-muted">{k}</dt>
      <dd className="truncate text-fg" title={v}>
        {v}
      </dd>
    </div>
  );
}

function DiagnosticCard({ diagnostic, onJump }: { diagnostic: Diagnostic; onJump: () => void }) {
  const { severity, title, detail, frames } = diagnostic;
  const variants = diagnostic.meta?.variants as
    { name: string; count: number; shapes: number }[] | undefined;
  return (
    <li className="rounded-lg border border-line bg-panel-2">
      <button
        type="button"
        onClick={onJump}
        className="flex w-full flex-col gap-1 rounded-lg p-3 text-left hover:bg-panel"
        title="Highlight these frames in the timeline"
      >
        <span className="flex items-start gap-2">
          <SeverityDot severity={severity} className="mt-1.5" />
          <span className="min-w-0 flex-1 text-sm font-medium leading-5">
            <Inline text={title} />
          </span>
          <span className={`shrink-0 font-mono text-[10px] uppercase ${severityClass(severity)}`}>
            {severityLabel(severity)}
          </span>
        </span>
        <span className="pl-4 text-xs leading-5 text-muted">
          <Inline text={detail} />
        </span>
        {variants && (
          <ul className="mt-1 flex flex-wrap gap-1 pl-4">
            {variants.map((v) => (
              <li
                key={v.name}
                className="rounded-md border border-line bg-panel px-1.5 py-0.5 font-mono text-[11px]"
              >
                {v.name} <span className="text-muted">×{v.count}</span>
                {v.shapes > 1 && <span className="text-warning"> · {v.shapes} shapes</span>}
              </li>
            ))}
          </ul>
        )}
        <span className="pl-4 font-mono text-[11px] text-accent">
          {frames.length === 1
            ? `frame #${frames[0]}`
            : `${frames.length} frames · first #${frames[0]}`}{' '}
          →
        </span>
      </button>
    </li>
  );
}

/** Renders `code` spans for backtick-quoted fragments in diagnostic copy. */
function Inline({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith('`') && p.endsWith('`') ? (
          <code key={i} className="rounded bg-panel px-1 font-mono text-[0.92em] text-fg">
            {p.slice(1, -1)}
          </code>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}
