import { useEffect, useRef, useState } from 'react';
import {
  DEFAULT_LIVE_CONFIG,
  startLiveConnection,
  type LiveConfig,
  type LiveConnection,
} from '@/app/live-connection';
import { useInspector } from '@/app/store';
import type { Frame } from '@/core/frame';
import { formatBytes } from '@/utils/format';
import { Button } from '../ui/button';
import { StopIcon, PlayIcon } from '../ui/icons';

export function LiveSource() {
  const [config, setConfig] = useState<LiveConfig>(DEFAULT_LIVE_CONFIG);
  const live = useInspector((s) => s.live);
  const setLive = useInspector((s) => s.setLive);
  const setLiveBytes = useInspector((s) => s.setLiveBytes);
  const connRef = useRef<LiveConnection | null>(null);
  const pendingRef = useRef<Frame[]>([]);
  const rafRef = useRef<number | null>(null);

  const flush = () => {
    rafRef.current = null;
    const batch = pendingRef.current;
    if (batch.length === 0) return;
    pendingRef.current = [];
    useInspector.getState().appendFrames(batch);
  };

  const stop = () => {
    connRef.current?.stop();
    connRef.current = null;
  };

  useEffect(
    () => () => {
      connRef.current?.stop();
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  const start = () => {
    stop();
    const store = useInspector.getState();
    store.setFrames([], { kind: 'live', label: config.url, url: config.url }, null);
    store.setLiveBytes(0);
    store.beginLoad();
    connRef.current = startLiveConnection(config, {
      onFrames: (frames) => {
        pendingRef.current.push(...frames);
        rafRef.current ??= requestAnimationFrame(flush);
      },
      onStatus: (status, detail) => {
        setLive(status, detail ?? null);
        if (status !== 'connecting') useInspector.setState({ loading: false });
        if (status === 'error') useInspector.getState().failLoad(detail ?? 'Connection failed.');
      },
      onBytes: setLiveBytes,
    });
  };

  const busy = live.status === 'connecting' || live.status === 'open';
  const field = 'h-10 rounded-lg border border-line bg-bg px-2 font-mono text-xs text-fg';
  const update = <K extends keyof LiveConfig>(key: K, value: LiveConfig[K]) =>
    setConfig((c) => ({ ...c, [key]: value }));

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-2 sm:grid-cols-[auto_1fr_auto]">
        <label className="flex flex-col gap-1 text-xs text-muted">
          Method
          <select
            value={config.method}
            onChange={(e) => update('method', e.target.value as LiveConfig['method'])}
            className={field}
            disabled={config.mode === 'eventsource'}
          >
            <option>GET</option>
            <option>POST</option>
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-xs text-muted">
          URL
          <input
            type="url"
            value={config.url}
            onChange={(e) => update('url', e.target.value)}
            className={`${field} min-w-0`}
            placeholder="https://api.example.com/v1/stream"
          />
        </label>
        <div className="flex items-end gap-2">
          {busy ? (
            <Button variant="danger" onClick={stop}>
              <StopIcon size={14} /> Stop
            </Button>
          ) : (
            <Button variant="primary" onClick={start} disabled={!config.url}>
              <PlayIcon size={14} /> Start
            </Button>
          )}
        </div>
      </div>

      <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        <legend className="sr-only">Transport</legend>
        <label className="inline-flex min-h-10 items-center gap-2">
          <input
            type="radio"
            name="live-mode"
            checked={config.mode === 'fetch'}
            onChange={() => update('mode', 'fetch')}
            className="accent-accent"
          />
          <span>
            <span className="text-fg">fetch + ReadableStream</span> — any method, custom headers,
            body; sees ids and comments
          </span>
        </label>
        <label className="inline-flex min-h-10 items-center gap-2">
          <input
            type="radio"
            name="live-mode"
            checked={config.mode === 'eventsource'}
            onChange={() => update('mode', 'eventsource')}
            className="accent-accent"
          />
          <span>
            <span className="text-fg">EventSource</span> — GET only, auto-reconnect, named events
            must be listed
          </span>
        </label>
      </fieldset>

      {config.mode === 'fetch' ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs text-muted">
            Headers (one per line)
            <textarea
              value={config.headers}
              onChange={(e) => update('headers', e.target.value)}
              rows={3}
              spellCheck={false}
              className="rounded-lg border border-line bg-bg p-2 font-mono text-xs text-fg"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Body {config.method === 'GET' && <span>(sent with POST only)</span>}
            <textarea
              value={config.body}
              onChange={(e) => update('body', e.target.value)}
              rows={3}
              spellCheck={false}
              disabled={config.method === 'GET'}
              className="rounded-lg border border-line bg-bg p-2 font-mono text-xs text-fg disabled:opacity-50"
              placeholder='{"prompt":"hello"}'
            />
          </label>
        </div>
      ) : (
        <label className="flex flex-col gap-1 text-xs text-muted">
          Named events to listen for (comma-separated; <code className="font-mono">message</code> is
          always included)
          <input
            value={config.eventNames}
            onChange={(e) => update('eventNames', e.target.value)}
            className={field}
          />
        </label>
      )}

      <div
        className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs"
        role="status"
        aria-live="polite"
      >
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className={`inline-block h-2 w-2 rounded-full ${live.status === 'open' ? 'bg-ok animate-pulse' : live.status === 'connecting' ? 'bg-warning' : live.status === 'error' ? 'bg-error' : 'bg-muted'}`}
          />
          <span className="text-fg capitalize">{live.status}</span>
        </span>
        {live.bytes > 0 && (
          <span className="font-mono text-muted">{formatBytes(live.bytes)} received</span>
        )}
        {live.detail && (
          <span className={live.status === 'error' ? 'text-error' : 'text-muted'}>
            {live.detail}
          </span>
        )}
      </div>

      <p className="text-xs text-muted">
        Requests go straight from this page to the URL, so the server must allow this origin with
        CORS (<code className="font-mono">Access-Control-Allow-Origin</code>, plus any custom header
        names). For a quick try, run the bundled demo server:{' '}
        <code className="font-mono">npm run demo-server</code> then start against{' '}
        <code className="font-mono">http://localhost:8787/stream/dual-spelling</code>.
      </p>
    </div>
  );
}
