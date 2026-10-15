import { intlLocale, type Lang } from '@/lib/i18n';
import { formatTime, relativeDay } from '@/lib/dates';

/** "in 1 hour" / "خلال ساعة", falling back to a day + time for longer gaps. */
export function dueRelative(due: Date, hasTime: boolean, lang: Lang, now = new Date()): string {
  const minutes = Math.round((due.getTime() - now.getTime()) / 60_000);
  if (hasTime && Math.abs(minutes) < 60 * 12) {
    const rtf = new Intl.RelativeTimeFormat(intlLocale(lang), { numeric: 'auto' });
    if (Math.abs(minutes) < 60) return rtf.format(minutes, 'minute');
    return rtf.format(Math.round(minutes / 60), 'hour');
  }
  const day = relativeDay(due, lang, now);
  return hasTime ? `${day} · ${formatTime(due, lang)}` : day;
}
