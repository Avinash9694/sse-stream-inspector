import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Frame } from '../frame';
import { ReplayScheduler, type ReplayState } from '../replay';

const frame = (index: number, receivedAt: number): Frame => ({
  index,
  event: 'e',
  data: String(index),
  receivedAt,
  byteOffset: 0,
  raw: '',
  dispatched: true,
});

const FRAMES = [frame(0, 1000), frame(1, 1100), frame(2, 1100), frame(3, 1600), frame(4, 2000)];

function make(speed = 1) {
  const emitted: number[] = [];
  const states: ReplayState[] = [];
  const scheduler = new ReplayScheduler({
    frames: FRAMES,
    speed,
    onFrame: (f) => emitted.push(f.index),
    onState: (s) => states.push(s),
    now: () => Date.now(),
  });
  return { scheduler, emitted, states };
}

describe('ReplayScheduler', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('emits frames at their original offsets', () => {
    const { scheduler, emitted } = make();
    scheduler.play();
    vi.advanceTimersByTime(0);
    expect(emitted).toEqual([0]);
    vi.advanceTimersByTime(99);
    expect(emitted).toEqual([0]);
    vi.advanceTimersByTime(1);
    expect(emitted).toEqual([0, 1, 2]);
    vi.advanceTimersByTime(900);
    expect(emitted).toEqual([0, 1, 2, 3, 4]);
    expect(scheduler.getState().status).toBe('done');
  });

  it('scales timing by speed', () => {
    const { scheduler, emitted } = make(4);
    scheduler.play();
    vi.advanceTimersByTime(250);
    expect(emitted).toEqual([0, 1, 2, 3, 4]);
  });

  it('pauses and resumes without losing position', () => {
    const { scheduler, emitted } = make();
    scheduler.play();
    vi.advanceTimersByTime(150);
    scheduler.pause();
    expect(emitted).toEqual([0, 1, 2]);
    expect(scheduler.getState().status).toBe('paused');
    vi.advanceTimersByTime(5000);
    expect(emitted).toEqual([0, 1, 2]);
    scheduler.play();
    vi.advanceTimersByTime(450);
    expect(emitted).toEqual([0, 1, 2, 3]);
  });

  it('steps one frame at a time and back', () => {
    const { scheduler, emitted } = make();
    scheduler.step();
    scheduler.step();
    expect(emitted).toEqual([0, 1]);
    expect(scheduler.getState()).toMatchObject({ cursor: 2, position: 100, status: 'paused' });
    scheduler.stepBack();
    expect(scheduler.getState().cursor).toBe(1);
  });

  it('seeks to a position and reports the matching cursor', () => {
    const { scheduler } = make();
    scheduler.seek(650);
    expect(scheduler.getState()).toMatchObject({ cursor: 4, position: 650, status: 'paused' });
    scheduler.seek(99_999);
    expect(scheduler.getState()).toMatchObject({ cursor: 5, status: 'done' });
    scheduler.seek(0);
    expect(scheduler.getState()).toMatchObject({ cursor: 0, status: 'idle' });
  });

  it('restarts from the beginning when played after done', () => {
    const { scheduler, emitted } = make(8);
    scheduler.play();
    vi.advanceTimersByTime(1000);
    expect(scheduler.getState().status).toBe('done');
    scheduler.play();
    vi.advanceTimersByTime(1000);
    expect(emitted).toEqual([0, 1, 2, 3, 4, 0, 1, 2, 3, 4]);
  });

  it('changing speed mid-play reschedules the pending frame', () => {
    const { scheduler, emitted } = make(1);
    scheduler.play();
    vi.advanceTimersByTime(100);
    expect(emitted).toEqual([0, 1, 2]);
    scheduler.setSpeed(8);
    vi.advanceTimersByTime(63);
    expect(emitted).toEqual([0, 1, 2, 3]);
  });

  it('reports a one-second duration for these frames and ignores play() on empty input', () => {
    const { scheduler } = make();
    expect(scheduler.getState().durationMs).toBe(1000);
    const empty = new ReplayScheduler({
      frames: [],
      onFrame: () => undefined,
      onState: () => undefined,
    });
    empty.play();
    expect(empty.getState().status).toBe('idle');
  });
});
