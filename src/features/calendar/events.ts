import { useMemo } from 'react';
import type { Card, Subject } from '@/types/database';
import { useAllCards, useBoards, useSubjects } from '@/lib/db/hooks';
import { subjectColor } from '@/design/tokens';
import { minutesOfDay } from './grid';

export interface CalEvent {
  id: string;
  card: Card;
  subject?: Subject;
  start: Date;
  /** Visual end: start + focus estimate (min 30 min), clamped to the same day. */
  end: Date;
  allDay: boolean;
  done: boolean;
  overdue: boolean;
  color: string;
}

export function toEvent(card: Card, subject: Subject | undefined, now: Date): CalEvent {
  const start = new Date(card.due_at!);
  const allDay = !card.due_has_time;
  const minutes = Math.max(30, card.estimate_min ?? 30);
  const endOfDay = 24 * 60 - minutesOfDay(start);
  const end = new Date(start.getTime() + Math.min(minutes, endOfDay) * 60_000);
  const done = Boolean(card.completed_at);
  return {
    id: card.id,
    card,
    subject,
    start,
    end,
    allDay,
    done,
    overdue: !done && start.getTime() < now.getTime(),
    color: subject ? subjectColor(subject.color) : 'var(--text-3)',
  };
}

/** Every dated card on an active board, as calendar events. The board stays the single source of truth. */
export function useCalendarEvents(now: Date): { events: CalEvent[] | undefined; subjects: Subject[] | undefined } {
  const cards = useAllCards();
  const boards = useBoards();
  const subjects = useSubjects();
  const events = useMemo(() => {
    if (!cards || !boards || !subjects) return undefined;
    const active = new Set(boards.map((b) => b.id));
    const byId = new Map(subjects.map((s) => [s.id, s]));
    return cards
      .filter((c) => c.due_at && active.has(c.board_id))
      .map((c) => toEvent(c, c.subject_id ? byId.get(c.subject_id) : undefined, now))
      .sort((a, b) => a.start.getTime() - b.start.getTime() || Number(b.card.is_exam) - Number(a.card.is_exam));
  }, [cards, boards, subjects, now]);
  return { events, subjects };
}

export function eventsOnDay(events: CalEvent[], day: Date): CalEvent[] {
  const y = day.getFullYear();
  const m = day.getMonth();
  const d = day.getDate();
  return events.filter((e) => e.start.getFullYear() === y && e.start.getMonth() === m && e.start.getDate() === d);
}
