import { useMemo, useRef, useState, type ReactNode } from 'react';
import { DndContext, DragOverlay, useDroppable, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core';
import { useI18n, useT, intlLocale } from '@/lib/i18n';
import { formatDayMonth, hijriParts, isSameDay, weekdayOrder, type WeekStart } from '@/lib/dates';
import { useMediaQuery } from '@/lib/useMediaQuery';
import { cn } from '@/lib/cn';
import type { CalEvent } from './events';
import { eventsOnDay } from './events';
import { EventChip } from './EventChip';
import { monthGrid, toDateParam } from './grid';
import { useCalendarSensors, useStep } from './dnd';
import type { DatePrefs } from './TimeGrid';
import { AgendaDay } from './AgendaView';

const MAX_CHIPS = 3;

interface Props {
  anchor: Date;
  weekStart: WeekStart;
  events: CalEvent[];
  now: Date;
  prefs: DatePrefs;
  onOpen: (id: string) => void;
  onCreate: (at: Date, hasTime: boolean) => void;
  onReschedule: (event: CalEvent, at: Date, hasTime: boolean) => void;
  onDayClick: (day: Date) => void;
}

export function MonthView({ anchor, weekStart, events, now, prefs, onOpen, onCreate, onReschedule, onDayClick }: Props) {
  const t = useT();
  const lang = useI18n((s) => s.lang);
  const wide = useMediaQuery('(min-width: 768px)');
  const days = useMemo(() => monthGrid(anchor, weekStart), [anchor, weekStart]);
  const gridRef = useRef<HTMLDivElement>(null);
  const step = useStep({ x: 100, y: 100 });
  const sensors = useCalendarSensors(step);
  const [active, setActive] = useState<CalEvent | null>(null);
  const [selected, setSelected] = useState<Date>(() => (anchor.getMonth() === now.getMonth() ? now : anchor));
  const justDragged = useRef(0);
  const weekdayFmt = new Intl.DateTimeFormat(intlLocale(lang), { weekday: wide ? 'short' : 'narrow' });

  function measure() {
    const cell = gridRef.current?.querySelector('[data-cell]')?.getBoundingClientRect();
    if (cell) step.current = { x: cell.width, y: cell.height };
  }

  function onDragStart(e: DragStartEvent) {
    measure();
    setActive((e.active.data.current?.event as CalEvent) ?? null);
  }
  function onDragEnd({ active: a, over }: DragEndEvent) {
    setActive(null);
    justDragged.current = Date.now();
    const ev = a.data.current?.event as CalEvent | undefined;
    const day = (over?.data.current as { date: Date } | undefined)?.date;
    if (!ev || !day || isSameDay(day, ev.start)) return;
    const at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), ev.start.getHours(), ev.start.getMinutes());
    onReschedule(ev, at, !ev.allDay);
  }
  const open = (id: string) => Date.now() - justDragged.current > 250 && onOpen(id);

  const dayNumber = (d: Date) => (prefs.primary === 'hijri' ? hijriParts(d).day : d.getDate());
  const secondary = (d: Date) => {
    if (!prefs.showSecondary) return null;
    if (prefs.primary === 'gregorian') {
      const h = hijriParts(d).day;
      return h === 1 || isSameDay(d, days[0]!) ? formatDayMonth(d, lang, 'hijri') : String(h);
    }
    return d.getDate() === 1 ? formatDayMonth(d, lang, 'gregorian') : String(d.getDate());
  };

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActive(null)} accessibility={{ screenReaderInstructions: { draggable: t('dnd.instructions') } }}>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="grid shrink-0 grid-cols-7 border-b border-border" aria-hidden>
          {weekdayOrder(weekStart).map((w) => (
            <div key={w} className="py-2 text-center text-xs text-text-3">
              {weekdayFmt.format(new Date(2023, 0, 1 + w))}
            </div>
          ))}
        </div>
        <div
          ref={gridRef}
          role="grid"
          aria-label={new Intl.DateTimeFormat(intlLocale(lang), { month: 'long', year: 'numeric' }).format(anchor)}
          className={cn('grid grid-cols-7', wide ? 'min-h-0 flex-1 auto-rows-fr' : 'shrink-0')}
        >
          {days.map((d) => {
            const list = eventsOnDay(events, d);
            const inMonth = d.getMonth() === anchor.getMonth();
            const today = isSameDay(d, now);
            const isSelected = !wide && isSameDay(d, selected);
            return (
              <DayCell
                key={d.toISOString()}
                day={d}
                className={cn(!inMonth && 'bg-[color-mix(in_oklab,var(--surface-1),transparent_40%)]', isSelected && 'bg-surface-2')}
                onEmptyClick={() => (wide ? onCreate(new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59), false) : setSelected(d))}
              >
                <div className="flex items-center justify-between gap-1 px-1.5 pt-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (wide) onDayClick(d);
                      else setSelected(d);
                    }}
                    aria-current={today ? 'date' : undefined}
                    aria-label={new Intl.DateTimeFormat(intlLocale(lang), { weekday: 'long', day: 'numeric', month: 'long' }).format(d)}
                    className={cn(
                      'inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-medium tabular',
                      today ? 'bg-accent text-accent-ink' : inMonth ? 'text-text hover:bg-surface-3' : 'text-text-3 hover:bg-surface-3',
                    )}
                  >
                    {dayNumber(d)}
                  </button>
                  {wide && secondary(d) && <span className="truncate text-[10px] text-text-3">{secondary(d)}</span>}
                </div>
                {wide ? (
                  <div className="flex min-h-0 flex-col gap-0.5 p-1">
                    {list.slice(0, MAX_CHIPS).map((e) => (
                      <EventChip key={e.id} event={e} onOpen={open} />
                    ))}
                    {list.length > MAX_CHIPS && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDayClick(d);
                        }}
                        className="h-5 rounded-chip px-1.5 text-start text-[11px] text-text-3 hover:bg-surface-3 hover:text-text-2"
                      >
                        {t('cal.more', { n: list.length - MAX_CHIPS })}
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex h-3 items-center justify-center gap-0.5 pb-1" aria-hidden>
                    {list.slice(0, 4).map((e) => (
                      <span
                        key={e.id}
                        className={cn('rounded-full', e.card.is_exam ? 'size-1.5 ring-1 ring-offset-0' : 'size-1.5')}
                        style={{ background: e.overdue ? 'var(--danger)' : e.color, opacity: e.done ? 0.4 : 1 }}
                      />
                    ))}
                  </div>
                )}
              </DayCell>
            );
          })}
        </div>
        {!wide && (
          <div className="min-h-0 flex-1 overflow-y-auto border-t border-border px-4 py-3">
            <AgendaDay day={selected} events={eventsOnDay(events, selected)} now={now} onOpen={onOpen} onCreate={onCreate} prefs={prefs} />
          </div>
        )}
      </div>
      <DragOverlay dropAnimation={null}>{active ? <div className="w-44"><EventChip event={active} onOpen={() => {}} draggable={false} /></div> : null}</DragOverlay>
    </DndContext>
  );
}

function DayCell({ day, className, onEmptyClick, children }: { day: Date; className?: string; onEmptyClick: () => void; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `month:${toDateParam(day)}`, data: { date: day } });
  return (
    <div
      ref={setNodeRef}
      data-cell
      role="gridcell"
      onClick={onEmptyClick}
      className={cn('flex min-h-0 min-w-0 cursor-pointer flex-col border-b border-s border-border md:min-h-[96px]', className, isOver && '!bg-accent-soft')}
    >
      {children}
    </div>
  );
}
