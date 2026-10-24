import { useId } from 'react';

export interface TabItem<T extends string> {
  id: T;
  label: string;
  badge?: string | number;
}

interface TabsProps<T extends string> {
  items: readonly TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  label: string;
  size?: 'sm' | 'md';
}

export function Tabs<T extends string>({
  items,
  value,
  onChange,
  label,
  size = 'md',
}: TabsProps<T>) {
  const base = useId();
  const onKey = (e: React.KeyboardEvent, i: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const next = items[(i + (e.key === 'ArrowRight' ? 1 : items.length - 1)) % items.length];
    if (next) {
      onChange(next.id);
      document.getElementById(`${base}-${next.id}`)?.focus();
    }
  };
  return (
    <div
      role="tablist"
      aria-label={label}
      className="flex gap-1 border-b border-line overflow-x-auto"
    >
      {items.map((item, i) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            id={`${base}-${item.id}`}
            role="tab"
            type="button"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(item.id)}
            onKeyDown={(e) => onKey(e, i)}
            className={`relative -mb-px inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 ${size === 'sm' ? 'h-9 text-xs' : 'h-10 text-sm'} transition-colors ${
              active
                ? 'border-accent text-fg font-medium'
                : 'border-transparent text-muted hover:text-fg'
            }`}
          >
            {item.label}
            {item.badge !== undefined && (
              <span className="rounded-full bg-panel-2 px-1.5 py-0.5 text-[10px] font-mono text-muted">
                {item.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
