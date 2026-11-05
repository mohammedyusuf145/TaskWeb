import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CONFIG,
  advance,
  elapsedMs,
  formatClock,
  initialState,
  markHidden,
  pause,
  progress,
  remainingMs,
  setMode,
  skip,
  start,
  stop,
  wilt,
} from './engine';

const T0 = Date.UTC(2026, 9, 11, 14, 0, 0);
const min = (n: number) => n * 60_000;

describe('timestamps, not ticks', () => {
  it('elapsed is exact after a long sleep', () => {
    const s = start(initialState(), T0);
    expect(elapsedMs(s, T0 + min(7) + 123)).toBe(min(7) + 123);
    expect(remainingMs(s, T0 + min(7))).toBe(min(18));
  });
  it('pause freezes time; resume continues from the same point', () => {
    let s = start(initialState(), T0);
    s = pause(s, T0 + min(10));
    expect(elapsedMs(s, T0 + min(60))).toBe(min(10));
    s = start(s, T0 + min(60));
    expect(remainingMs(s, T0 + min(65))).toBe(min(10));
    expect(s.phaseStartedAt).toBe(T0);
  });
  it('survives serialisation (refresh / another device)', () => {
    const s = start(initialState(), T0);
    const copy = JSON.parse(JSON.stringify(s));
    expect(remainingMs(copy, T0 + min(5))).toBe(remainingMs(s, T0 + min(5)));
  });
  it('progress is 0..1', () => {
    const s = start(initialState(), T0);
    expect(progress(s, T0 + min(12.5))).toBeCloseTo(0.5);
    expect(progress(s, T0 + min(90))).toBe(1);
  });
});

describe('advance', () => {
  it('does nothing before the end', () => {
    const s = start(initialState(), T0);
    const r = advance(s, T0 + min(24));
    expect(r.logs).toEqual([]);
    expect(r.state).toBe(s);
  });
  it('completes focus at its exact end and auto-starts the break from that moment', () => {
    const s = start(initialState(), T0);
    const r = advance(s, T0 + min(26));
    expect(r.logs).toHaveLength(1);
    expect(r.logs[0]).toMatchObject({ kind: 'focus', startedAt: T0, endedAt: T0 + min(25), focusedSec: 1500, completed: true, plannedSec: 1500 });
    expect(r.state).toMatchObject({ phase: 'short_break', status: 'running', runningSince: T0 + min(25), cycle: 1 });
    expect(remainingMs(r.state, T0 + min(26))).toBe(min(4));
  });
  it('stops after the break when focus auto-start is off', () => {
    const s = start(initialState(), T0);
    const r = advance(s, T0 + min(40));
    expect(r.ended).toEqual(['focus', 'short_break']);
    expect(r.state).toMatchObject({ phase: 'focus', status: 'idle', cycle: 1 });
    expect(r.logs).toHaveLength(1);
  });
  it('long break after N sessions, then the cycle resets', () => {
    let s = start(initialState({ ...DEFAULT_CONFIG, autoStartFocus: true, sessionsBeforeLong: 2 }), T0);
    const r = advance(s, T0 + min(25 + 5 + 25) + 1);
    expect(r.state.phase).toBe('long_break');
    expect(r.logs).toHaveLength(2);
    s = advance(r.state, T0 + min(25 + 5 + 25 + 15) + 1).state;
    expect(s).toMatchObject({ phase: 'focus', cycle: 0 });
  });
  it('is idempotent', () => {
    const s = start(initialState(), T0);
    const a = advance(s, T0 + min(26));
    const b = advance(a.state, T0 + min(26));
    expect(b.logs).toEqual([]);
  });
  it('same session → same log key (two devices dedupe)', () => {
    const s = start(initialState(), T0);
    expect(advance(s, T0 + min(30)).logs[0]!.key).toBe(advance(JSON.parse(JSON.stringify(s)), T0 + min(26)).logs[0]!.key);
  });
});

describe('skip and stop', () => {
  it('skipping focus after 10 min logs a partial session and waits', () => {
    const s = start(initialState(), T0);
    const r = skip(s, T0 + min(10));
    expect(r.log).toMatchObject({ completed: false, focusedSec: 600 });
    expect(r.state).toMatchObject({ phase: 'short_break', status: 'idle' });
    expect(r.state.config.autoStartBreaks).toBe(true);
  });
  it('very short partial sessions are not logged', () => {
    expect(skip(start(initialState(), T0), T0 + 30_000).log).toBeNull();
  });
  it('open mode counts up and logs on stop', () => {
    let s = setMode(initialState(), 'open');
    s = start(s, T0);
    expect(remainingMs(s, T0 + min(5))).toBeNull();
    expect(advance(s, T0 + min(500)).logs).toEqual([]);
    const r = stop(s, T0 + min(42));
    expect(r.log).toMatchObject({ kind: 'open', focusedSec: 2520, completed: true, plannedSec: null });
    expect(r.state.status).toBe('idle');
  });
});

describe('garden wilt', () => {
  it('droops a little when away, capped, and recovers after returning', () => {
    let s = start(initialState(), T0);
    s = markHidden(s, T0 + min(2), T0 + min(7)); // away 5 of 25 min
    expect(wilt(s, T0 + min(7))).toBeCloseTo(0.2);
    expect(wilt(s, T0 + min(8))).toBeCloseTo(0.1);
    expect(wilt(s, T0 + min(10))).toBe(0);
    const long = markHidden(start(initialState(), T0), T0, T0 + min(24));
    expect(wilt(long, T0 + min(24))).toBe(0.35);
  });
  it('breaks are not counted as away', () => {
    const s = { ...start(initialState(), T0), phase: 'short_break' as const };
    expect(markHidden(s, T0, T0 + min(3)).awayMs).toBe(0);
  });
});

describe('formatClock', () => {
  it('formats and rounds up', () => {
    expect(formatClock(min(25))).toBe('25:00');
    expect(formatClock(1)).toBe('00:01');
    expect(formatClock(min(75))).toBe('1:15:00');
  });
});
