import type { Frame } from '../frame';
import { diffShapes, shapeOf, type ShapeDiff } from '../payload';
import type { Diagnostic } from './types';

const OPTIONAL_TYPES = new Set(['null', 'empty', '{}']);

/** A type change that is not merely an optional field being present or absent. */
function isHardChange(c: ShapeDiff['changed'][number]): boolean {
  return !(OPTIONAL_TYPES.has(c.from) || OPTIONAL_TYPES.has(c.to));
}

/**
 * Same event name, more than one JSON shape across the stream. Optional
 * fields appearing and disappearing (or toggling with null) is normal for most
 * protocols and is reported as info; a leaf changing primitive type is a warning.
 */
export function detectShapeDrift(frames: readonly Frame[]): Diagnostic[] {
  const byEvent = new Map<string, Map<string, { paths: string[]; frames: number[] }>>();
  for (const frame of frames) {
    if (!frame.dispatched) continue;
    const paths = shapeOf(frame);
    if (!paths) continue;
    const sig = paths.join('\n');
    let shapes = byEvent.get(frame.event);
    if (!shapes) {
      shapes = new Map();
      byEvent.set(frame.event, shapes);
    }
    const entry = shapes.get(sig);
    if (entry) entry.frames.push(frame.index);
    else shapes.set(sig, { paths, frames: [frame.index] });
  }

  const out: Diagnostic[] = [];
  for (const [event, shapes] of byEvent) {
    if (shapes.size < 2) continue;
    const ranked = [...shapes.values()].sort((a, b) => b.frames.length - a.frames.length);
    const [dominant, ...others] = ranked;
    if (!dominant) continue;
    let hard = false;
    const summary = others
      .map((o) => {
        const d = diffShapes(dominant.paths, o.paths);
        if (d.changed.some(isHardChange)) hard = true;
        const bits: string[] = [];
        if (d.added.length) bits.push(`+${d.added.join(', +')}`);
        if (d.removed.length) bits.push(`-${d.removed.join(', -')}`);
        if (d.changed.length)
          bits.push(d.changed.map((c) => `${c.path}: ${c.from}→${c.to}`).join(', '));
        return `${o.frames.length} frame${o.frames.length === 1 ? '' : 's'}: ${bits.join('; ') || 'reordered'}`;
      })
      .join(' · ');
    out.push({
      id: `shape-drift:${event}`,
      kind: 'shape-drift',
      severity: hard ? 'warning' : 'info',
      title: hard
        ? `\`${event}\` changes a field's type across frames`
        : `\`${event}\` has ${shapes.size} payload shapes (optional fields)`,
      detail: `Dominant shape appears in ${dominant.frames.length} frame${dominant.frames.length === 1 ? '' : 's'}. Deviations vs dominant — ${summary}.`,
      frames: ranked.flatMap((r) => r.frames).sort((a, b) => a - b),
      meta: {
        event,
        shapeCount: shapes.size,
        hardChange: hard,
        dominantFrame: dominant.frames[0],
        deviantFrames: others.map((o) => o.frames[0]),
      },
    });
  }
  return out;
}
