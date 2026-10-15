import { addDays, startOfDay, startOfWeek, type WeekStart } from '@/lib/dates';

export type CalendarView = 'day' | 'week' | 'month' | 'agenda';

/** Days shown in a month view: whole weeks covering the month (4–6 rows). */
export function monthGrid(anchor: Date, weekStart: WeekStart): Date[] {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const start = startOfWeek(first, weekStart);
  const daysInMonth = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate();
  const lead = Math.round((first.getTime() - start.getTime()) / 86_400_000);
  const rows = Math.ceil((lead + daysInMonth) / 7);
  return Array.from({ length: rows * 7 }, (_, i) => addDays(start, i));
}

export function weekDays(anchor: Date, weekStart: WeekStart): Date[] {
  const start = startOfWeek(anchor, weekStart);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** Visible range [start, end) for a view. Agenda shows the next 60 days. */
export function rangeFor(view: CalendarView, anchor: Date, weekStart: WeekStart): { start: Date; end: Date } {
  if (view === 'day') return { start: startOfDay(anchor), end: addDays(startOfDay(anchor), 1) };
  if (view === 'week') {
    const s = startOfWeek(anchor, weekStart);
    return { start: s, end: addDays(s, 7) };
  }
  if (view === 'month') {
    const days = monthGrid(anchor, weekStart);
    return { start: days[0]!, end: addDays(days[days.length - 1]!, 1) };
  }
  return { start: startOfDay(anchor), end: addDays(startOfDay(anchor), 60) };
}

/** Move the anchor one page forward/back. Month steps keep the day within the target month. */
export function shiftAnchor(view: CalendarView, anchor: Date, dir: 1 | -1): Date {
  if (view === 'day') return addDays(anchor, dir);
  if (view === 'week') return addDays(anchor, 7 * dir);
  if (view === 'agenda') return addDays(anchor, 30 * dir);
  const target = new Date(anchor.getFullYear(), anchor.getMonth() + dir, 1);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return new Date(target.getFullYear(), target.getMonth(), Math.min(anchor.getDate(), last));
}

export interface Timed {
  id: string;
  start: number; // minutes from midnight
  end: number;
}

export interface Placed {
  id: string;
  lane: number;
  lanes: number;
}

/**
 * Side-by-side layout for overlapping events in one day column.
 * Events that overlap (directly or through a chain) form a cluster sharing the same lane count.
 */
export function layoutDay(events: Timed[]): Map<string, Placed> {
  const sorted = [...events].sort((a, b) => a.start - b.start || b.end - a.end);
  const out = new Map<string, Placed>();
  let cluster: { id: string; lane: number }[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    const lanes = laneEnds.length;
    for (const c of cluster) out.set(c.id, { id: c.id, lane: c.lane, lanes });
    cluster = [];
    laneEnds = [];
  };

  for (const e of sorted) {
    if (e.start >= clusterEnd) flush();
    let lane = laneEnds.findIndex((end) => end <= e.start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(e.end);
    } else laneEnds[lane] = e.end;
    cluster.push({ id: e.id, lane });
    clusterEnd = Math.max(clusterEnd === -Infinity ? e.end : clusterEnd, e.end);
  }
  flush();
  return out;
}

export function minutesOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

/** Snap minutes to a step (default 15). */
export function snap(minutes: number, step = 15): number {
  return Math.round(minutes / step) * step;
}

export function toDateParam(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function fromDateParam(s: string | null): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}
