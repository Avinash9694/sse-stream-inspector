import type { Frame } from '../frame';
import { detectEventVariants } from './event-variants';
import { detectMalformed } from './malformed';
import { detectGaps, detectIdIssues, detectMissingTerminal } from './ordering';
import { detectShapeDrift } from './shape-drift';
import { computeTokenStats } from './token-stats';
import {
  DEFAULT_DIAGNOSTICS_OPTIONS,
  type Diagnostic,
  type DiagnosticsOptions,
  type DiagnosticsReport,
  type Severity,
} from './types';

const SEVERITY_RANK: Record<Severity, number> = { error: 0, warning: 1, info: 2 };

export function runDiagnostics(
  frames: readonly Frame[],
  options: Partial<DiagnosticsOptions> = {},
): DiagnosticsReport {
  const opts: DiagnosticsOptions = { ...DEFAULT_DIAGNOSTICS_OPTIONS, ...options };
  const diagnostics: Diagnostic[] = frames.length
    ? [
        ...detectEventVariants(frames),
        ...detectShapeDrift(frames),
        ...detectIdIssues(frames),
        ...detectGaps(frames, opts),
        ...detectMissingTerminal(frames, opts),
        ...detectMalformed(frames),
      ].sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity])
    : [];
  const counts: Record<Severity, number> = { error: 0, warning: 0, info: 0 };
  for (const d of diagnostics) counts[d.severity]++;
  const worst: Severity | null = counts.error
    ? 'error'
    : counts.warning
      ? 'warning'
      : counts.info
        ? 'info'
        : null;
  return { diagnostics, tokenStats: computeTokenStats(frames), counts, worst };
}

export * from './types';
export { detectEventVariants } from './event-variants';
export { detectShapeDrift } from './shape-drift';
export { detectGaps, detectIdIssues, detectMissingTerminal, formatMs } from './ordering';
export { detectMalformed } from './malformed';
export { computeTokenStats, isTokenFrame, tokenChars } from './token-stats';
