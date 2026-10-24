export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export type PayloadKind = 'json' | 'text' | 'empty';

export interface ParsedPayload {
  kind: PayloadKind;
  json?: JsonValue;
  /** True when the data looked like JSON (starts with `{` or `[`) but failed to parse. */
  brokenJson?: boolean;
  error?: string;
}

const payloadCache = new WeakMap<object, ParsedPayload>();

export function parsePayload(data: string): ParsedPayload {
  if (data.length === 0) return { kind: 'empty' };
  const trimmed = data.trim();
  // `[DONE]`-style sentinels are text, not failed JSON.
  if (/^\[[A-Za-z_-]+\]$/.test(trimmed)) return { kind: 'text' };
  const first = trimmed.charAt(0);
  const looksJson =
    first === '{' ||
    first === '[' ||
    first === '"' ||
    /^-?\d/.test(first) ||
    /^(true|false|null)$/.test(trimmed);
  if (!looksJson) return { kind: 'text' };
  try {
    return { kind: 'json', json: JSON.parse(trimmed) as JsonValue };
  } catch (err) {
    const brokenJson = first === '{' || first === '[';
    return {
      kind: 'text',
      ...(brokenJson ? { brokenJson: true } : {}),
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Memoised per frame object so the UI and diagnostics parse each payload once. */
export function payloadOf(frame: { data: string } & object): ParsedPayload {
  const hit = payloadCache.get(frame);
  if (hit) return hit;
  const parsed = parsePayload(frame.data);
  payloadCache.set(frame, parsed);
  return parsed;
}

type Primitive = 'string' | 'number' | 'boolean' | 'null';

/**
 * Flat structural description: one `path: type` line per leaf, sorted.
 * Arrays contribute `path[]` with the union of their element types so two
 * payloads can be compared without caring about array length or key order.
 */
export function shapePaths(value: JsonValue): string[] {
  const leaves = new Map<string, Set<string>>();
  walk(value, '$', leaves);
  return [...leaves.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([path, types]) => `${path}: ${[...types].sort().join('|')}`);
}

function walk(value: JsonValue, path: string, leaves: Map<string, Set<string>>): void {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      add(leaves, `${path}[]`, 'empty');
      return;
    }
    for (const item of value) walk(item, `${path}[]`, leaves);
    return;
  }
  if (value !== null && typeof value === 'object') {
    const keys = Object.keys(value);
    if (keys.length === 0) {
      add(leaves, path, '{}');
      return;
    }
    for (const key of keys) {
      const child = value[key];
      if (child !== undefined) walk(child, `${path}.${escapeKey(key)}`, leaves);
    }
    return;
  }
  add(leaves, path, primitiveOf(value));
}

function add(leaves: Map<string, Set<string>>, path: string, type: string): void {
  let set = leaves.get(path);
  if (!set) {
    set = new Set();
    leaves.set(path, set);
  }
  set.add(type);
}

function primitiveOf(v: string | number | boolean | null): Primitive {
  if (v === null) return 'null';
  return typeof v as Primitive;
}

function escapeKey(key: string): string {
  return /^[A-Za-z_$][\w$]*$/.test(key) ? key : JSON.stringify(key);
}

export function shapeSignature(value: JsonValue): string {
  return shapePaths(value).join('\n');
}

export interface ShapeDiff {
  added: string[];
  removed: string[];
  changed: { path: string; from: string; to: string }[];
}

export function diffShapes(fromPaths: string[], toPaths: string[]): ShapeDiff {
  const from = indexPaths(fromPaths);
  const to = indexPaths(toPaths);
  const diff: ShapeDiff = { added: [], removed: [], changed: [] };
  for (const [path, type] of to) {
    const prev = from.get(path);
    if (prev === undefined) diff.added.push(path);
    else if (prev !== type) diff.changed.push({ path, from: prev, to: type });
  }
  for (const path of from.keys()) if (!to.has(path)) diff.removed.push(path);
  return diff;
}

function indexPaths(paths: string[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const line of paths) {
    const sep = line.lastIndexOf(': ');
    if (sep === -1) continue;
    map.set(line.slice(0, sep), line.slice(sep + 2));
  }
  return map;
}

const shapeCache = new WeakMap<object, string[] | null>();

/** Shape paths for a frame's payload, or null when it is not JSON. Memoised per frame. */
export function shapeOf(frame: { data: string } & object): string[] | null {
  const hit = shapeCache.get(frame);
  if (hit !== undefined) return hit;
  const parsed = payloadOf(frame);
  const paths =
    parsed.kind === 'json' && parsed.json !== undefined ? shapePaths(parsed.json) : null;
  shapeCache.set(frame, paths);
  return paths;
}
