import type { Frame } from '../frame';
import { normalizeEventName } from '../normalize';
import { shapeOf } from '../payload';
import type { Diagnostic } from './types';

interface Variant {
  name: string;
  count: number;
  frames: number[];
  shapes: Set<string>;
}

/**
 * Event names that collapse to one key under normalisation but are spelled
 * differently in the stream. A consumer matching a single literal silently
 * drops the others, so this is an error when their payload shapes also differ.
 */
export function detectEventVariants(frames: readonly Frame[]): Diagnostic[] {
  const groups = new Map<string, Map<string, Variant>>();
  for (const frame of frames) {
    if (!frame.dispatched) continue;
    const key = normalizeEventName(frame.event);
    let group = groups.get(key);
    if (!group) {
      group = new Map();
      groups.set(key, group);
    }
    let variant = group.get(frame.event);
    if (!variant) {
      variant = { name: frame.event, count: 0, frames: [], shapes: new Set() };
      group.set(frame.event, variant);
    }
    variant.count++;
    variant.frames.push(frame.index);
    const shape = shapeOf(frame);
    variant.shapes.add(shape ? shape.join('\n') : '<non-json>');
  }

  const out: Diagnostic[] = [];
  for (const [key, group] of groups) {
    if (group.size < 2) continue;
    const variants = [...group.values()].sort((a, b) => b.count - a.count);
    const allShapes = new Set<string>();
    for (const v of variants) for (const s of v.shapes) allShapes.add(s);
    const shapesDiffer = allShapes.size > 1;
    const names = variants.map((v) => `\`${v.name}\` ×${v.count}`).join(', ');
    out.push({
      id: `event-variants:${key}`,
      kind: 'event-variants',
      severity: shapesDiffer ? 'error' : 'warning',
      title: `Event spelled ${variants.length} ways: ${variants.map((v) => v.name).join(' / ')}`,
      detail: shapesDiffer
        ? `${names} normalise to the same event but carry different payload shapes. A handler matching one literal drops the others and renders a partial stream with no error.`
        : `${names} normalise to the same event with identical payload shapes. Pick one spelling.`,
      frames: variants.flatMap((v) => v.frames).sort((a, b) => a - b),
      meta: {
        normalized: key,
        variants: variants.map((v) => ({ name: v.name, count: v.count, shapes: v.shapes.size })),
        shapesDiffer,
      },
    });
  }
  return out;
}
