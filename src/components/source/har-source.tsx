import { useState, type DragEvent } from 'react';
import { loadText, readHarFile } from '@/app/load-stream';
import type { HarSseEntry } from '@/core/har';
import { formatBytes } from '@/utils/format';
import { Button } from '../ui/button';
import { UploadIcon } from '../ui/icons';

export function HarSource() {
  const [entries, setEntries] = useState<HarSseEntry[] | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleFile = async (file: File) => {
    setBusy(true);
    setError(null);
    setFileName(file.name);
    try {
      const found = await readHarFile(file);
      setEntries(found);
      if (found.length === 0)
        setError(
          'No text/event-stream responses in this HAR. Chrome only records a stream body if the request finished while DevTools was open.',
        );
    } catch (err) {
      setEntries(null);
      setError(err instanceof Error ? err.message : 'Could not read HAR.');
    } finally {
      setBusy(false);
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) void handleFile(f);
  };

  return (
    <div className="flex flex-col gap-3">
      <div
        role="region"
        aria-label="HAR drop zone"
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-6 text-center text-sm transition-colors ${
          dragging ? 'border-accent bg-accent-soft' : 'border-line bg-bg'
        }`}
      >
        <UploadIcon size={20} className="text-muted" />
        <p className="text-muted">
          Drop a <code className="font-mono">.har</code> file here, or
        </p>
        <label className="inline-flex">
          <span className="sr-only">Choose HAR file</span>
          <input
            type="file"
            accept=".har,application/json"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
              e.target.value = '';
            }}
          />
          <span className="inline-flex h-10 cursor-pointer items-center rounded-lg border border-line bg-panel px-4 text-sm hover:bg-panel-2">
            {busy ? 'Reading…' : 'Choose file'}
          </span>
        </label>
        {fileName && <p className="font-mono text-xs text-muted">{fileName}</p>}
      </div>
      {error && (
        <p role="alert" className="text-xs text-error">
          {error}
        </p>
      )}
      {entries && entries.length > 0 && (
        <ul className="flex flex-col gap-2" aria-label="Event-stream responses">
          {entries.map((e) => (
            <li
              key={e.index}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-bg p-2 text-xs"
            >
              <span className="font-mono text-muted">{e.method}</span>
              <span className={`font-mono ${e.status >= 400 ? 'text-error' : 'text-ok'}`}>
                {e.status}
              </span>
              <span className="min-w-0 flex-1 truncate font-mono" title={e.url}>
                {e.url}
              </span>
              <span className="text-muted">{formatBytes(e.body.length)}</span>
              {e.sniffed && (
                <span className="rounded bg-panel-2 px-1.5 py-0.5 text-[10px] text-warning">
                  sniffed
                </span>
              )}
              <Button
                size="sm"
                variant="primary"
                onClick={() =>
                  void loadText(e.body, { kind: 'har', label: shortUrl(e.url), url: e.url })
                }
              >
                Load
              </Button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted">
        In Chrome DevTools: Network → right-click → “Save all as HAR with content”. Frames get
        synthetic spacing because HAR does not record per-event timing.
      </p>
    </div>
  );
}

function shortUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.host}${u.pathname}`;
  } catch {
    return url;
  }
}
