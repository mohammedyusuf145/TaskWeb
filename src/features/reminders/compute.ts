import type { Card } from '@/types/database';

/** Offsets (minutes before due) offered in the UI. */
export const OFFSET_PRESETS = [0, 10, 30, 60, 180, 1440, 2880, 10080] as const;
export const DEFAULT_OFFSETS = [1440, 60];
/** Cards with a date but no time are reminded relative to this local hour on the due day. */
export const DATE_ONLY_HOUR = 8;

export interface ReminderInstance {
  key: string;
  cardId: string;
  offsetMin: number;
  fireAt: Date;
  dueAt: Date;
}

type ReminderCard = Pick<Card, 'id' | 'due_at' | 'due_has_time' | 'completed_at' | 'deleted_at'> & { reminder_offsets?: number[] | null };

/**
 * Reminder times for one card. Mirrors public.due_reminders() in the database so in-app and push
 * reminders agree. Date-only cards: offsets under a day collapse to 08:00 on the due day.
 */
export function reminderTimes(card: ReminderCard, defaults: number[]): ReminderInstance[] {
  if (!card.due_at || card.completed_at || card.deleted_at) return [];
  const offsets = [...new Set(card.reminder_offsets ?? defaults)].filter((o) => o >= 0 && o <= 40320);
  const due = new Date(card.due_at);
  const out: ReminderInstance[] = [];
  const seen = new Set<number>();

  for (const offset of offsets) {
    let fireAt: Date;
    let effective = offset;
    if (card.due_has_time) {
      fireAt = new Date(due.getTime() - offset * 60_000);
    } else {
      // Whole days before the due day, at 08:00 local (DST-safe via the Date constructor).
      effective = offset < 1440 ? 0 : Math.round(offset / 1440) * 1440;
      fireAt = new Date(due.getFullYear(), due.getMonth(), due.getDate() - effective / 1440, DATE_ONLY_HOUR, 0);
    }
    if (seen.has(fireAt.getTime())) continue;
    seen.add(fireAt.getTime());
    out.push({ key: `${card.id}:${effective}:${card.due_at}`, cardId: card.id, offsetMin: effective, fireAt, dueAt: due });
  }
  return out.sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime());
}

/** All reminders firing in (from, to], soonest first. */
export function remindersBetween(cards: ReminderCard[], defaults: number[], from: Date, to: Date): ReminderInstance[] {
  const out: ReminderInstance[] = [];
  for (const c of cards) {
    for (const r of reminderTimes(c, defaults)) {
      if (r.fireAt > from && r.fireAt <= to) out.push(r);
    }
  }
  return out.sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime());
}

/** The next reminder strictly after `now`, for scheduling a single timer. */
export function nextReminder(cards: ReminderCard[], defaults: number[], now: Date): ReminderInstance | null {
  let best: ReminderInstance | null = null;
  for (const c of cards) {
    for (const r of reminderTimes(c, defaults)) {
      if (r.fireAt > now && (!best || r.fireAt < best.fireAt)) best = r;
    }
  }
  return best;
}
