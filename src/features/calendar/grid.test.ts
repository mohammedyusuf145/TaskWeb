import { describe, expect, it } from 'vitest';
import { fromDateParam, layoutDay, monthGrid, rangeFor, shiftAnchor, snap, toDateParam, weekDays } from './grid';

const ymd = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

describe('month grid', () => {
  it('October 2026, weeks starting Sunday: starts Sun 27 Sep, 5 rows', () => {
    const days = monthGrid(new Date(2026, 9, 11), 0);
    expect(ymd(days[0]!)).toBe('2026-9-27');
    expect(days.length).toBe(35);
    expect(ymd(days.at(-1)!)).toBe('2026-10-31');
  });
  it('Saturday start shifts the first cell', () => {
    const days = monthGrid(new Date(2026, 9, 11), 6);
    expect(ymd(days[0]!)).toBe('2026-9-26');
    expect(days[0]!.getDay()).toBe(6);
  });
  it('February 2026 starting on Sunday fits in 4 rows', () => {
    expect(monthGrid(new Date(2026, 1, 10), 0).length).toBe(28);
  });
});

describe('ranges and navigation', () => {
  it('week days follow the week start', () => {
    expect(weekDays(new Date(2026, 9, 14), 6).map((d) => d.getDay())).toEqual([6, 0, 1, 2, 3, 4, 5]);
  });
  it('rangeFor week is 7 days', () => {
    const r = rangeFor('week', new Date(2026, 9, 14), 0);
    expect(ymd(r.start)).toBe('2026-10-11');
    expect(ymd(r.end)).toBe('2026-10-18');
  });
  it('month shift clamps the day (31 Jan → 28 Feb)', () => {
    expect(ymd(shiftAnchor('month', new Date(2026, 0, 31), 1))).toBe('2026-2-28');
    expect(ymd(shiftAnchor('month', new Date(2026, 0, 15), -1))).toBe('2025-12-15');
  });
  it('date params round-trip and reject junk', () => {
    expect(toDateParam(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(fromDateParam('2026-01-05')?.getDate()).toBe(5);
    expect(fromDateParam('x')).toBeNull();
    expect(fromDateParam(null)).toBeNull();
  });
  it('snaps to 15 minutes', () => {
    expect(snap(7)).toBe(0);
    expect(snap(8)).toBe(15);
    expect(snap(52)).toBe(45);
  });
});

describe('layoutDay', () => {
  it('non-overlapping events get one lane each', () => {
    const l = layoutDay([
      { id: 'a', start: 60, end: 120 },
      { id: 'b', start: 120, end: 180 },
    ]);
    expect(l.get('a')).toEqual({ id: 'a', lane: 0, lanes: 1 });
    expect(l.get('b')).toEqual({ id: 'b', lane: 0, lanes: 1 });
  });
  it('overlaps share a cluster and reuse freed lanes', () => {
    const l = layoutDay([
      { id: 'a', start: 60, end: 180 },
      { id: 'b', start: 90, end: 120 },
      { id: 'c', start: 130, end: 200 },
      { id: 'd', start: 300, end: 330 },
    ]);
    expect(l.get('a')).toMatchObject({ lane: 0, lanes: 2 });
    expect(l.get('b')).toMatchObject({ lane: 1, lanes: 2 });
    expect(l.get('c')).toMatchObject({ lane: 1, lanes: 2 });
    expect(l.get('d')).toMatchObject({ lane: 0, lanes: 1 });
  });
  it('three-way overlap', () => {
    const l = layoutDay([
      { id: 'a', start: 0, end: 60 },
      { id: 'b', start: 10, end: 60 },
      { id: 'c', start: 20, end: 60 },
    ]);
    expect([...l.values()].map((p) => p.lanes)).toEqual([3, 3, 3]);
  });
});
