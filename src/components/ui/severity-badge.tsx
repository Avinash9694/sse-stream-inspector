import type { Severity } from '@/core/diagnostics';
import { severityClass } from '@/utils/severity';

export function SeverityDot({
  severity,
  className = '',
}: {
  severity: Severity;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={`inline-block h-2 w-2 rounded-full bg-current ${severityClass(severity)} ${className}`}
    />
  );
}
