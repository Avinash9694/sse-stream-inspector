import { useCallback, useEffect, useRef, useState } from 'react';
import { useInspector } from '@/app/store';
import { ReplayScheduler, type ReplayState } from '@/core/replay';

const IDLE: ReplayState = { status: 'idle', cursor: 0, position: 0, speed: 1, durationMs: 0 };

/** Owns one ReplayScheduler per loaded frame list and mirrors its cursor into the store. */
export function useReplay() {
  const frames = useInspector((s) => s.frames);
  const setReplayCursor = useInspector((s) => s.setReplayCursor);
  const ref = useRef<ReplayScheduler | null>(null);
  const speedRef = useRef(1);
  const [state, setState] = useState<ReplayState>(IDLE);
  const [position, setPosition] = useState(0);

  useEffect(() => {
    ref.current?.dispose();
    const scheduler = new ReplayScheduler({
      frames,
      speed: speedRef.current,
      onFrame: () => undefined,
      onState: (s) => {
        setState(s);
        setPosition(s.position);
        useInspector.getState().setReplayCursor(s.status === 'idle' ? null : s.cursor);
      },
    });
    ref.current = scheduler;
    setState(scheduler.getState());
    setPosition(0);
    return () => scheduler.dispose();
  }, [frames]);

  // Smooth scrubber while playing.
  useEffect(() => {
    if (state.status !== 'playing') return;
    let raf = 0;
    const tick = () => {
      const s = ref.current?.getState();
      if (s) setPosition(s.position);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [state.status]);

  const exit = useCallback(() => {
    ref.current?.reset();
    setReplayCursor(null);
  }, [setReplayCursor]);

  return {
    state,
    position,
    play: () => ref.current?.play(),
    pause: () => ref.current?.pause(),
    toggle: () => ref.current?.toggle(),
    step: () => ref.current?.step(),
    stepBack: () => ref.current?.stepBack(),
    seek: (ms: number) => ref.current?.seek(ms),
    setSpeed: (speed: number) => {
      speedRef.current = speed;
      ref.current?.setSpeed(speed);
    },
    exit,
  };
}
