import { describe, expect, it } from 'vitest';
import { isDue, newCardState, preview, review, type Grade } from './srs';

const now = new Date('2026-10-11T10:00:00');
const days = (iso: string) => Math.round((new Date(iso).getTime() - now.getTime()) / 86_400_000);
const run = (grades: Grade[]) => grades.reduce((s, g) => review(s, g, now), newCardState(now));

describe('srs', () => {
  it('schedules a new card by grade', () => {
    expect(days(review(newCardState(now), 'good', now).due_at)).toBe(1);
    expect(days(review(newCardState(now), 'easy', now).due_at)).toBe(3);
    const again = review(newCardState(now), 'again', now);
    expect(new Date(again.due_at).getTime() - now.getTime()).toBe(10 * 60_000);
    expect(again.lapses).toBe(0); // a new card can't lapse
  });

  it('grows intervals with ease and keeps hard < good < easy', () => {
    const s = run(['good', 'good']);
    expect(s.interval_days).toBe(3);
    const p = preview(s, now);
    expect(p.hard).toBeLessThan(p.good);
    expect(p.good).toBeLessThan(p.easy);
    expect(review(s, 'good', now).interval_days).toBe(8); // 3 × 2.5 = 7.5 → 8
  });

  it('a lapse resets repetitions, counts the lapse and lowers ease', () => {
    const s = review(run(['good', 'good', 'good']), 'again', now);
    expect(s.repetitions).toBe(0);
    expect(s.lapses).toBe(1);
    expect(s.ease).toBeCloseTo(2.3);
  });

  it('keeps ease within the database range and caps the interval', () => {
    let s = newCardState(now);
    for (let i = 0; i < 30; i++) s = review(s, 'again', now);
    expect(s.ease).toBe(1.3);
    s = newCardState(now);
    for (let i = 0; i < 30; i++) s = review(s, 'easy', now);
    expect(s.ease).toBe(5);
    expect(s.interval_days).toBe(365);
  });

  it('hard never schedules backwards', () => {
    let s = run(['good', 'good']);
    for (let i = 0; i < 20; i++) {
      const next = review(s, 'hard', now);
      expect(next.interval_days).toBeGreaterThanOrEqual(s.interval_days);
      s = next;
    }
  });

  it('due: anything up to now, plus day-cards later today; relearning waits its minutes', () => {
    expect(isDue({ due_at: '2026-10-10T08:00:00' }, now)).toBe(true);
    expect(isDue({ due_at: '2026-10-11T20:00:00' }, now)).toBe(true);
    expect(isDue({ due_at: '2026-10-12T09:00:00' }, now)).toBe(false);
    expect(isDue({ due_at: new Date(now.getTime() + 10 * 60_000).toISOString() }, now)).toBe(false);
  });
});
