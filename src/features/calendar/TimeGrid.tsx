import { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import { DndContext, DragOverlay, useDraggable, useDroppable, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core';
import { Flag } from 'lucide-react';
import { useI18n, useT, intlLocale } from '@/lib/i18n';
import { formatDayMonth, formatTime, isSameDay, type CalendarSystem } from '@/lib/dates';
import { cn } from '@/lib/cn';
import type { CalEvent } from './events';
import { eventsOnDay } from './events';
import { EventChip, eventLabel } from './EventChip';
import { layoutDay, minutesOfDay, snap, toDateParam } from './grid';
import { snapY, useCalendarSensors, useStep } from './dnd';

const PX_PER_MIN = 0.8; // 48px per hour
const SLOT = 15;
const GUTTER = 56;

export interface DatePrefs {
  primary: CalendarSystem;
  showSecondary: boolean;
}

interface Props {
  days: Date[];
  events: CalEvent[];
  now: Date;
  prefs: DatePrefs;
  onOpen: (id: string) => void;
  onCreate: (at: Date, hasTime: boolean) => void;
  onReschedule: (event: CalEvent, at: Date, hasTime: boolean) => void;
  onDayClick: (day: Date) => void;
}

export function TimeGrid({ days, events, now, prefs, onOpen, onCreate, onReschedule, onDayClick }: Props) {
  const t = useT();
  const lang = useI18n((s) => s.lang);
  const scrollRef = useRef<HTMLDivElement>(null);
  const columnRef = useRef<HTMLDivElement>(null);
  const step = useStep({ x: 120, y: SLOT * PX_PER_MIN });
  const sensors = useCalendarSensors(step);
  const [active, setActive] = useState<CalEvent | null>(null);
  const justDragged = useRef(0);

  // Keyboard steps follow the real column width.
  useEffect(() => {
    const measure = () => {
      if (columnRef.current) step.current = { x: columnRef.current.getBoundingClientRect().width, y: SLOT * PX_PER_MIN };
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [days.length, step]);

  // Open scrolled to an hour before now (today in view) or to 7:00.
  const dayKey = days.map(toDateParam).join();
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const showsToday = days.some((d) => isSameDay(d, now));
    const firstEvent = events.find((e) => !e.allDay && days.some((d) => isSameDay(d, e.start)));
    const minutes = showsToday ? minutesOfDay(now) - 90 : firstEvent ? minutesOfDay(firstEvent.start) - 60 : 7 * 60;
    el.scrollTop = Math.max(0, minutes * PX_PER_MIN);
  }, [dayKey]);

  const perDay = useMemo(() => days.map((d) => eventsOnDay(events, d)), [days, events]);
  const hasAllDay = perDay.some((list) => list.some((e) => e.allDay));
  const hours = useMemo(() => Array.from({ length: 24 }, (_, h) => h), []);
  const hourFmt = useMemo(() => new Intl.DateTimeFormat(intlLocale(lang), { hour: 'numeric' }), [lang]);

  function onDragStart(e: DragStartEvent) {
    setActive((e.active.data.current?.event as CalEvent) ?? null);
  }

  function onDragEnd({ active: a, over, delta }: DragEndEvent) {
    setActive(null);
    justDragged.current = Date.now();
    const ev = a.data.current?.event as CalEvent | undefined;
    const target = over?.data.current as { type: 'slot' | 'allday'; date: Date } | undefined;
    if (!ev || !target || !over) return;
    const day = target.date;
    if (target.type === 'allday') {
      if (ev.allDay && isSameDay(ev.start, day)) return;
      return onReschedule(ev, new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59), false);
    }
    // Timed events move by the drag distance (robust to auto-scroll while dragging);
    // all-day chips dropped into the grid take the time under their top edge.
    const raw = ev.allDay
      ? ((a.rect.current.translated?.top ?? 0) - over.rect.top) / PX_PER_MIN
      : minutesOfDay(ev.start) + delta.y / PX_PER_MIN;
    const minutes = Math.min(24 * 60 - SLOT, Math.max(0, snap(raw, SLOT)));
    const at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), Math.floor(minutes / 60), minutes % 60);
    if (!ev.allDay && at.getTime() === ev.start.getTime()) return;
    onReschedule(ev, at, true);
  }

  const open = (id: string) => Date.now() - justDragged.current > 250 && onOpen(id);
  const multi = days.length > 1;

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActive(null)} accessibility={{ screenReaderInstructions: { draggable: t('dnd.instructions') } }}>
      <div className="flex min-h-0 flex-1 flex-col overflow-x-auto">
        <div className="flex min-h-0 flex-1 flex-col" style={{ minWidth: multi ? 640 : undefined }}>
          {/* Day headers */}
          <div className="flex shrink-0 border-b border-border">
            <div style={{ width: GUTTER }} className="shrink-0" />
            {days.map((d) => {
              const today = isSameDay(d, now);
              const secondary = prefs.showSecondary ? formatDayMonth(d, lang, prefs.primary === 'gregorian' ? 'hijri' : 'gregorian') : null;
              return (
                <button
                  key={d.toISOString()}
                  type="button"
                  onClick={() => onDayClick(d)}
                  className="flex min-w-0 flex-1 flex-col items-center gap-0.5 border-s border-border py-2 hover:bg-surface-1"
                  aria-current={today ? 'date' : undefined}
                >
                  <span className={cn('text-xs', today ? 'text-accent-text' : 'text-text-3')}>
                    {new Intl.DateTimeFormat(intlLocale(lang), { weekday: multi ? 'short' : 'long' }).format(d)}
                  </span>
                  <span
                    className={cn(
                      'inline-flex h-8 min-w-8 items-center justify-center rounded-full px-1.5 text-lg font-semibold tabular',
                      today ? 'bg-accent text-accent-ink' : 'text-text',
                    )}
                  >
                    {prefs.primary === 'hijri' ? formatDayMonth(d, lang, 'hijri').split(' ')[0] : d.getDate()}
                  </span>
                  {secondary && <span className="max-w-full truncate px-1 text-[11px] text-text-3">{secondary}</span>}
                </button>
              );
            })}
          </div>

          {/* All-day row */}
          <div className="flex shrink-0 border-b border-border">
            <div style={{ width: GUTTER }} className="flex shrink-0 items-start justify-end pe-2 pt-1.5 text-[11px] text-text-3">
              {t('cal.allDay')}
            </div>
            {days.map((d, i) => (
              <AllDayCell key={d.toISOString()} day={d} events={perDay[i]!.filter((e) => e.allDay)} onOpen={open} onCreate={onCreate} compact={!hasAllDay} />
            ))}
          </div>

          {/* Timed grid */}
          <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div className="relative flex" style={{ height: 24 * 60 * PX_PER_MIN }}>
              <div style={{ width: GUTTER }} className="relative shrink-0">
                {hours.slice(1).map((h) => (
                  <span key={h} className="absolute end-2 -translate-y-1/2 text-[11px] text-text-3 tabular" style={{ top: h * 60 * PX_PER_MIN }}>
                    {hourFmt.format(new Date(2026, 0, 1, h))}
                  </span>
                ))}
              </div>
              {days.map((d, i) => (
                <DayColumn
                  key={d.toISOString()}
                  ref={i === 0 ? columnRef : undefined}
                  day={d}
                  events={perDay[i]!.filter((e) => !e.allDay)}
                  now={now}
                  onOpen={open}
                  onCreate={onCreate}
                  activeId={active?.id}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
      <DragOverlay modifiers={[snapY(SLOT * PX_PER_MIN)]} dropAnimation={null}>
        {active ? (
          active.allDay ? (
            <div className="w-40">
              <EventChip event={active} onOpen={() => {}} draggable={false} />
            </div>
          ) : (
            <BlockBody event={active} height={Math.max(22, ((active.end.getTime() - active.start.getTime()) / 60_000) * PX_PER_MIN)} lifted />
          )
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function AllDayCell({ day, events, onOpen, onCreate, compact }: { day: Date; events: CalEvent[]; onOpen: (id: string) => void; onCreate: Props['onCreate']; compact: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: `allday:${toDateParam(day)}`, data: { type: 'allday', date: day } });
  return (
    <div
      ref={setNodeRef}
      onClick={() => onCreate(new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59), false)}
      className={cn('flex min-w-0 flex-1 cursor-pointer flex-col gap-1 border-s border-border p-1', compact ? 'min-h-7' : 'min-h-9', isOver && 'bg-accent-soft')}
    >
      {events.map((e) => (
        <EventChip key={e.id} event={e} onOpen={onOpen} />
      ))}
    </div>
  );
}


const DayColumn = forwardRef<
  HTMLDivElement,
  { day: Date; events: CalEvent[]; now: Date; onOpen: (id: string) => void; onCreate: Props['onCreate']; activeId?: string }
>(function DayColumn({ day, events, now, onOpen, onCreate, activeId }, ref) {
  const { setNodeRef, isOver } = useDroppable({ id: `slot:${toDateParam(day)}`, data: { type: 'slot', date: day } });
  const layout = useMemo(
    () => layoutDay(events.map((e) => ({ id: e.id, start: minutesOfDay(e.start), end: minutesOfDay(e.start) + Math.max(30, (e.end.getTime() - e.start.getTime()) / 60_000) }))),
    [events],
  );
  const today = isSameDay(day, now);

  return (
    <div
      ref={(el) => {
        setNodeRef(el);
        if (typeof ref === 'function') ref(el);
        else if (ref) ref.current = el;
      }}
      role="presentation"
      onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const minutes = Math.min(24 * 60 - 30, Math.max(0, Math.floor((e.clientY - rect.top) / PX_PER_MIN / 30) * 30));
        onCreate(new Date(day.getFullYear(), day.getMonth(), day.getDate(), Math.floor(minutes / 60), minutes % 60), true);
      }}
      className={cn('relative min-w-0 flex-1 cursor-cell border-s border-border', today && 'bg-[color-mix(in_oklab,var(--accent)_3%,transparent)]', isOver && 'bg-accent-soft')}
      style={{
        backgroundImage: `repeating-linear-gradient(to bottom, var(--border) 0, var(--border) 1px, transparent 1px, transparent ${60 * PX_PER_MIN}px)`,
      }}
    >
      {events.map((e) => {
        const place = layout.get(e.id)!;
        return <EventBlock key={e.id} event={e} lane={place.lane} lanes={place.lanes} onOpen={onOpen} hidden={activeId === e.id} />;
      })}
      {today && (
        <div aria-hidden className="pointer-events-none absolute inset-x-0 z-20 flex items-center" style={{ top: minutesOfDay(now) * PX_PER_MIN }}>
          <span className="-ms-1 size-2 rounded-full bg-accent" />
          <span className="h-px flex-1 bg-accent" />
        </div>
      )}
    </div>
  );
});

function EventBlock({ event, lane, lanes, onOpen, hidden }: { event: CalEvent; lane: number; lanes: number; onOpen: (id: string) => void; hidden: boolean }) {
  const t = useT();
  const lang = useI18n((s) => s.lang);
  const { setNodeRef, attributes, listeners } = useDraggable({ id: event.id, data: { event } });
  const top = minutesOfDay(event.start) * PX_PER_MIN;
  const height = Math.max(22, ((event.end.getTime() - event.start.getTime()) / 60_000) * PX_PER_MIN);
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
      className="absolute z-10 cursor-pointer touch-manipulation rounded-chip focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
      style={{
        top,
        height,
        insetInlineStart: `calc(${(lane / lanes) * 100}% + 2px)`,
        width: `calc(${100 / lanes}% - 4px)`,
        opacity: hidden ? 0.35 : 1,
      }}
    >
      <BlockBody event={event} height={height} />
    </div>
  );
}

function BlockBody({ event, height, lifted }: { event: CalEvent; height: number; lifted?: boolean }) {
  const lang = useI18n((s) => s.lang);
  const exam = event.card.is_exam;
  return (
    <div
      className={cn(
        'flex h-full flex-col overflow-hidden rounded-chip border-s-[3px] px-1.5 py-0.5 text-xs leading-tight',
        event.done ? 'text-text-3' : 'text-text',
        lifted && 'shadow-pop',
      )}
      style={{
        height,
        minWidth: lifted ? 140 : undefined,
        background: `color-mix(in oklab, ${event.color} ${exam ? 26 : 16}%, var(--surface-2))`,
        borderInlineStartColor: event.overdue ? 'var(--danger)' : event.color,
        opacity: event.done ? 0.6 : 1,
      }}
    >
      <span className="flex min-w-0 items-center gap-1 font-medium">
        {exam && <Flag size={11} className="shrink-0" style={{ color: event.color }} aria-hidden />}
        <span className="truncate" dir="auto">
          {event.card.title}
        </span>
      </span>
      {height >= 34 && <span className="truncate text-text-3 tabular">{formatTime(event.start, lang)}</span>}
    </div>
  );
}
