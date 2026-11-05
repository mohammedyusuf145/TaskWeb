import { describe, expect, it } from 'vitest';
import { bestWindow, formatDuration, hourHistogram, minutesByDay, streaks, summarize, totalForDay } from './aggregate';

const s = (start: Date, minutes: number, subject: string | null = 'math') => ({
  started_at: start.toISOString(),
  ended_at: new Date(start.getTime() + minutes * 60_000).toISOString(),
  focused_sec: minutes * 60,
  subject_id: subject,
  deleted_at: null,
  completed: true,
});
const d = (day: number, h = 16, m = 0) => new Date(2026, 9, day, h, m);

describe('minutesByDay', () => {
  it('groups by local day and subject', () => {
    const map = minutesByDay([s(d(10), 25), s(d(10, 18), 50, 'phys'), s(d(11), 25), s(d(11, 20), 25, null)]);
    expect(map.get('2026-10-10')?.get('math')).toBe(25);
    expect(map.get('2026-10-10')?.get('phys')).toBe(50);
    expect(totalForDay(map, d(11))).toBe(50);
    expect(map.get('2026-10-11')?.get('none')).toBe(25);
  });
});

describe('streaks', () => {
  it('counts back from today, or from yesterday if today is still empty', () => {
    const list = [s(d(7), 25), s(d(8), 25), s(d(9), 25), s(d(10), 25)];
    expect(streaks(list, d(10))).toEqual({ current: 4, best: 4 });
    expect(streaks(list, d(11))).toEqual({ current: 4, best: 4 });
    expect(streaks(list, d(12)).current).toBe(0);
  });
  it('days under the minimum don’t count; best keeps the longest run', () => {
    const list = [s(d(1), 25), s(d(2), 25), s(d(3), 25), s(d(5), 5), s(d(9), 30), s(d(10), 30)];
    expect(streaks(list, d(10))).toEqual({ current: 2, best: 3 });
  });
});

describe('hourHistogram + bestWindow', () => {
  it('splits a session across hours', () => {
    const h = hourHistogram([s(d(10, 16, 40), 50)]);
    expect(h[16]).toBeCloseTo(20);
    expect(h[17]).toBeCloseTo(30);
  });
  it('finds the busiest two hours', () => {
    const h = hourHistogram([s(d(10, 9), 30), s(d(10, 16), 60), s(d(10, 17), 45)]);
    expect(bestWindow(h)).toEqual({ start: 16, minutes: 105 });
    expect(bestWindow(new Array(24).fill(0))).toBeNull();
  });
});

describe('summarize', () => {
  it('totals, active days, goal days, subjects sorted', () => {
    const list = [s(d(10), 60), s(d(10, 18), 70, 'phys'), s(d(11), 30), s(d(20), 999)];
    const r = summarize(list, d(10, 0), d(12, 0), 120);
    expect(r.minutes).toBe(160);
    expect(r.sessions).toBe(3);
    expect(r.activeDays).toBe(2);
    expect(r.goalDays).toBe(1);
    expect(r.bySubject[0]).toEqual({ subjectId: 'math', minutes: 90 });
  });
});

describe('formatDuration', () => {
  it('both languages', () => {
    expect(formatDuration(135, 'en')).toBe('2h 15m');
    expect(formatDuration(45, 'en')).toBe('45m');
    expect(formatDuration(120, 'ar')).toBe('2 س');
  });
});
