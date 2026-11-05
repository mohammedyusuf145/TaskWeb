import { useMemo } from 'react';
import { CalendarPlus, CalendarRange, Flag } from 'lucide-react';
import { useI18n, useT } from '@/lib/i18n';
import { addDays, formatDayMonth, formatDateLong, formatTime, isSameDay, relativeDay, startOfDay } from '@/lib/dates';
import { cn } from '@/lib/cn';
import { Button, EmptyState } from '@/components/ui';
import type { CalEvent } from './events';
import type { DatePrefs } from './TimeGrid';

interface Props {
  events: CalEvent[];
  from: Date;
  now: Date;
  prefs: DatePrefs;
  onOpen: (id: string) => void;
  onCreate: (at: Date, hasTime: boolean) => void;
}

/** Chronological list: overdue first, then each day with something due. Default on phones. */
export function AgendaView({ events, from, now, prefs, onOpen, onCreate }: Props) {
  const t = useT();
  const start = startOfDay(from);
  const end = addDays(start, 60);
  const overdue = useMemo(() => (isSameDay(start, now) ? events.filter((e) => e.overdue && e.start < startOfDay(now)) : []), [events, start, now]);
  const days = useMemo(() => {
    const map = new Map<string, { day: Date; list: CalEvent[] }>();
    for (const e of events) {
      if (e.start < start || e.start >= end) continue;
      const day = startOfDay(e.start);
      const k = day.toDateString();
      if (!map.has(k)) map.set(k, { day, list: [] });
      map.get(k)!.list.push(e);
    }
    return [...map.values()];
  }, [events, start, end]);

  if (overdue.length === 0 && days.length === 0)
    return (
      <div className="px-4 py-8 md:px-8">
        <EmptyState
          icon={<CalendarRange size={20} />}
          title={t('cal.agenda.empty.title')}
          body={t('cal.agenda.empty.body')}
          action={
            <Button variant="primary" iconStart={<CalendarPlus size={16} />} onClick={() => onCreate(new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59), false)}>
              {t('board.newCard')}
            </Button>
          }
        />
      </div>
    );

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-[760px] flex-col gap-6 px-4 py-5 md:px-8">
        {overdue.length > 0 && (
          <section aria-labelledby="agenda-overdue">
            <h2 id="agenda-overdue" className="mb-2 text-sm font-medium text-danger">
              {t('cal.overdue')} · {overdue.length}
            </h2>
            <ul className="flex flex-col gap-1.5">
              {overdue.map((e) => (
                <AgendaRow key={e.id} event={e} onOpen={onOpen} showDate />
              ))}
            </ul>
          </section>
        )}
        {days.map(({ day, list }) => (
          <AgendaDay key={day.toISOString()} day={day} events={list} now={now} onOpen={onOpen} onCreate={onCreate} prefs={prefs} />
        ))}
      </div>
    </div>
  );
}

export function AgendaDay({ day, events, now, prefs, onOpen, onCreate }: { day: Date; events: CalEvent[]; now: Date; prefs: DatePrefs; onOpen: (id: string) => void; onCreate: Props['onCreate'] }) {
  const t = useT();
  const lang = useI18n((s) => s.lang);
  const today = isSameDay(day, now);
  const rel = relativeDay(day, lang, now, prefs.primary);
  const full = formatDateLong(day, lang, prefs.primary);
  const secondary = prefs.showSecondary ? formatDayMonth(day, lang, prefs.primary === 'gregorian' ? 'hijri' : 'gregorian') : null;
  return (
    <section aria-label={full}>
      <header className="sticky top-0 z-10 -mx-1 mb-2 flex items-baseline gap-2 bg-[color-mix(in_oklab,var(--bg),transparent_6%)] px-1 py-1 backdrop-blur-sm">
        <h2 className={cn('text-sm font-semibold', today ? 'text-accent-text' : 'text-text')}>{rel}</h2>
        {rel !== full && <span className="text-xs text-text-3">{full}</span>}
        {secondary && <span className="text-xs text-text-3">· {secondary}</span>}
        <span className="flex-1" />
        <button
          type="button"
          onClick={() => onCreate(new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59), false)}
          aria-label={t('cal.newOn', { date: full })}
          className="inline-flex size-7 items-center justify-center rounded-control text-text-3 hover:bg-surface-3 hover:text-text"
        >
          <CalendarPlus size={15} />
        </button>
      </header>
      {events.length === 0 ? (
        <p className="py-2 text-sm text-text-3">{t('board.emptyColumn')}</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {events.map((e) => (
            <AgendaRow key={e.id} event={e} onOpen={onOpen} />
          ))}
        </ul>
      )}
    </section>
  );
}

function AgendaRow({ event, onOpen, showDate }: { event: CalEvent; onOpen: (id: string) => void; showDate?: boolean }) {
  const t = useT();
  const lang = useI18n((s) => s.lang);
  const exam = event.card.is_exam;
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(event.id)}
        className={cn(
          'relative flex w-full items-center gap-3 rounded-card border bg-surface-2 py-2.5 ps-4 pe-3 text-start transition-colors hover:border-border-strong',
          exam && !event.done ? 'border-border-strong' : 'border-border',
        )}
      >
        <span
          aria-hidden
          className="absolute inset-y-2 start-0 rounded-full"
          style={{ background: event.overdue ? 'var(--danger)' : event.color, width: exam ? 4 : 3, opacity: event.done ? 0.5 : 1 }}
        />
        <span className={cn('w-16 shrink-0 text-xs whitespace-nowrap tabular', event.overdue ? 'text-danger' : 'text-text-3')}>
          {showDate ? relativeDay(event.start, lang) : event.allDay ? t('cal.allDay') : formatTime(event.start, lang)}
        </span>
        <span className="min-w-0 flex-1">
          <span className={cn('block truncate text-base', event.done ? 'text-text-3' : 'text-text')} dir="auto">
            {event.card.title}
          </span>
          {(event.subject || exam) && (
            <span className="mt-0.5 flex items-center gap-2 text-xs text-text-3">
              {exam && (
                <span className="inline-flex items-center gap-1 font-medium" style={{ color: event.color }}>
                  <Flag size={11} aria-hidden />
                  {t('board.exam')}
                </span>
              )}
              {event.subject && <span className="truncate">{event.subject.name}</span>}
            </span>
          )}
        </span>
        {event.done && <span className="shrink-0 text-xs text-text-3">{t('bucket.done')}</span>}
      </button>
    </li>
  );
}
