import { useEffect, useMemo } from 'react';
import { DetailPane } from '@/components/detail/detail-pane';
import { DiagnosticsDrawer } from '@/components/diagnostics/diagnostics-drawer';
import { Footer } from '@/components/footer';
import { Header } from '@/components/header';
import { NoticeToast } from '@/components/notice-toast';
import { ReplayBar } from '@/components/replay/replay-bar';
import { SourcePanel } from '@/components/source/source-panel';
import { Timeline } from '@/components/timeline/timeline';
import { DEFAULT_SAMPLE_ID, findSample } from '@/core/samples';
import { decodeShare } from '@/core/share';
import { loadText } from './load-stream';
import { useInspector } from './store';
import { useDiagnosticsReport } from './use-diagnostics';

export function App() {
  const report = useDiagnosticsReport();
  const shared = useMemo(
    () => decodeShare(typeof location === 'undefined' ? '' : location.hash),
    [],
  );

  useEffect(() => {
    if (shared) {
      useInspector.getState().setPasteText(shared.text);
      void loadText(shared.text, { kind: 'share', label: shared.name ?? 'Shared stream' });
      return;
    }
    const sample = findSample(DEFAULT_SAMPLE_ID);
    if (!sample) return;
    useInspector.getState().setPasteText(sample.text(), sample.id);
    void loadText(sample.text(), { kind: 'paste', label: sample.name });
  }, [shared]);

  return (
    <div id="top" className="flex min-h-full flex-col bg-bg text-fg lg:h-dvh lg:overflow-hidden">
      <Header report={report} />
      <SourcePanel />
      <main className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="flex h-[52dvh] min-h-0 flex-col lg:h-auto lg:flex-[5] lg:min-w-0">
          <Timeline />
        </div>
        <div className="flex min-h-[40dvh] flex-col border-t border-line lg:min-h-0 lg:flex-[6] lg:min-w-0 lg:border-t-0">
          <DetailPane />
        </div>
      </main>
      <ReplayBar />
      <Footer />
      <DiagnosticsDrawer report={report} />
      <NoticeToast />
    </div>
  );
}
