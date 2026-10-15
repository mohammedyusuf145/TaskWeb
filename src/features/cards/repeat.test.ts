import { describe, expect, it } from 'vitest';
import { nextOccurrence } from './repeat';

const d = (s: string) => new Date(s);
const iso = (x: Date | null) => x && `${x.getFullYear()}-${x.getMonth() + 1}-${x.getDate()} ${x.getHours()}:${String(x.getMinutes()).padStart(2, '0')}`;
// Sunday 11 Oct 2026 17:00
const due = d('2026-10-11T17:00:00');
const before = d('2026-10-11T10:00:00');

describe('nextOccurrence', () => {
  it('daily keeps the time', () => {
    expect(iso(nextOccurrence(due, { freq: 'daily', interval: 1 }, before))).toBe('2026-10-12 17:00');
    expect(iso(nextOccurrence(due, { freq: 'daily', interval: 3 }, before))).toBe('2026-10-14 17:00');
  });
  it('weekly on the same weekday', () => {
    expect(iso(nextOccurrence(due, { freq: 'weekly', interval: 1 }, before))).toBe('2026-10-18 17:00');
    expect(iso(nextOccurrence(due, { freq: 'weekly', interval: 2 }, before))).toBe('2026-10-25 17:00');
  });
  it('weekly on listed weekdays (Sun, Tue, Thu)', () => {
    const rule = { freq: 'weekly' as const, interval: 1, weekdays: [0, 2, 4] };
    expect(iso(nextOccurrence(due, rule, before))).toBe('2026-10-13 17:00');
    expect(iso(nextOccurrence(d('2026-10-15T17:00:00'), rule, before))).toBe('2026-10-18 17:00');
  });
  it('skips occurrences already in the past when finished late', () => {
    expect(iso(nextOccurrence(due, { freq: 'daily', interval: 1 }, d('2026-10-14T20:00:00')))).toBe('2026-10-15 17:00');
  });
  it('stops after "until"', () => {
    expect(nextOccurrence(due, { freq: 'daily', interval: 1, until: '2026-10-11T23:00:00' }, before)).toBeNull();
  });
});
