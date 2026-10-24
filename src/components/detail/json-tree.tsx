import { memo, useState } from 'react';
import type { JsonValue } from '@/core/payload';

interface JsonTreeProps {
  value: JsonValue;
  /** Depth at which nodes start collapsed. */
  collapseAt?: number;
}

export function JsonTree({ value, collapseAt = 2 }: JsonTreeProps) {
  return (
    <div className="font-mono text-xs leading-5">
      <Node value={value} depth={0} collapseAt={collapseAt} />
    </div>
  );
}

const Node = memo(function Node({
  value,
  depth,
  collapseAt,
  name,
}: {
  value: JsonValue;
  depth: number;
  collapseAt: number;
  name?: string;
}) {
  const isArray = Array.isArray(value);
  const isObject = !isArray && value !== null && typeof value === 'object';
  const [open, setOpen] = useState(depth < collapseAt);

  if (!isArray && !isObject) {
    return (
      <div className="flex gap-1 pl-4" style={{ paddingLeft: depth * 14 }}>
        {name !== undefined && <Key name={name} />}
        <Primitive value={value} />
      </div>
    );
  }

  const entries: [string, JsonValue][] = isArray
    ? value.map((v, i) => [String(i), v])
    : Object.entries(value as Record<string, JsonValue>);
  const open_ = isArray ? '[' : '{';
  const close = isArray ? ']' : '}';

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-1 rounded text-left hover:bg-panel-2"
        style={{ paddingLeft: depth * 14 }}
      >
        <span
          aria-hidden
          className={`inline-block w-3 text-muted transition-transform ${open ? 'rotate-90' : ''}`}
        >
          ▸
        </span>
        {name !== undefined && <Key name={name} />}
        <span className="text-muted">
          {open_}
          {!open && (
            <span className="px-1 text-muted/80">
              {entries.length} {isArray ? 'items' : 'keys'}
            </span>
          )}
          {!open && close}
        </span>
      </button>
      {open && (
        <>
          {entries.map(([k, v]) => (
            <Node key={k} name={k} value={v} depth={depth + 1} collapseAt={collapseAt} />
          ))}
          <div className="text-muted" style={{ paddingLeft: depth * 14 + 16 }}>
            {close}
          </div>
        </>
      )}
    </div>
  );
});

function Key({ name }: { name: string }) {
  return <span className="text-accent">{name}:</span>;
}

function Primitive({ value }: { value: JsonValue }) {
  if (value === null) return <span className="text-muted italic">null</span>;
  if (typeof value === 'string') return <span className="break-all text-fg">"{value}"</span>;
  if (typeof value === 'number') return <span className="text-info">{String(value)}</span>;
  if (typeof value === 'boolean') return <span className="text-warning">{String(value)}</span>;
  return <span>{JSON.stringify(value)}</span>;
}
