/**
 * Collapses the spellings a gateway might use for one logical event:
 * case, `_` vs `-`, surrounding punctuation (`[DONE]`), and a trailing `s`.
 * `thinking_state`, `thinking-state` and `ThinkingState` all map to one key.
 */
export function normalizeEventName(name: string): string {
  let key = name
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (key.length > 3 && key.endsWith('s') && !key.endsWith('ss')) key = key.slice(0, -1);
  return key;
}

export function isTerminalMarker(value: string, terminals: readonly string[]): boolean {
  const key = normalizeEventName(value);
  return terminals.some((t) => normalizeEventName(t) === key);
}
