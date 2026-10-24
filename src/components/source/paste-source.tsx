import { loadText } from '@/app/load-stream';
import { useInspector } from '@/app/store';
import { findSample, SAMPLE_STREAMS } from '@/core/samples';
import { Button } from '../ui/button';

export function PasteSource() {
  const text = useInspector((s) => s.pasteText);
  const sampleId = useInspector((s) => s.pasteSampleId);
  const setPasteText = useInspector((s) => s.setPasteText);
  const loading = useInspector((s) => s.loading);
  const loadError = useInspector((s) => s.loadError);
  const sample = findSample(sampleId);

  const parse = () => void loadText(text, { kind: 'paste', label: 'Pasted stream' });

  const loadSample = (id: string) => {
    const s = findSample(id);
    if (!s) return;
    const body = s.text();
    // The 10k generated stream is too large to be useful in a textarea.
    setPasteText(id === 'large' ? '' : body, id);
    void loadText(body, { kind: id === 'large' ? 'generated' : 'paste', label: s.name });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-muted sm:max-w-md">
          Sample stream
          <select
            value={sampleId}
            onChange={(e) => loadSample(e.target.value)}
            className="h-10 min-w-0 rounded-lg border border-line bg-panel px-2 text-sm text-fg"
          >
            <option value="" disabled>
              Choose a sample…
            </option>
            {SAMPLE_STREAMS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <Button variant="primary" onClick={parse} disabled={loading || !text.trim()}>
          {loading ? 'Parsing…' : 'Parse stream'}
        </Button>
        <Button variant="ghost" onClick={() => setPasteText('')} disabled={!text}>
          Clear
        </Button>
      </div>
      {sample && <p className="text-xs text-muted">{sample.description}</p>}
      <label className="flex flex-col gap-1 text-xs text-muted">
        <span>
          Raw <code className="font-mono">text/event-stream</code> body — a comment like{' '}
          <code className="font-mono">: t=1250</code> before a block sets its timestamp for replay.{' '}
          <kbd className="font-mono">⌘/Ctrl+Enter</kbd> parses.
        </span>
        <textarea
          value={text}
          onChange={(e) => setPasteText(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') parse();
          }}
          spellCheck={false}
          placeholder={'event: thinking_state\ndata: {"state":"active"}\n\n'}
          rows={4}
          className="min-h-20 w-full resize-y rounded-lg border border-line bg-bg p-3 font-mono text-xs leading-5 text-fg placeholder:text-muted/60"
          aria-describedby={loadError ? 'paste-error' : undefined}
          aria-invalid={loadError ? true : undefined}
        />
      </label>
      {loadError && (
        <p id="paste-error" role="alert" className="text-xs text-error">
          {loadError}
        </p>
      )}
    </div>
  );
}
