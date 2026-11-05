import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useI18n, useT } from '@/lib/i18n';
import { useMediaQuery } from '@/lib/useMediaQuery';
import { useHotkeys } from '@/lib/hotkeys';
import { calendarLocale, formatTime, relativeDay, startOfDay } from '@/lib/dates';
import { Button, IconButton, Segmented, Skeleton, toast } from '@/components/ui';
import { PageHeader } from '@/app/shell/PageHeader';
import { useSettings } from '@/features/settings/settings';
import { useQuickAdd } from '@/features/quick-add/store';
import { updateCard } from '@/features/boards/ops';
import { CardDetail } from '@/features/cards/CardDetail';
import { useCalendarEvents, type CalEvent } from '@/features/calendar/events';
import { fromDateParam, rangeFor, shiftAnchor, toDateParam, weekDays, type CalendarView } from '@/features/calendar/grid';
import { TimeGrid } from '@/features/calendar/TimeGrid';
import { MonthView } from '@/features/calendar/MonthView';
import { AgendaView } from '@/features/calendar/AgendaView';

const VIEWS: CalendarView[] = ['day', 'week', 'month', 'agenda'];

/** Ticks every minute so the "now" line and overdue state stay current. */
function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export function CalendarPage() {
  const t = useT();
  const lang = useI18n((s) => s.lang);
  const settings = useSettings();
  const wide = useMediaQuery('(min-width: 768px)');
  const [params, setParams] = useSearchParams();
  const now = useNow();

  const view: CalendarView = (VIEWS as string[]).includes(params.get('view') ?? '') ? (params.get('view') as CalendarView) : wide ? 'week' : 'agenda';
  const anchor = fromDateParam(params.get('date')) ?? startOfDay(now);
  const openCardId = params.get('card');
  const weekStart = settings.week_start;
  const prefs = { primary: settings.calendar_primary, showSecondary: settings.calendar_show_secondary };
  const { events } = useCalendarEvents(now);

  const update = (patch: Record<string, string | null>, replace = false) =>
    setParams(
      (p) => {
        for (const [k, v] of Object.entries(patch)) v === null ? p.delete(k) : p.set(k, v);
        return p;
      },
      { replace },
    );
  const setView = (v: CalendarView) => update({ view: v });
  const go = (d: Date) => update({ date: toDateParam(d) }, true);

  useHotkeys({
    t: () => go(startOfDay(new Date())),
    d: () => setView('day'),
    w: () => setView('week'),
    m: () => setView('month'),
    a: () => setView('agenda'),
    arrowleft: (e) => (e.target === document.body ? go(shiftAnchor(view, anchor, lang === 'ar' ? 1 : -1)) : undefined),
    arrowright: (e) => (e.target === document.body ? go(shiftAnchor(view, anchor, lang === 'ar' ? -1 : 1)) : undefined),
  });

  const title = useMemo(() => {
    const loc = calendarLocale(lang, settings.calendar_primary);
    const { start, end } = rangeFor(view, anchor, weekStart);
    const last = new Date(end.getTime() - 1);
    if (view === 'day') return new Intl.DateTimeFormat(loc, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(anchor);
    if (view === 'month') return new Intl.DateTimeFormat(loc, { month: 'long', year: 'numeric' }).format(anchor);
    const f = new Intl.DateTimeFormat(loc, { day: 'numeric', month: 'short', year: 'numeric' });
    return f.formatRange ? f.formatRange(start, last) : `${f.format(start)} – ${f.format(last)}`;
  }, [view, anchor, weekStart, lang, settings.calendar_primary]);

  const subtitle = useMemo(() => {
    if (!settings.calendar_show_secondary || view === 'agenda') return null;
    const loc = calendarLocale(lang, settings.calendar_primary === 'gregorian' ? 'hijri' : 'gregorian');
    const { start, end } = rangeFor(view === 'month' ? 'month' : view, anchor, weekStart);
    const mid = view === 'month' ? new Date(anchor.getFullYear(), anchor.getMonth(), 15) : start;
    const f = new Intl.DateTimeFormat(loc, { month: 'long', year: 'numeric' });
    const a = f.format(view === 'month' ? new Date(anchor.getFullYear(), anchor.getMonth(), 1) : mid);
    const b = f.format(view === 'month' ? new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0) : new Date(end.getTime() - 1));
    return a === b ? a : `${a} – ${b}`;
  }, [view, anchor, weekStart, lang, settings.calendar_primary, settings.calendar_show_secondary]);

  const openCard = (id: string) => update({ card: id });
  const create = (at: Date, hasTime: boolean) => useQuickAdd.getState().show({ dueAt: at.toISOString(), dueHasTime: hasTime });

  async function reschedule(ev: CalEvent, at: Date, hasTime: boolean) {
    const before = { due_at: ev.card.due_at, due_has_time: ev.card.due_has_time };
    await updateCard(ev.id, { due_at: at.toISOString(), due_has_time: hasTime });
    const when = `${relativeDay(at, lang, new Date())}${hasTime ? ` · ${formatTime(at, lang)}` : ''}`;
    toast(t('cal.moved', { when }), { tone: 'success', action: { label: t('c.undo'), onClick: () => void updateCard(ev.id, before) } });
  }

  const isToday = (() => {
    const { start, end } = rangeFor(view, anchor, weekStart);
    return now >= start && now < end;
  })();

  return (
    <div className="flex h-[calc(100dvh-var(--bottombar-h)-env(safe-area-inset-bottom))] flex-col md:h-dvh">
      <PageHeader title={t('nav.calendar')} />
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-border px-4 py-2.5 md:px-8">
        <div className="flex items-center gap-1">
          <Button size="sm" variant={isToday ? 'ghost' : 'secondary'} onClick={() => go(startOfDay(new Date()))} aria-keyshortcuts="t">
            {t('cal.today')}
          </Button>
          <IconButton size="sm" label={t('cal.prev')} icon={<ChevronLeft size={18} className="flip-rtl" />} onClick={() => go(shiftAnchor(view, anchor, -1))} />
          <IconButton size="sm" label={t('cal.next')} icon={<ChevronRight size={18} className="flip-rtl" />} onClick={() => go(shiftAnchor(view, anchor, 1))} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-md font-semibold text-text" aria-live="polite">
            {title}
          </h2>
          {subtitle && <p className="truncate text-xs text-text-3">{subtitle}</p>}
        </div>
        <Segmented<CalendarView>
          label={t('nav.calendar')}
          value={view}
          onValueChange={setView}
          options={VIEWS.map((v) => ({ value: v, label: t(`cal.view.${v}`) }))}
          className="max-sm:w-full"
        />
      </div>

      {events === undefined ? (
        <div className="flex flex-col gap-2 p-6" aria-busy="true">
          <Skeleton className="h-8" />
          <Skeleton className="h-64" />
        </div>
      ) : view === 'agenda' ? (
        <AgendaView events={events} from={anchor} now={now} prefs={prefs} onOpen={openCard} onCreate={create} />
      ) : view === 'month' ? (
        <MonthView
          anchor={anchor}
          weekStart={weekStart}
          events={events}
          now={now}
          prefs={prefs}
          onOpen={openCard}
          onCreate={create}
          onReschedule={reschedule}
          onDayClick={(d) => update({ view: 'day', date: toDateParam(d) })}
        />
      ) : (
        <TimeGrid
          days={view === 'day' ? [anchor] : weekDays(anchor, weekStart)}
          events={events}
          now={now}
          prefs={prefs}
          onOpen={openCard}
          onCreate={create}
          onReschedule={reschedule}
          onDayClick={(d) => update({ view: 'day', date: toDateParam(d) })}
        />
      )}

      <CardDetail cardId={openCardId} onClose={() => update({ card: null }, true)} />
    </div>
  );
}
