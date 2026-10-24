import type { Severity } from '@/core/diagnostics';

const TONE: Record<Severity, string> = {
  error: 'text-error',
  warning: 'text-warning',
  info: 'text-info',
};

export function severityLabel(severity: Severity): string {
  return severity === 'error' ? 'Error' : severity === 'warning' ? 'Warning' : 'Info';
}

export function severityClass(severity: Severity): string {
  return TONE[severity];
}
