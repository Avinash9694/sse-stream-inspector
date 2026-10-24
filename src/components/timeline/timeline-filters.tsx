import { useMemo } from 'react';
import { useInspector } from '@/app/store';
import { EventChip } from '../ui/event-chip';

export function TimelineFilters() {
  const frames = useInspector((s) => s.frames);
  const eventFilter = useInspector((s) => s.eventFilter);
  const toggleEvent = useInspector((s) => s.toggleEvent);
  const setEventFilter = useInspector((s) => s.setEventFilter);
  const search = useInspector((s) => s.search);
  const setSearch = useInspector((s) => s.setSearch);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const f of frames) map.set(f.event, (map.get(f.event) ?? 0) + 1);
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [frames]);

  if (frames.length === 0) return null;
  const active = eventFilter ? new Set(eventFilter) : null;

  return (
    <div className="flex flex-col gap-2">
      <label className="flex items-center gap-2 text-xs text-muted">
        <span className="sr-only">Search frames</span>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search data, event or id…"
          className="h-9 w-full rounded-lg border border-line bg-bg px-2 font-mono text-xs text-fg placeholder:text-muted/70"
        />
      </label>
      <div
        className="flex flex-wrap items-center gap-1"
        role="group"
        aria-label="Filter by event name"
      >
        {counts.map(([name, n]) => {
          const on = active ? active.has(name) : true;
          return (
            <button
              key={name}
              type="button"
              aria-pressed={on}
              onClick={() => toggleEvent(name)}
              className={`inline-flex min-h-7 items-center gap-1 rounded-md transition-opacity ${on ? '' : 'opacity-40 grayscale'}`}
              title={`${on ? 'Hide' : 'Show'} ${name || 'comment'} (${n})`}
            >
              <EventChip name={name} dispatched={name !== ''} />
              <span className="font-mono text-[10px] text-muted">{n}</span>
            </button>
          );
        })}
        {active && (
          <button
            type="button"
            onClick={() => setEventFilter(null)}
            className="min-h-7 px-1 text-[11px] text-accent hover:underline"
          >
            Show all
          </button>
        )}
      </div>
    </div>
  );
}
