import { useVirtualizer } from '@tanstack/react-virtual';
import { memo, useCallback, useEffect, useMemo, useRef, type CSSProperties } from 'react';
import { selectVisibleFrames, useInspector } from '@/app/store';
import type { Frame } from '@/core/frame';
import { formatBytes, formatOffset, pluralize } from '@/utils/format';
import { Button } from '../ui/button';
import { EventChip } from '../ui/event-chip';
import { CloseIcon } from '../ui/icons';
import { TimelineFilters } from './timeline-filters';

const ROW_HEIGHT = 40;

export function Timeline() {
  const frames = useInspector((s) => s.frames);
  const replayCursor = useInspector((s) => s.replayCursor);
  const eventFilter = useInspector((s) => s.eventFilter);
  const search = useInspector((s) => s.search);
  const selected = useInspector((s) => s.selected);
  const select = useInspector((s) => s.select);
  const highlighted = useInspector((s) => s.highlighted);
  const highlightLabel = useInspector((s) => s.highlightLabel);
  const clearHighlight = useInspector((s) => s.clearHighlight);
  const followReplay = useInspector((s) => s.followReplay);
  const loading = useInspector((s) => s.loading);

  const visible = useMemo(
    () => selectVisibleFrames({ frames, replayCursor, eventFilter, search }),
    [frames, replayCursor, eventFilter, search],
  );
  const highlightSet = useMemo(() => new Set(highlighted), [highlighted]);
  const base = frames[0]?.receivedAt ?? 0;

  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: visible.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
  });

  const selectedPos = useMemo(
    () => (selected === null ? -1 : visible.findIndex((f) => f.index === selected)),
    [visible, selected],
  );

  useEffect(() => {
    if (selectedPos >= 0) virtualizer.scrollToIndex(selectedPos, { align: 'auto' });
  }, [selectedPos, virtualizer]);

  // While replaying, keep the newest revealed frame selected so the detail pane follows.
  const lastReplayCursor = useRef<number | null>(null);
  useEffect(() => {
    if (replayCursor === null || !followReplay) {
      lastReplayCursor.current = replayCursor;
      return;
    }
    if (replayCursor !== lastReplayCursor.current) {
      lastReplayCursor.current = replayCursor;
      const last = visible[visible.length - 1];
      if (last) select(last.index);
    }
  }, [replayCursor, followReplay, visible, select]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (visible.length === 0) return;
      let next = selectedPos;
      switch (e.key) {
        case 'ArrowDown':
          next = Math.min(visible.length - 1, selectedPos + 1);
          break;
        case 'ArrowUp':
          next = Math.max(0, selectedPos - 1);
          break;
        case 'Home':
          next = 0;
          break;
        case 'End':
          next = visible.length - 1;
          break;
        case 'PageDown':
          next = Math.min(visible.length - 1, selectedPos + 15);
          break;
        case 'PageUp':
          next = Math.max(0, selectedPos - 15);
          break;
        default:
          return;
      }
      e.preventDefault();
      const f = visible[next];
      if (f) select(f.index);
    },
    [visible, selectedPos, select],
  );

  const hiddenCount = (replayCursor ?? frames.length) - visible.length;

  return (
    <section aria-labelledby="timeline-heading" className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-col gap-2 border-b border-line px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <h2 id="timeline-heading" className="text-sm font-semibold">
            Timeline{' '}
            <span className="font-mono text-xs font-normal text-muted">
              {visible.length.toLocaleString()}
              {hiddenCount > 0 ? ` of ${(replayCursor ?? frames.length).toLocaleString()}` : ''}
            </span>
          </h2>
          {highlightLabel && (
            <Button
              size="sm"
              variant="ghost"
              onClick={clearHighlight}
              className="max-w-[60%] text-xs text-warning"
            >
              <span className="truncate">
                {pluralize(highlighted.length, 'frame')} · {highlightLabel}
              </span>
              <CloseIcon size={12} />
            </Button>
          )}
        </div>
        <TimelineFilters />
      </div>

      <div
        ref={parentRef}
        role="listbox"
        aria-label="Frames"
        aria-activedescendant={selected !== null ? `frame-${selected}` : undefined}
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="relative min-h-0 flex-1 overflow-auto font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
      >
        {visible.length === 0 ? (
          <EmptyTimeline loading={loading} total={frames.length} filtered={frames.length > 0} />
        ) : (
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
            {virtualizer.getVirtualItems().map((row) => {
              const frame = visible[row.index];
              if (!frame) return null;
              const prev = row.index > 0 ? visible[row.index - 1] : undefined;
              return (
                <FrameRow
                  key={frame.index}
                  frame={frame}
                  offset={frame.receivedAt - base}
                  gap={prev ? frame.receivedAt - prev.receivedAt : null}
                  selected={frame.index === selected}
                  highlighted={highlightSet.has(frame.index)}
                  onSelect={select}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: row.size,
                    transform: `translateY(${row.start}px)`,
                  }}
                />
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function EmptyTimeline({
  loading,
  total,
  filtered,
}: {
  loading: boolean;
  total: number;
  filtered: boolean;
}) {
  return (
    <div
      className="flex h-full min-h-40 flex-col items-center justify-center gap-1 p-6 text-center font-sans text-sm text-muted"
      role="status"
      aria-live="polite"
    >
      {loading ? (
        <>
          <span
            className="h-5 w-5 animate-spin rounded-full border-2 border-line border-t-accent"
            aria-hidden
          />
          Parsing stream…
        </>
      ) : total === 0 ? (
        <>
          <span className="text-fg">No frames yet</span>
          <span>Pick a sample, paste a stream, connect live or drop a HAR file above.</span>
        </>
      ) : filtered ? (
        <>
          <span className="text-fg">Nothing matches</span>
          <span>Adjust the event filter or search, or step the replay forward.</span>
        </>
      ) : null}
    </div>
  );
}

interface FrameRowProps {
  frame: Frame;
  offset: number;
  gap: number | null;
  selected: boolean;
  highlighted: boolean;
  onSelect: (index: number) => void;
  style: CSSProperties;
}

const FrameRow = memo(function FrameRow({
  frame,
  offset,
  gap,
  selected,
  highlighted,
  onSelect,
  style,
}: FrameRowProps) {
  const size = frame.raw.length;
  const problem =
    frame.incomplete === true ||
    (frame.unknownFields?.length ?? 0) > 0 ||
    (frame.invalidRetry?.length ?? 0) > 0;
  const preview = frame.dispatched
    ? frame.data
    : frame.comments?.length
      ? `: ${frame.comments.join(' · ')}`
      : '(no data)';
  return (
    <div
      id={`frame-${frame.index}`}
      role="option"
      aria-selected={selected}
      tabIndex={-1}
      onClick={() => onSelect(frame.index)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onSelect(frame.index);
      }}
      style={style}
      className={`flex cursor-pointer items-center gap-2 border-b border-line/60 px-3 ${
        selected ? 'bg-selection' : highlighted ? 'bg-highlight' : 'hover:bg-panel-2'
      } ${frame.dispatched ? '' : 'text-muted'}`}
      title={`#${frame.index} ${frame.event} — ${formatBytes(size)}`}
    >
      <span className="w-10 shrink-0 text-right text-muted tabular-nums">{frame.index}</span>
      <span
        className="w-20 shrink-0 text-right text-muted tabular-nums"
        title={gap !== null ? `+${Math.round(gap)} ms since previous` : undefined}
      >
        {formatOffset(offset)}
      </span>
      <EventChip
        name={frame.event}
        dispatched={frame.dispatched}
        className="w-32 shrink-0 sm:w-36"
      />
      <span
        className="hidden w-14 shrink-0 truncate text-muted sm:inline"
        title={frame.id !== undefined ? `id: ${frame.id}` : undefined}
      >
        {frame.id ?? ''}
      </span>
      <span
        className={`min-w-0 flex-1 truncate ${frame.dispatched ? 'text-fg' : 'text-muted italic'}`}
      >
        {preview}
      </span>
      {problem ? (
        <span aria-label="Frame has a structural problem" className="shrink-0 text-error">
          !
        </span>
      ) : null}
      <span className="hidden w-14 shrink-0 text-right text-muted tabular-nums md:inline">
        {formatBytes(size)}
      </span>
    </div>
  );
});
