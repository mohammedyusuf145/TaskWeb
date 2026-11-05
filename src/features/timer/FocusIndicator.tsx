import { useT } from '@/lib/i18n';
import { formatClock, remainingMs, elapsedMs } from './engine';
import { useTimer } from './store';
import { useTimerNow } from './TimerRunner';

/** Remaining time next to the Focus nav item while a session runs (a dot when space is tight). */
export function FocusIndicator({ compact }: { compact?: boolean }) {
  const t = useT();
  const state = useTimer((s) => s.state);
  const now = useTimerNow(1000);
  if (state.status === 'idle') return null;
  const ms = remainingMs(state, now) ?? elapsedMs(state, now);
  const label = t('focus.runningIn', { time: formatClock(ms) });
  const paused = state.status === 'paused';
  if (compact)
    return (
      <span
        aria-label={label}
        className={`absolute -end-1 -top-0.5 size-2 rounded-full ${paused ? "bg-text-3" : "bg-accent"} ring-2 ring-[var(--frame)]`}
      />
    );
  return (
    <span aria-label={label} className={`ms-auto font-mono text-xs tabular ${paused ? 'text-text-3' : 'text-accent-text'}`} dir="ltr">
      {formatClock(ms)}
    </span>
  );
}
