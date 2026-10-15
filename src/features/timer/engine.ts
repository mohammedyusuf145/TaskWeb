/**
 * Focus timer engine — pure functions over a serialisable state.
 *
 * Accuracy: the timer never counts ticks. A running phase stores the wall-clock time it (re)started
 * plus the time already elapsed before that, so `elapsed = before + (now - startedAt)`. Sleeping tabs,
 * refreshes and switching devices can't drift it. `advance()` replays any phase ends that happened
 * while nobody was looking, using the exact end timestamps.
 */

export type Phase = 'focus' | 'short_break' | 'long_break';
export type Mode = 'pomodoro' | 'open';
export type Status = 'idle' | 'running' | 'paused';

export interface TimerConfig {
  focusMin: number;
  shortMin: number;
  longMin: number;
  sessionsBeforeLong: number;
  autoStartBreaks: boolean;
  autoStartFocus: boolean;
}

export const PRESETS: Record<string, TimerConfig> = {
  classic: { focusMin: 25, shortMin: 5, longMin: 15, sessionsBeforeLong: 4, autoStartBreaks: true, autoStartFocus: false },
  deep: { focusMin: 50, shortMin: 10, longMin: 30, sessionsBeforeLong: 3, autoStartBreaks: true, autoStartFocus: false },
};

export const DEFAULT_CONFIG: TimerConfig = PRESETS.classic!;

export interface TimerState {
  v: 1;
  mode: Mode;
  status: Status;
  phase: Phase;
  /** Wall-clock ms when the current running segment began (null unless running). */
  runningSince: number | null;
  /** Elapsed ms in this phase before `runningSince`. */
  elapsedBefore: number;
  /** Wall-clock ms the phase was first started (session identity + logging). */
  phaseStartedAt: number | null;
  /** Focus sessions completed in the current cycle (for long breaks). */
  cycle: number;
  subjectId: string | null;
  cardId: string | null;
  config: TimerConfig;
  /** Ms spent with the page hidden during focus, and when the user last came back (for the garden). */
  awayMs: number;
  returnedAt: number | null;
}

export interface SessionLog {
  /** Stable per session so two devices logging the same session collapse into one row. */
  key: string;
  kind: 'focus' | 'open';
  startedAt: number;
  endedAt: number;
  plannedSec: number | null;
  focusedSec: number;
  completed: boolean;
  subjectId: string | null;
  cardId: string | null;
}

/** Shorter partial sessions aren't worth recording. */
export const MIN_LOG_SEC = 60;
const MAX_CATCH_UP = 12;

export function initialState(config: TimerConfig = DEFAULT_CONFIG): TimerState {
  return {
    v: 1,
    mode: 'pomodoro',
    status: 'idle',
    phase: 'focus',
    runningSince: null,
    elapsedBefore: 0,
    phaseStartedAt: null,
    cycle: 0,
    subjectId: null,
    cardId: null,
    config,
    awayMs: 0,
    returnedAt: null,
  };
}

export function plannedMs(s: Pick<TimerState, 'mode' | 'phase' | 'config'>): number | null {
  if (s.mode === 'open') return null;
  const min = s.phase === 'focus' ? s.config.focusMin : s.phase === 'short_break' ? s.config.shortMin : s.config.longMin;
  return Math.max(1, min) * 60_000;
}

export function elapsedMs(s: TimerState, now: number): number {
  return s.elapsedBefore + (s.status === 'running' && s.runningSince !== null ? Math.max(0, now - s.runningSince) : 0);
}

export function remainingMs(s: TimerState, now: number): number | null {
  const p = plannedMs(s);
  return p === null ? null : Math.max(0, p - elapsedMs(s, now));
}

/** 0..1 for pomodoro phases; open mode fills over an hour. */
export function progress(s: TimerState, now: number): number {
  const p = plannedMs(s) ?? 3_600_000;
  return Math.min(1, elapsedMs(s, now) / p);
}

export function start(s: TimerState, now: number): TimerState {
  if (s.status === 'running') return s;
  return {
    ...s,
    status: 'running',
    runningSince: now,
    phaseStartedAt: s.phaseStartedAt ?? now,
    returnedAt: s.status === 'idle' ? null : s.returnedAt,
    awayMs: s.status === 'idle' ? 0 : s.awayMs,
  };
}

export function pause(s: TimerState, now: number): TimerState {
  if (s.status !== 'running') return s;
  return { ...s, status: 'paused', elapsedBefore: elapsedMs(s, now), runningSince: null };
}

function nextPhase(s: TimerState): { phase: Phase; cycle: number } {
  if (s.phase !== 'focus') return { phase: 'focus', cycle: s.phase === 'long_break' ? 0 : s.cycle };
  const cycle = s.cycle + 1;
  return cycle >= s.config.sessionsBeforeLong ? { phase: 'long_break', cycle } : { phase: 'short_break', cycle };
}

