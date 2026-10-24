import type { CSSProperties } from 'react';
import { normalizeEventName } from '@/core/normalize';
import { chipSlot } from '@/utils/format';

interface EventChipProps {
  name: string;
  dispatched?: boolean;
  className?: string;
}

/**
 * Colour-coded event name. The slot hashes the NORMALISED name, so spelling
 * variants of one event share a colour and differ only in their text.
 */
export function EventChip({ name, dispatched = true, className = '' }: EventChipProps) {
  const label = name || (dispatched ? 'message' : 'comment');
  const style = { '--chip': `var(--chip-${chipSlot(normalizeEventName(label))})` } as CSSProperties;
  return (
    <span
      style={style}
      className={`chip-color inline-flex max-w-full items-center truncate rounded-md border px-1.5 py-0.5 font-mono text-[11px] leading-4 ${
        dispatched ? '' : 'opacity-60 italic'
      } ${className}`}
      title={label}
    >
      {label}
    </span>
  );
}
