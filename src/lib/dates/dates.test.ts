import { describe, expect, it } from 'vitest';
import { addDays, dayDiff, formatDate, fromDateInputValue, hijriParts, startOfWeek, toDateInputValue, weekdayOrder } from './index';

describe('week start', () => {
  // Wednesday 15 Oct 2026
  const wed = new Date(2026, 9, 14, 15, 30);
  it('Sunday start', () => {
    const s = startOfWeek(wed, 0);
    expect(s.getDay()).toBe(0);
    expect(s.getDate()).toBe(11);
    expect(s.getHours()).toBe(0);
  });
  it('Saturday start', () => {
    const s = startOfWeek(wed, 6);
    expect(s.getDay()).toBe(6);
    expect(s.getDate()).toBe(10);
  });
  it('Monday start', () => {
    expect(startOfWeek(wed, 1).getDate()).toBe(12);
  });
  it('a day that is the week start maps to itself', () => {
    const sat = new Date(2026, 9, 10, 9);
    expect(startOfWeek(sat, 6).getDate()).toBe(10);
  });
  it('weekday order', () => {
    expect(weekdayOrder(6)).toEqual([6, 0, 1, 2, 3, 4, 5]);
    expect(weekdayOrder(0)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });
});

describe('day arithmetic', () => {
  it('dayDiff counts calendar days', () => {
    expect(dayDiff(new Date(2026, 9, 11, 23, 59), new Date(2026, 9, 12, 0, 1))).toBe(1);
    expect(dayDiff(new Date(2026, 9, 12), new Date(2026, 9, 11))).toBe(-1);
    expect(dayDiff(new Date(2026, 9, 11), addDays(new Date(2026, 9, 11), 30))).toBe(30);
  });
  it('date input round-trip', () => {
    const d = new Date(2026, 0, 5);
    expect(toDateInputValue(d)).toBe('2026-01-05');
    expect(fromDateInputValue('2026-01-05')?.getTime()).toBe(d.getTime());
    expect(fromDateInputValue('nope')).toBeNull();
  });
});

describe('Hijri (Umm al-Qura)', () => {
  it('1 Ramadan 1447 is 18 Feb 2026', () => {
    expect(hijriParts(new Date(2026, 1, 18, 12))).toEqual({ year: 1447, month: 9, day: 1 });
  });
  it('formats with Western digits in Arabic', () => {
    const s = formatDate(new Date(2026, 9, 11), 'ar', 'gregorian');
    expect(s).toMatch(/11/);
    expect(s).not.toMatch(/[٠-٩]/);
  });
});

import { calendarLocale } from './index';
describe('calendarLocale', () => {
  it('adds the Umm al-Qura calendar for both languages', () => {
    expect(calendarLocale('en', 'hijri')).toContain('islamic-umalqura');
    expect(calendarLocale('ar', 'hijri')).toContain('islamic-umalqura');
    expect(new Intl.DateTimeFormat(calendarLocale('en', 'hijri'), { year: 'numeric' }).format(new Date(2026, 9, 11))).toMatch(/1448/);
  });
});
