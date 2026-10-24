export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

/** Stream-relative offset, e.g. `+1.240s`, `+12ms`. */
export function formatOffset(ms: number): string {
  if (!Number.isFinite(ms)) return '—';
  if (Math.abs(ms) < 1000) return `+${Math.round(ms)}ms`;
  if (Math.abs(ms) < 60_000) return `+${(ms / 1000).toFixed(3)}s`;
  const m = Math.floor(ms / 60_000);
  const s = ((ms % 60_000) / 1000).toFixed(1);
  return `+${m}m${s}s`;
}

export function formatClock(ms: number): string {
  if (!Number.isFinite(ms)) return '—';
  if (ms < 1e12) return `${(ms / 1000).toFixed(3)}s`;
  const d = new Date(ms);
  return `${d.toLocaleTimeString([], { hour12: false })}.${String(d.getMilliseconds()).padStart(3, '0')}`;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const totalSec = ms / 1000;
  if (totalSec < 60) return `${totalSec.toFixed(totalSec < 10 ? 2 : 1)}s`;
  const m = Math.floor(totalSec / 60);
  const s = Math.floor(totalSec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export const CHIP_COUNT = 10;

/** Stable colour slot per event name so a chip keeps its colour across loads. */
export function chipSlot(name: string): number {
  let h = 2166136261;
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % CHIP_COUNT;
}

export function pluralize(n: number, word: string): string {
  return `${n.toLocaleString()} ${word}${n === 1 ? '' : 's'}`;
}
