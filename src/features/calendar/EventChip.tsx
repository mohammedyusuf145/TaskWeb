import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Flag } from 'lucide-react';
import { useI18n, useT } from '@/lib/i18n';
import { formatTime, formatDateLong } from '@/lib/dates';
import { cn } from '@/lib/cn';
import type { CalEvent } from './events';

export function eventLabel(e: CalEvent, lang: 'ar' | 'en', t: ReturnType<typeof useT>): string {
  const when = `${formatDateLong(e.start, lang)}${e.allDay ? '' : `, ${formatTime(e.start, lang)}`}`;
  return [t('cal.eventLabel', { title: e.card.title, when }), e.card.is_exam && t('board.exam'), e.overdue && t('cal.overdue'), e.subject?.name]
    .filter(Boolean)
    .join(' · ');
}

/** Single-line event used in month cells and the all-day row. Draggable to reschedule. */
export function EventChip({ event, onOpen, draggable = true }: { event: CalEvent; onOpen: (id: string) => void; draggable?: boolean }) {
  const t = useT();
  const lang = useI18n((s) => s.lang);
  const { setNodeRef, attributes, listeners, transform, isDragging } = useDraggable({ id: event.id, data: { event }, disabled: !draggable });
  const exam = event.card.is_exam;
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      aria-roledescription={undefined}
      aria-label={eventLabel(event, lang, t)}
      onClick={(e) => {
        e.stopPropagation();
        onOpen(event.id);
      }}
      onKeyDown={(e) => {
        listeners?.onKeyDown?.(e);
        if (e.key === 'Enter' && !e.defaultPrevented) onOpen(event.id);
      }}
      style={{
        transform: CSS.Translate.toString(transform),
        background: `color-mix(in oklab, ${event.color} ${exam ? 22 : 12}%, var(--surface-2))`,
        borderInlineStartColor: event.overdue ? 'var(--danger)' : event.color,
      }}
      className={cn(
        'relative flex h-6 min-w-0 cursor-pointer touch-manipulation items-center gap-1 rounded-chip border-s-[3px] ps-1.5 pe-1 text-xs select-none',
        'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent',
        event.done ? 'text-text-3 opacity-60' : 'text-text',
        isDragging && 'z-30 shadow-pop',
      )}
    >
      {exam && <Flag size={11} className="shrink-0" style={{ color: event.color }} aria-hidden />}
      {!event.allDay && <span className="shrink-0 text-text-3 tabular">{formatTime(event.start, lang)}</span>}
      <span className="truncate" dir="auto">
        {event.card.title}
      </span>
    </div>
  );
}