function sessionKey(s: TimerState): string {
  return `${s.mode}:${s.phaseStartedAt}`;
}

function logFor(s: TimerState, endedAt: number, completed: boolean): SessionLog | null {
  if (s.phaseStartedAt === null) return null;
  if (s.mode === 'pomodoro' && s.phase !== 'focus') return null;
  const focusedSec = Math.round(Math.min(elapsedMs(s, endedAt), plannedMs(s) ?? Infinity) / 1000);
  if (!completed && focusedSec < MIN_LOG_SEC) return null;
  return {
    key: sessionKey(s),
    kind: s.mode === 'open' ? 'open' : 'focus',
    startedAt: s.phaseStartedAt,
    endedAt,
    plannedSec: plannedMs(s) === null ? null : Math.round(plannedMs(s)! / 1000),
    focusedSec,
    completed,
    subjectId: s.subjectId,
    cardId: s.cardId,
  };
}

/** Move to the next phase at `at`, auto-starting it if the config says so. */
function transition(s: TimerState, at: number): TimerState {
  const { phase, cycle } = nextPhase(s);
  const auto = phase === 'focus' ? s.config.autoStartFocus : s.config.autoStartBreaks;
  return {
    ...s,
    phase,
    cycle,
    status: auto ? 'running' : 'idle',
    runningSince: auto ? at : null,
    elapsedBefore: 0,
    phaseStartedAt: auto ? at : null,
    awayMs: 0,
    returnedAt: null,
  };
}

/**
 * Bring the state up to `now`: completes every phase whose end has passed (at its exact end time)
 * and returns the sessions to log. Pure and idempotent.
 */
export function advance(s: TimerState, now: number): { state: TimerState; logs: SessionLog[]; ended: Phase[] } {
  const logs: SessionLog[] = [];
  const ended: Phase[] = [];
  let cur = s;
  for (let i = 0; i < MAX_CATCH_UP; i++) {
    if (cur.mode !== 'pomodoro' || cur.status !== 'running' || cur.runningSince === null) break;
    const planned = plannedMs(cur)!;
    const endAt = cur.runningSince + (planned - cur.elapsedBefore);
    if (endAt > now) break;
    const log = logFor(cur, endAt, true);
    if (log) logs.push(log);
    ended.push(cur.phase);
    cur = transition(cur, endAt);
  }
  return { state: cur, logs, ended };
}

/** Skip the rest of this phase. A partial focus session of at least a minute is still logged. */
export function skip(s: TimerState, now: number): { state: TimerState; log: SessionLog | null } {
  const log = s.status === 'idle' ? null : logFor(s, now, false);
  const next = transition({ ...s, config: { ...s.config, autoStartBreaks: false, autoStartFocus: false } }, now);
  return { state: { ...next, config: s.config }, log };
}

/** Stop and reset the current phase (open mode: stop and log). */
export function stop(s: TimerState, now: number): { state: TimerState; log: SessionLog | null } {
  const log = s.status === 'idle' ? null : logFor(s, now, s.mode === 'open');
  return {
    state: { ...s, status: 'idle', runningSince: null, elapsedBefore: 0, phaseStartedAt: null, awayMs: 0, returnedAt: null, phase: s.mode === 'open' ? 'focus' : s.phase },
    log,
  };
}

export function setMode(s: TimerState, mode: Mode): TimerState {
  if (s.status !== 'idle') return s;
  return { ...s, mode, phase: 'focus', cycle: 0 };
}

export function setConfig(s: TimerState, config: TimerConfig): TimerState {
  // Changing lengths mid-phase keeps the elapsed time; the phase may complete immediately on next advance.
  return { ...s, config };
}

/** Page visibility bookkeeping for the garden's gentle wilt. Only counts while focusing. */
export function markHidden(s: TimerState, hiddenAt: number, visibleAt: number): TimerState {
  if (s.status !== 'running' || s.phase !== 'focus') return s;
  return { ...s, awayMs: s.awayMs + Math.max(0, visibleAt - hiddenAt), returnedAt: visibleAt };
}

/**
 * How much the plant droops (0..0.35): proportional to time away during this focus phase,
 * recovering fully within two minutes of coming back. Never punitive beyond a slight lean.
 */
export function wilt(s: TimerState, now: number): number {
  const p = plannedMs(s) ?? 3_600_000;
  const base = Math.min(0.35, s.awayMs / p);
  if (!base || s.returnedAt === null) return base;
  const recovered = Math.min(1, (now - s.returnedAt) / 120_000);
  return base * (1 - recovered);
}

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(sec).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
