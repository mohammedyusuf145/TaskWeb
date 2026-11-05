import { dayDiff } from '@/lib/dates';

export type DueState = 'none' | 'done' | 'overdue' | 'today' | 'soon' | 'later';

/** How urgent a due date is, relative to now. Completed cards are never urgent. */
export function dueState(dueAt: string | null, completed: boolean, now = new Date()): DueState {
  if (!dueAt) return 'none';
  if (completed) return 'done';
  const due = new Date(dueAt);
  if (due.getTime() < now.getTime()) return 'overdue';
  const days = dayDiff(now, due);
  if (days <= 0) return 'today';
  if (days <= 2) return 'soon';
  return 'later';
}
