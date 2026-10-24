import type { Frame } from './frame';

export type ReplayStatus = 'idle' | 'playing' | 'paused' | 'done';

export interface ReplayState {
  status: ReplayStatus;
  /** Number of frames emitted so far; the next frame to emit is `frames[cursor]`. */
  cursor: number;
  /** Stream-relative position in ms (0 = first frame). */
  position: number;
  speed: number;
  durationMs: number;
}

export interface ReplayOptions {
  frames: readonly Frame[];
  onFrame: (frame: Frame, cursor: number) => void;
  onState: (state: ReplayState) => void;
  now?: () => number;
  setTimeout?: (fn: () => void, ms: number) => unknown;
  clearTimeout?: (handle: unknown) => void;
  speed?: number;
}

export const REPLAY_SPEEDS = [0.5, 1, 2, 4, 8] as const;

/**
 * Re-emits frames with their original inter-arrival timing scaled by `speed`.
 * Timer functions are injectable so the scheduler is testable with fake clocks.
 */
export class ReplayScheduler {
  private readonly frames: readonly Frame[];
  private readonly onFrame: ReplayOptions['onFrame'];
  private readonly onState: ReplayOptions['onState'];
  private readonly now: () => number;
  private readonly setTimer: NonNullable<ReplayOptions['setTimeout']>;
  private readonly clearTimer: NonNullable<ReplayOptions['clearTimeout']>;
  private readonly base: number;
  private handle: unknown = null;
  private state: ReplayState;
  /** Wall-clock instant at which `position` was last computed. */
  private anchorWall = 0;
  private anchorPosition = 0;

  constructor(options: ReplayOptions) {
    this.frames = options.frames;
    this.onFrame = options.onFrame;
    this.onState = options.onState;
    this.now = options.now ?? (() => performance.now());
    this.setTimer = options.setTimeout ?? ((fn, ms) => setTimeout(fn, ms));
    this.clearTimer =
      options.clearTimeout ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));
    this.base = this.frames[0]?.receivedAt ?? 0;
    const last = this.frames[this.frames.length - 1];
    this.state = {
      status: 'idle',
      cursor: 0,
      position: 0,
      speed: options.speed ?? 1,
      durationMs: last ? last.receivedAt - this.base : 0,
    };
  }

  getState(): ReplayState {
    return { ...this.state, position: this.currentPosition() };
  }

  play(): void {
    if (this.frames.length === 0) return;
    if (this.state.status === 'done') this.seek(0);
    this.anchorWall = this.now();
    this.anchorPosition = this.state.position;
    this.setStatus('playing');
    this.schedule();
  }

  pause(): void {
    if (this.state.status !== 'playing') return;
    this.state.position = this.currentPosition();
    this.cancel();
    this.setStatus('paused');
  }

  toggle(): void {
    if (this.state.status === 'playing') this.pause();
    else this.play();
  }

  /** Emit exactly one frame, pausing if playing. */
  step(): void {
    if (this.state.status === 'playing') this.pause();
    const frame = this.frames[this.state.cursor];
    if (!frame) return;
    this.emit(frame);
    this.state.position = frame.receivedAt - this.base;
    this.setStatus(this.state.cursor >= this.frames.length ? 'done' : 'paused');
  }

  stepBack(): void {
    if (this.state.status === 'playing') this.pause();
    if (this.state.cursor === 0) return;
    this.seekToCursor(this.state.cursor - 1);
  }

  setSpeed(speed: number): void {
    if (this.state.status === 'playing') {
      this.state.position = this.currentPosition();
      this.anchorWall = this.now();
      this.anchorPosition = this.state.position;
      this.cancel();
      this.state.speed = speed;
      this.schedule();
    } else {
      this.state.speed = speed;
    }
    this.publish();
  }

  /** Jump to a stream-relative position; frames up to it count as emitted. */
  seek(positionMs: number): void {
    const wasPlaying = this.state.status === 'playing';
    this.cancel();
    const clamped = Math.max(0, Math.min(positionMs, this.state.durationMs));
    let cursor = 0;
    if (clamped >= this.state.durationMs) cursor = this.frames.length;
    else
      while (
        cursor < this.frames.length &&
        (this.frames[cursor]?.receivedAt ?? Infinity) - this.base < clamped
      )
        cursor++;
    this.state.cursor = cursor;
    this.state.position = clamped;
    if (wasPlaying) {
      this.anchorWall = this.now();
      this.anchorPosition = clamped;
      this.setStatus(cursor >= this.frames.length ? 'done' : 'playing');
      if (this.state.status === 'playing') this.schedule();
    } else {
      this.setStatus(cursor >= this.frames.length ? 'done' : cursor === 0 ? 'idle' : 'paused');
    }
  }

  seekToCursor(cursor: number): void {
    const target = Math.max(0, Math.min(cursor, this.frames.length));
    const wasPlaying = this.state.status === 'playing';
    this.cancel();
    this.state.cursor = target;
    this.state.position =
      target === 0 ? 0 : (this.frames[target - 1]?.receivedAt ?? this.base) - this.base;
    if (wasPlaying && target < this.frames.length) {
      this.anchorWall = this.now();
      this.anchorPosition = this.state.position;
      this.setStatus('playing');
      this.schedule();
    } else {
      this.setStatus(target >= this.frames.length ? 'done' : target === 0 ? 'idle' : 'paused');
    }
  }

  reset(): void {
    this.cancel();
    this.state.cursor = 0;
    this.state.position = 0;
    this.setStatus('idle');
  }

  dispose(): void {
    this.cancel();
  }

  private currentPosition(): number {
    if (this.state.status !== 'playing') return this.state.position;
    const elapsed = (this.now() - this.anchorWall) * this.state.speed;
    return Math.min(this.anchorPosition + elapsed, this.state.durationMs);
  }

  private schedule(): void {
    const next = this.frames[this.state.cursor];
    if (!next) {
      this.state.position = this.state.durationMs;
      this.setStatus('done');
      return;
    }
    const target = next.receivedAt - this.base;
    const delay = Math.max(0, (target - this.currentPosition()) / this.state.speed);
    this.handle = this.setTimer(() => {
      this.handle = null;
      // Emit every frame whose time has come, so bursts stay bursts.
      const pos = this.currentPosition();
      while (this.state.cursor < this.frames.length) {
        const f = this.frames[this.state.cursor];
        if (!f || f.receivedAt - this.base > pos + 0.0001) break;
        this.emit(f);
      }
      this.publish();
      this.schedule();
    }, delay);
  }

  private emit(frame: Frame): void {
    this.state.cursor++;
    this.onFrame(frame, this.state.cursor);
  }

  private cancel(): void {
    if (this.handle !== null) {
      this.clearTimer(this.handle);
      this.handle = null;
    }
  }

  private setStatus(status: ReplayStatus): void {
    this.state.status = status;
    this.publish();
  }

  private publish(): void {
    this.onState(this.getState());
  }
}
