import microdiff from 'microdiff';
import type { JsonValue } from './payload';

export interface JsonChange {
  type: 'CREATE' | 'REMOVE' | 'CHANGE';
  path: string;
  from?: JsonValue;
  to?: JsonValue;
}

/** Structural diff of two JSON values, with paths rendered like `choices[0].delta.content`. */
export function diffJson(from: JsonValue, to: JsonValue): JsonChange[] {
  const a = wrap(from);
  const b = wrap(to);
  return microdiff(a, b).map((d) => {
    const change: JsonChange = { type: d.type, path: renderPath(d.path.slice(1)) };
    if (d.type !== 'CREATE') change.from = d.oldValue as JsonValue;
    if (d.type !== 'REMOVE') change.to = d.value as JsonValue;
    return change;
  });
}

function wrap(v: JsonValue): Record<string, unknown> {
  return { root: v };
}

function renderPath(parts: (string | number)[]): string {
  if (parts.length === 0) return '$';
  return parts.reduce<string>((acc, p) => {
    if (typeof p === 'number') return `${acc}[${p}]`;
    return acc === '' ? p : `${acc}.${p}`;
  }, '');
}
