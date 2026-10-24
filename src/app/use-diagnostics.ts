import { useDeferredValue, useMemo } from 'react';
import { runDiagnostics, type DiagnosticsReport } from '@/core/diagnostics';
import { selectRevealedFrames, useInspector } from './store';

/**
 * Diagnostics over the frames currently revealed. Deferred so a fast replay or
 * a live burst never blocks the timeline paint on the O(n) analysis.
 */
export function useDiagnosticsReport(): DiagnosticsReport {
  const frames = useInspector((s) => s.frames);
  const replayCursor = useInspector((s) => s.replayCursor);
  const options = useInspector((s) => s.options);
  const revealed = useMemo(
    () => selectRevealedFrames({ frames, replayCursor }),
    [frames, replayCursor],
  );
  const deferred = useDeferredValue(revealed);
  return useMemo(() => runDiagnostics(deferred, options), [deferred, options]);
}
