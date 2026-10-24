import { useEffect } from 'react';
import { useInspector } from '@/app/store';
import { REPLAY_SPEEDS } from '@/core/replay';
import { hasTimingAnnotations } from '@/core/timing';
import { formatDuration } from '@/utils/format';
import { Button } from '../ui/button';
import { PauseIcon, PlayIcon, StepBackIcon, StepForwardIcon, StopIcon } from '../ui/icons';
import { useReplay } from './use-replay';

export function ReplayBar() {
  const frames = useInspector((s) => s.frames);
  const source = useInspector((s) => s.source);
  const followReplay = useInspector((s) => s.followReplay);
  const setFollowReplay = useInspector((s) => s.setFollowReplay);
  const replay = useReplay();
  const { state, position } = replay;
  const disabled = frames.length === 0;
  const synthetic =
    source?.kind !== 'live' && source?.kind !== 'session' && !hasTimingAnnotations(frames);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === 'INPUT' ||
          t.tagName === 'TEXTAREA' ||
          t.tagName === 'SELECT' ||
          t.isContentEditable)
      )
        return;
      if (e.key === ' ' && !disabled) {
        e.preventDefault();
        replay.toggle();
      } else if (e.key === '.' && !disabled) {
        replay.step();
      } else if (e.key === ',' && !disabled) {
        replay.stepBack();
      } else if (e.key === 'd') {
        const s = useInspector.getState();
        s.setDrawerOpen(!s.drawerOpen);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [replay, disabled]);

  const playing = state.status === 'playing';
  const inReplay = state.status !== 'idle';

  return (
    <section
      aria-label="Replay controls"
      className="flex flex-wrap items-center gap-2 border-t border-line bg-panel px-3 py-2 sm:px-4"
    >
      <div className="flex items-center gap-1">
        <Button
          size="icon"
          variant="ghost"
          onClick={replay.stepBack}
          disabled={disabled || state.cursor === 0}
          aria-label="Step back one frame (,)"
        >
          <StepBackIcon />
        </Button>
        <Button
          size="icon"
          variant={playing ? 'outline' : 'primary'}
          onClick={replay.toggle}
          disabled={disabled}
          aria-label={playing ? 'Pause replay (Space)' : 'Play replay (Space)'}
          aria-pressed={playing}
        >
          {playing ? <PauseIcon /> : <PlayIcon />}
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={replay.step}
          disabled={disabled || state.status === 'done'}
          aria-label="Step forward one frame (.)"
        >
          <StepForwardIcon />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={replay.exit}
          disabled={disabled || !inReplay}
          aria-label="Exit replay and show all frames"
        >
          <StopIcon />
        </Button>
      </div>

      <label className="flex min-w-[160px] flex-1 items-center gap-2 text-xs text-muted">
        <span className="sr-only">Replay position</span>
        <span className="w-14 shrink-0 text-right font-mono tabular-nums text-fg">
          {formatDuration(position)}
        </span>
        <input
          type="range"
          min={0}
          max={Math.max(1, state.durationMs)}
          step={1}
          value={Math.min(position, state.durationMs)}
          onChange={(e) => replay.seek(Number(e.target.value))}
          disabled={disabled}
          className="h-10 w-full accent-accent"
          aria-valuetext={`${formatDuration(position)} of ${formatDuration(state.durationMs)}, frame ${state.cursor} of ${frames.length}`}
        />
        <span className="w-14 shrink-0 font-mono tabular-nums">
          {formatDuration(state.durationMs)}
        </span>
      </label>

      <div className="flex items-center gap-2 text-xs">
        <span className="font-mono tabular-nums text-muted" aria-live="polite">
          {inReplay
            ? `${state.cursor.toLocaleString()} / ${frames.length.toLocaleString()}`
            : `${frames.length.toLocaleString()} frames`}
        </span>
        <label className="flex items-center gap-1 text-muted">
          <span className="sr-only">Speed</span>
          <select
            value={state.speed}
            onChange={(e) => replay.setSpeed(Number(e.target.value))}
            disabled={disabled}
            className="h-9 rounded-lg border border-line bg-panel px-1.5 font-mono text-xs text-fg"
          >
            {REPLAY_SPEEDS.map((s) => (
              <option key={s} value={s}>
                {s}×
              </option>
            ))}
          </select>
        </label>
        <label className="hidden items-center gap-1.5 text-muted sm:flex">
          <input
            type="checkbox"
            checked={followReplay}
            onChange={(e) => setFollowReplay(e.target.checked)}
            className="accent-accent"
          />
          Follow
        </label>
      </div>
      {synthetic && !disabled && (
        <p className="basis-full text-[11px] text-muted">
          No timing in this source — frames are spaced 40 ms apart. Add{' '}
          <code className="font-mono">: t=&lt;ms&gt;</code> comments to replay real pacing.
        </p>
      )}
    </section>
  );
}
