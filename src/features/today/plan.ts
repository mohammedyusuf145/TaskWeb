/** What belongs on the Today page, decided from the cards. Pure, so it is unit-tested. */
import type { Card } from '@/types/database';

export interface DayPlan {
  overdue: Card[];
  today: Card[];
  /** Finished today, so ticking something off doesn't make it vanish. */
  doneToday: Card[];
  nextExam: Card | null;
  /** Whole days until the next exam (0 = today). */
  examInDays: number | null;
}

const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export function dayPlan(cards: Card[], now = new Date()): DayPlan {
  const start = dayStart(now).getTime();
  const end = start + 86_400_000;
  const live = cards.filter((c) => !c.deleted_at && c.due_at);
  const due = (c: Card) => new Date(c.due_at!).getTime();
  const byDue = (a: Card, b: Card) => due(a) - due(b);
  const open = live.filter((c) => !c.completed_at);
  const exams = open.filter((c) => c.is_exam && due(c) >= start).sort(byDue);
  const nextExam = exams[0] ?? null;
  return {
    // Date-only cards are due at 23:59, so "overdue" means before today began, or a timed card already past.
    overdue: open.filter((c) => due(c) < start).sort(byDue),
    today: open.filter((c) => due(c) >= start && due(c) < end).sort(byDue),
    doneToday: live.filter((c) => c.completed_at && new Date(c.completed_at).getTime() >= start && due(c) < end).sort(byDue),
    nextExam,
    examInDays: nextExam ? Math.round((dayStart(new Date(nextExam.due_at!)).getTime() - start) / 86_400_000) : null,
  };
}

export type DayPart = 'morning' | 'afternoon' | 'evening';
export const dayPart = (now = new Date()): DayPart => (now.getHours() < 12 ? 'morning' : now.getHours() < 17 ? 'afternoon' : 'evening');
