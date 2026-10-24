import { useInspector, type SourceTab } from '@/app/store';
import { formatBytes, pluralize } from '@/utils/format';
import { Button } from '../ui/button';
import { ChevronIcon } from '../ui/icons';
import { Tabs } from '../ui/tabs';
import { HarSource } from './har-source';
import { LiveSource } from './live-source';
import { PasteSource } from './paste-source';

const TABS: { id: SourceTab; label: string }[] = [
  { id: 'paste', label: 'Paste' },
  { id: 'live', label: 'Live connect' },
  { id: 'har', label: 'HAR import' },
];

export function SourcePanel() {
  const tab = useInspector((s) => s.sourceTab);
  const setTab = useInspector((s) => s.setSourceTab);
  const collapsed = useInspector((s) => s.sourceCollapsed);
  const setCollapsed = useInspector((s) => s.setSourceCollapsed);
  const frames = useInspector((s) => s.frames);
  const source = useInspector((s) => s.source);
  const parseMs = useInspector((s) => s.parseMs);
  const rawText = useInspector((s) => s.rawText);

  return (
    <section aria-labelledby="source-heading" className="border-b border-line bg-panel">
      <div className="flex items-center gap-2 px-3 py-1.5 sm:px-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(!collapsed)}
          aria-expanded={!collapsed}
          aria-controls="source-body"
          className="-ml-2 gap-2 px-2"
        >
          <ChevronIcon
            size={14}
            className={`transition-transform ${collapsed ? '-rotate-90' : ''}`}
          />
          <span id="source-heading" className="text-sm font-semibold">
            Source
          </span>
        </Button>
        <p className="min-w-0 flex-1 truncate text-xs text-muted" aria-live="polite">
          {source ? (
            <>
              <span className="text-fg">{source.label}</span>
              {' · '}
              {pluralize(frames.length, 'frame')}
              {rawText !== null && ` · ${formatBytes(new Blob([rawText]).size)}`}
              {parseMs !== null && ` · parsed in ${parseMs < 1 ? '<1' : parseMs.toFixed(0)} ms`}
            </>
          ) : (
            'No stream loaded'
          )}
        </p>
      </div>
      {!collapsed && (
        <div id="source-body" className="px-3 pb-3 sm:px-4">
          <Tabs items={TABS} value={tab} onChange={setTab} label="Stream source" size="sm" />
          <div className="pt-3">
            {tab === 'paste' && <PasteSource />}
            {tab === 'live' && <LiveSource />}
            {tab === 'har' && <HarSource />}
          </div>
        </div>
      )}
    </section>
  );
}
