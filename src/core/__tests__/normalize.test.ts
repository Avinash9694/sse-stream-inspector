import { describe, expect, it } from 'vitest';
import { isTerminalMarker, normalizeEventName } from '../normalize';

describe('normalizeEventName', () => {
  it('collapses underscore vs hyphen vs case', () => {
    const key = normalizeEventName('thinking_state');
    expect(normalizeEventName('thinking-state')).toBe(key);
    expect(normalizeEventName('Thinking_State')).toBe(key);
    expect(normalizeEventName('thinkingState')).toBe(key);
  });
  it('strips a trailing plural s but not a double s', () => {
    expect(normalizeEventName('tokens')).toBe(normalizeEventName('token'));
    expect(normalizeEventName('progress')).toBe('progress');
  });
  it('strips surrounding punctuation so [DONE] matches done', () => {
    expect(normalizeEventName('[DONE]')).toBe('done');
  });
  it('keeps distinct names distinct', () => {
    expect(normalizeEventName('component_start')).not.toBe(normalizeEventName('component_delta'));
  });
});

describe('isTerminalMarker', () => {
  it('matches event names and data literals under normalisation', () => {
    const terminals = ['done', '[DONE]', 'complete'];
    expect(isTerminalMarker('DONE', terminals)).toBe(true);
    expect(isTerminalMarker('[DONE]', terminals)).toBe(true);
    expect(isTerminalMarker('completed', terminals)).toBe(false);
    expect(isTerminalMarker('component_delta', terminals)).toBe(false);
  });
});
