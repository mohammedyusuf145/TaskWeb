import { describe, expect, it } from 'vitest';
import type { Card } from '@/types/database';
import { dayPart, dayPlan } from './plan';

const card = (p: Partial<Card>): Card => ({ id: Math.random().toString(36), title: 't', due_at: null, due_has_time: false, completed_at: null, is_exam: false, deleted_at: null, ...p }) as Card;
const now = new Date(2026, 10, 6, 15, 0);
const at = (d: number, h = 23, m = 59) => new Date(2026, 10, d, h, m).toISOString();

describe('today plan', () => {
  it('splits overdue, today and done-today; ignores undated and deleted', () => {
    const p = dayPlan(
      [
        card({ title: 'late', due_at: at(4) }),
        card({ title: 'morning', due_at: at(6, 9), due_has_time: true }),
        card({ title: 'tonight', due_at: at(6) }),
        card({ title: 'done', due_at: at(6, 10), completed_at: new Date(2026, 10, 6, 11).toISOString() }),
        card({ title: 'later', due_at: at(9) }),
        card({ title: 'nodate' }),
        card({ title: 'gone', due_at: at(6), deleted_at: '2026-11-06T00:00:00Z' }),
      ],
      now,
    );
    expect(p.overdue.map((c) => c.title)).toEqual(['late']);
    expect(p.today.map((c) => c.title)).toEqual(['morning', 'tonight']);
    expect(p.doneToday.map((c) => c.title)).toEqual(['done']);
  });
  it('finds the next open exam and counts whole days', () => {
    const p = dayPlan([card({ is_exam: true, due_at: at(9, 8, 0) }), card({ is_exam: true, due_at: at(20) }), card({ is_exam: true, due_at: at(2) })], now);
    expect(p.examInDays).toBe(3);
    expect(dayPlan([], now).nextExam).toBeNull();
  });
  it('names the part of the day', () => {
    expect(dayPart(new Date(2026, 1, 1, 8))).toBe('morning');
    expect(dayPart(new Date(2026, 1, 1, 14))).toBe('afternoon');
    expect(dayPart(new Date(2026, 1, 1, 21))).toBe('evening');
  });
});
