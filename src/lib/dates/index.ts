import type { Lang } from '@/lib/i18n';
import { intlLocale } from '@/lib/i18n';

export type WeekStart = 0 | 1 | 6; // Sunday, Monday, Saturday
export type CalendarSystem = 'gregorian' | 'hijri';

/** Start of the week containing `date`, at local midnight. */
export function startOfWeek(date: Date, weekStart: WeekStart): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diff = (d.getDay() - weekStart + 7) % 7;
  d.setDate(d.getDate() - diff);
  return d;
}

/** The seven weekday indexes (0 = Sunday) in display order. */
export function weekdayOrder(weekStart: WeekStart): number[] {
  return Array.from({ length: 7 }, (_, i) => (weekStart + i) % 7);
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Whole calendar days from `from` to `to` (negative if `to` is earlier). DST-safe. */
export function dayDiff(from: Date, to: Date): number {
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b - a) / 86_400_000);
}

function calendarTag(system: CalendarSystem): string {
  return system === 'hijri' ? '-u-ca-islamic-umalqura' : '';
}

/** Intl locale for a language + calendar system, always with Western digits. */
export function calendarLocale(lang: Lang, system: CalendarSystem): string {
  return localeFor(lang, system);
}

function localeFor(lang: Lang, system: CalendarSystem): string {
  // Combine the numbering-system extension with the calendar extension.
  const base = intlLocale(lang); // e.g. ar-BH-u-nu-latn
  if (system === 'gregorian') return base;
  return base.includes('-u-') ? base.replace('-u-', '-u-ca-islamic-umalqura-') : base + calendarTag(system);
}

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function fmt(locale: string, opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = locale + JSON.stringify(opts);
  let f = fmtCache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(locale, opts);
    fmtCache.set(key, f);
  }
  return f;
}

export interface DateDisplayPrefs {
  lang: Lang;
  primary: CalendarSystem;
  showSecondary: boolean;
}

/** "Thu 16 Oct" style date in the chosen calendar. */
export function formatDate(date: Date, lang: Lang, system: CalendarSystem = 'gregorian'): string {
  return fmt(localeFor(lang, system), { weekday: 'short', day: 'numeric', month: 'short' }).format(date);
}

export function formatDateLong(date: Date, lang: Lang, system: CalendarSystem = 'gregorian'): string {
  return fmt(localeFor(lang, system), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}

/** Day + month only, e.g. "24 Rabiʻ II" — used as the secondary line. */
export function formatDayMonth(date: Date, lang: Lang, system: CalendarSystem): string {
  return fmt(localeFor(lang, system), { day: 'numeric', month: 'long' }).format(date);
}

export function formatTime(date: Date, lang: Lang): string {
  return fmt(intlLocale(lang), { hour: 'numeric', minute: '2-digit' }).format(date);
}

/** Primary date plus optional secondary calendar, per user prefs. */
export function formatDual(date: Date, prefs: DateDisplayPrefs): { primary: string; secondary?: string } {
  const primary = formatDate(date, prefs.lang, prefs.primary);
  if (!prefs.showSecondary) return { primary };
  const other: CalendarSystem = prefs.primary === 'gregorian' ? 'hijri' : 'gregorian';
  return { primary, secondary: formatDayMonth(date, prefs.lang, other) };
}

/** Hijri (Umm al-Qura) year/month/day numbers for `date`. */
export function hijriParts(date: Date): { year: number; month: number; day: number } {
  const parts = fmt('en-u-ca-islamic-umalqura-nu-latn', { year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value.replace(/\D/g, '') ?? 0);
  return { year: get('year'), month: get('month'), day: get('day') };
}

/** Weekday name for a weekday index (0 = Sunday). */
export function weekdayName(index: number, lang: Lang, style: 'long' | 'short' | 'narrow' = 'long'): string {
  // 2023-01-01 was a Sunday.
  return fmt(intlLocale(lang), { weekday: style }).format(new Date(2023, 0, 1 + index));
}

/** Relative day label: today / tomorrow / yesterday / formatted date. */
export function relativeDay(date: Date, lang: Lang, now = new Date(), system: CalendarSystem = 'gregorian'): string {
  const diff = dayDiff(now, date);
  if (Math.abs(diff) <= 1) {
    return new Intl.RelativeTimeFormat(intlLocale(lang), { numeric: 'auto' }).format(diff, 'day');
  }
  return formatDate(date, lang, system);
}

/** Local date as YYYY-MM-DD (for <input type="date">). */
export function toDateInputValue(date: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

export function fromDateInputValue(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}
