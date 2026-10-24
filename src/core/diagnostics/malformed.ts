import type { Frame } from '../frame';
import { payloadOf } from '../payload';
import type { Diagnostic } from './types';

export function detectMalformed(frames: readonly Frame[]): Diagnostic[] {
  const out: Diagnostic[] = [];
  const broken: number[] = [];
  const noData: number[] = [];
  const heartbeats: number[] = [];
  const unknown = new Map<string, number[]>();
  const invalidRetry: number[] = [];
  const incomplete: number[] = [];

  for (const frame of frames) {
    if (frame.incomplete) incomplete.push(frame.index);
    if (frame.invalidRetry?.length) invalidRetry.push(frame.index);
    for (const field of frame.unknownFields ?? []) {
      const list = unknown.get(field);
      if (list) list.push(frame.index);
      else unknown.set(field, [frame.index]);
    }
    if (!frame.dispatched) {
      const onlyComments = frame.raw.split('\n').every((l) => l.startsWith(':'));
      if (onlyComments) heartbeats.push(frame.index);
      else noData.push(frame.index);
      continue;
    }
    if (payloadOf(frame).brokenJson) broken.push(frame.index);
  }

  if (broken.length) {
    out.push({
      id: 'broken-json',
      kind: 'broken-json',
      severity: 'error',
      title: `${broken.length} frame${broken.length === 1 ? '' : 's'} with unparseable JSON`,
      detail:
        'Data starts with `{` or `[` but does not parse. Usually a payload split across two `data:` blocks by a buggy writer, or a truncated frame.',
      frames: broken,
    });
  }
  if (noData.length) {
    out.push({
      id: 'no-data',
      kind: 'no-data',
      severity: 'warning',
      title: `${noData.length} block${noData.length === 1 ? '' : 's'} with fields but no data`,
      detail:
        'Per the spec a block without `data:` is never dispatched, so an `event:` or `id:` written there is silently lost by every browser EventSource.',
      frames: noData,
    });
  }
  for (const [field, idx] of unknown) {
    out.push({
      id: `unknown-field:${field}`,
      kind: 'unknown-field',
      severity: 'warning',
      title: `Unknown field \`${field}\` in ${idx.length} frame${idx.length === 1 ? '' : 's'}`,
      detail: `Only \`event\`, \`data\`, \`id\` and \`retry\` are defined. \`${field}\` is ignored by every compliant parser — if a consumer relies on it, it is reading the raw bytes.`,
      frames: idx,
    });
  }
  if (invalidRetry.length) {
    out.push({
      id: 'invalid-retry',
      kind: 'invalid-retry',
      severity: 'warning',
      title: `Non-numeric \`retry\` in ${invalidRetry.length} frame${invalidRetry.length === 1 ? '' : 's'}`,
      detail:
        '`retry:` must be ASCII digits (milliseconds). Anything else is ignored, so the reconnect delay stays at the default.',
      frames: invalidRetry,
    });
  }
  if (incomplete.length) {
    out.push({
      id: 'incomplete',
      kind: 'incomplete',
      severity: 'error',
      title: 'Stream ended mid-event',
      detail:
        'The final block had no terminating blank line. A spec-compliant client discards it, so whatever it carried was never delivered.',
      frames: incomplete,
    });
  }
  if (heartbeats.length) {
    out.push({
      id: 'heartbeat',
      kind: 'heartbeat',
      severity: 'info',
      title: `${heartbeats.length} comment-only keep-alive${heartbeats.length === 1 ? '' : 's'}`,
      detail:
        'Comment lines (`: …`) that keep the connection warm. Not delivered to the application.',
      frames: heartbeats,
    });
  }
  return out;
}
