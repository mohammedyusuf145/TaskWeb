import { Pause, Play, RotateCcw, SkipForward, Square } from 'lucide-react';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/cn';
import { Button, IconButton, ProgressRing } from '@/components/ui';
import { elapsedMs, formatClock, progress, remainingMs, wilt, type TimerState } from './engine';
import { Garden } from './Garden';
import { timer } from './store';
import type { TimerView } from './prefs';

interface Props {
  state: TimerState;
  now: number;
  view: TimerView;
  color: string;
  linkedTitle?: string | null;
  large?: boolean;
}

/** The visual, the time and the controls. Used on the Focus page and in fullscreen focus mode. */
export function FocusStage({ state, now, view, color, linkedTitle, large }: Props) {
  const t = useT();
  const open = state.mode === 'open';
  const rem = remainingMs(state, now);
  const time = formatClock(open ? elapsedMs(state, now) : (rem ?? 0));
  const p = progress(state, now);
  const isBreak = state.phase !== 'focus' && !open;
  const phaseLabel = open ? t('focus.phase.open') : t(`focus.phase.${state.phase}`);
  const gardenPhase = state.status === 'idle' && !isBreak ? 'idle' : isBreak ? 'break' : 'focus';
  const w = wilt(state, now);
  const total = state.config.sessionsBeforeLong;
  const doneInCycle = state.phase === 'focus' ? state.cycle : state.cycle;

  const clock = (
    <time
      dir="ltr"
      aria-live="off"
      className={cn(
        'block font-sans font-extralight tracking-tight text-text tabular',
        view === 'clock' ? (large ? 'text-[clamp(96px,22vw,220px)] leading-none' : 'text-[clamp(72px,14vw,160px)] leading-none') : large ? 'text-clock' : 'text-[64px] leading-none',
      )}
    >
      {time}
    </time>
  );

  return (
    <div className="relative flex w-full flex-col items-center">
      <div className="relative flex flex-col items-center gap-2">
        <p className={cn('text-sm font-medium', isBreak ? 'text-text-2' : 'text-accent-text')}>{phaseLabel}</p>
        {!open && (
          <div className="flex gap-1.5" role="img" aria-label={t('focus.cycle', { n: Math.min(doneInCycle + (state.phase === 'focus' ? 1 : 0), total), total })}>
            {Array.from({ length: total }, (_, i) => (
              <span key={i} className={cn('size-1.5 rounded-full', i < doneInCycle ? 'bg-accent' : 'bg-border-strong')} />
            ))}
          </div>
        )}
      </div>

      <div className={cn('relative my-6 flex items-center justify-center', large && 'my-10')}>
        {view === 'garden' && (
          <div className="flex flex-col items-center">
            <Garden growth={p} phase={gardenPhase} running={state.status === 'running'} wilt={w} flowerColor={color} size={large ? 320 : 240} />
            <div className="-mt-2">{clock}</div>
          </div>
        )}
        {view === 'ring' && (
          <ProgressRing value={open ? (elapsedMs(state, now) % 3_600_000) / 3_600_000 : p} size={large ? 360 : 280} stroke={large ? 6 : 5} color={isBreak ? 'var(--text-3)' : color} label={phaseLabel}>
            {clock}
          </ProgressRing>
        )}
        {(view === 'clock' || view === 'ambient') && <div className="py-10">{clock}</div>}
      </div>

      {w > 0.02 && state.phase === 'focus' && <p className="-mt-2 mb-4 max-w-xs text-center text-xs text-text-3">{t('focus.garden.away')}</p>}
      {isBreak && state.status !== 'idle' && <p className="-mt-2 mb-4 max-w-xs text-center text-sm text-text-2">{t('focus.breakHint')}</p>}
      {linkedTitle && (
        <p className="mb-4 max-w-sm truncate text-center text-sm text-text-2" dir="auto">
          {t('focus.linked', { title: `\u2068${linkedTitle}\u2069` })}
        </p>
      )}

      <Controls state={state} large={large} />
    </div>
  );
}

function Controls({ state, large }: { state: TimerState; large?: boolean }) {
  const t = useT();
  const open = state.mode === 'open';
  const isBreak = state.phase !== 'focus' && !open;
  const primaryLabel =
    state.status === 'running' ? t('focus.pause') : state.status === 'paused' ? t('focus.resume') : isBreak ? t('focus.startBreak') : open ? t('focus.start') : t('focus.startFocus');
  return (
    <div className="flex items-center gap-3">
      {state.status !== 'idle' ? (
        <IconButton label={open ? t('focus.stop') : t('focus.reset')} icon={open ? <Square size={18} /> : <RotateCcw size={18} />} onClick={() => timer.stop()} size="lg" />
      ) : (
        <span className="size-12" />
      )}
      <Button
        variant="primary"
        size="lg"
        onClick={() => timer.toggle()}
        iconStart={state.status === 'running' ? <Pause size={18} /> : <Play size={18} />}
        className={cn('min-w-44 rounded-full', large && 'h-14 min-w-52 text-lg')}
        aria-keyshortcuts="Space"
      >
        {primaryLabel}
      </Button>
      {!open ? (
        <IconButton label={t('focus.skip')} icon={<SkipForward size={18} />} onClick={() => timer.skip()} size="lg" />
      ) : (
        <span className="size-12" />
      )}
    </div>
  );
}

/** A slow, restrained wash of the subject colour that drifts as the session progresses (applied to the stage). */
export function ambientBackground(color: string, p: number, running: boolean): string {
  return `radial-gradient(70% 60% at ${20 + p * 60}% ${90 - p * 30}%, color-mix(in oklab, ${color} ${running ? 26 : 16}%, transparent), transparent 70%),
    radial-gradient(60% 50% at ${80 - p * 50}% 10%, color-mix(in oklab, var(--accent) 10%, transparent), transparent 70%)`;
}
