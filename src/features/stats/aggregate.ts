import type { FocusSession } from '@/types/database';
import { addDays, startOfDay } from '@/lib/dates';

/** A day counts toward the streak with at least this much focus. */
export const STREAK_MIN_MINUTES = 10;

type S = Pick<FocusSession, 'started_at' | 'ended_at' | 'focused_sec' | 'subject_id' | 'deleted_at' | 'completed'>;

export function dayKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const alive = <T extends { deleted_at: string | null }>(xs: T[]) => xs.filter((x) => !x.deleted_at);

/** Minutes per day (local), keyed by subject id ('none' for no subject). Sessions count on the day they started. */
export function minutesByDay(sessions: S[]): Map<string, Map<string, number>> {
  const out = new Map<string, Map<string, number>>();
  for (const s of alive(sessions)) {
    const k = dayKey(new Date(s.started_at));
    const subj = s.subject_id ?? 'none';
    const day = out.get(k) ?? new Map<string, number>();
    day.set(subj, (day.get(subj) ?? 0) + s.focused_sec / 60);
    out.set(k, day);
  }
  return out;
}

export function totalForDay(byDay: Map<string, Map<string, number>>, d: Date): number {
  let sum = 0;
  for (const v of byDay.get(dayKey(d))?.values() ?? []) sum += v;
  return sum;
}

/** Current streak (ending today, or yesterday if today has no focus yet) and best streak ever. */
export function streaks(sessions: S[], today: Date): { current: number; best: number } {
  const byDay = minutesByDay(sessions);
  const qualifying = new Set([...byDay.keys()].filter((k) => [...byDay.get(k)!.values()].reduce((a, b) => a + b, 0) >= STREAK_MIN_MINUTES));
  let current = 0;
  let cursor = startOfDay(today);
  if (!qualifying.has(dayKey(cursor))) cursor = addDays(cursor, -1);
  while (qualifying.has(dayKey(cursor))) {
    current++;
    cursor = addDays(cursor, -1);
  }
  let best = 0;
  let run = 0;
  let prev: Date | null = null;
  for (const k of [...qualifying].sort()) {
    const [y, m, d] = k.split('-').map(Number) as [number, number, number];
    const date = new Date(y, m - 1, d);
    run = prev && dayKey(addDays(prev, 1)) === k ? run + 1 : 1;
    best = Math.max(best, run);
    prev = date;
  }
  return { current, best: Math.max(best, current) };
}

/** Focus minutes per hour of day (0–23), splitting sessions across the hours they span. */
export function hourHistogram(sessions: S[]): number[] {
  const hours = new Array<number>(24).fill(0);
  for (const s of alive(sessions)) {
    const end = new Date(s.ended_at).getTime();
    const begin = end - s.focused_sec * 1000;
    let t = begin;
    while (t < end) {
      const d = new Date(t);
      const nextHour = new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours() + 1).getTime();
      const slice = Math.min(end, nextHour) - t;
      hours[d.getHours()]! += slice / 60_000;
      t += slice;
    }
  }
  return hours;
}

/** The two-hour window with the most focus, or null with no data. */
export function bestWindow(hist: number[]): { start: number; minutes: number } | null {
  let best: { start: number; minutes: number } | null = null;
  for (let h = 0; h < 24; h++) {
    const m = hist[h]! + hist[(h + 1) % 24]!;
    if (m > 0 && (!best || m > best.minutes)) best = { start: h, minutes: m };
  }
  return best;
}

export interface RangeSummary {
  minutes: number;
  sessions: number;
  activeDays: number;
  goalDays: number;
  bySubject: { subjectId: string; minutes: number }[];
}

export function summarize(sessions: S[], from: Date, to: Date, goalMin: number): RangeSummary {
  const inRange = alive(sessions).filter((s) => {
    const t = new Date(s.started_at);
    return t >= from && t < to;
  });
  const byDay = minutesByDay(inRange);
  const bySubject = new Map<string, number>();
  let minutes = 0;
  let goalDays = 0;
  for (const day of byDay.values()) {
    let dayTotal = 0;
    for (const [subj, m] of day) {
      bySubject.set(subj, (bySubject.get(subj) ?? 0) + m);
      dayTotal += m;
    }
    minutes += dayTotal;
    if (dayTotal >= goalMin) goalDays++;
  }
  return {
    minutes,
    sessions: inRange.length,
    activeDays: byDay.size,
    goalDays,
    bySubject: [...bySubject].map(([subjectId, m]) => ({ subjectId, minutes: m })).sort((a, b) => b.minutes - a.minutes),
  };
}

export function formatDuration(minutes: number, lang: 'ar' | 'en'): string {
  const m = Math.round(minutes);
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (lang === 'ar') return h ? (r ? `${h} س ${r} د` : `${h} س`) : `${r} د`;
  return h ? (r ? `${h}h ${r}m` : `${h}h`) : `${r}m`;
}
