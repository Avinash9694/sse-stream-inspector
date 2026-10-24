export type Severity = 'error' | 'warning' | 'info';

export type DiagnosticKind =
  | 'event-variants'
  | 'shape-drift'
  | 'id-duplicate'
  | 'id-out-of-order'
  | 'gap'
  | 'missing-terminal'
  | 'broken-json'
  | 'no-data'
  | 'unknown-field'
  | 'invalid-retry'
  | 'incomplete'
  | 'heartbeat';

export interface Diagnostic {
  id: string;
  kind: DiagnosticKind;
  severity: Severity;
  title: string;
  detail: string;
  /** Frames involved, in stream order. */
  frames: number[];
  /** Kind-specific structured payload for richer rendering. */
  meta?: Record<string, unknown>;
}

export interface DiagnosticsOptions {
  /** Inter-frame gap above which a `gap` warning is raised. */
  gapThresholdMs: number;
  /** Event names or data literals that mark a healthy end of stream. */
  terminalEvents: readonly string[];
}

export const DEFAULT_DIAGNOSTICS_OPTIONS: DiagnosticsOptions = {
  gapThresholdMs: 5000,
  terminalEvents: ['done', 'complete', 'completed', '[DONE]', 'end', 'finish', 'finished'],
};

export interface TokenStats {
  frames: number;
  chars: number;
  durationMs: number;
  charsPerSec: number;
  framesPerSec: number;
  /** Event names that were counted as token deltas. */
  events: string[];
}

export interface DiagnosticsReport {
  diagnostics: Diagnostic[];
  tokenStats: TokenStats | null;
  counts: Record<Severity, number>;
  /** Highest severity present, or null when the stream is clean. */
  worst: Severity | null;
}
