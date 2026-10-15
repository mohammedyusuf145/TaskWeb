import type { RepeatRule } from '@/types/database';

/**
 * Next due date for a repeating card, strictly after `from` (usually the current due date).
 * Keeps the time of day. Weekly rules with weekdays pick the next listed weekday.
 * Returns null when the rule has ended.
 */
export function nextOccurrence(due: Date, rule: RepeatRule, now: Date = new Date()): Date | null {
  const interval = Math.max(1, Math.floor(rule.interval || 1));
  const step = (d: Date): Date => {
    const x = new Date(d);
    if (rule.freq === 'daily' || (rule.freq === 'custom' && !rule.weekdays?.length)) {
      x.setDate(x.getDate() + interval);
      return x;
    }
    const days = [...new Set(rule.weekdays?.length ? rule.weekdays : [d.getDay()])].sort((a, b) => a - b);
    // Next listed weekday later in the same week, else the first listed weekday `interval` weeks on.
    const later = days.find((w) => w > x.getDay());
    if (later !== undefined) {
      x.setDate(x.getDate() + (later - x.getDay()));
      return x;
    }
    x.setDate(x.getDate() + (7 - x.getDay()) + 7 * (interval - 1) + days[0]!);
    return x;
  };

  let next = step(due);
  // If the card was finished late, skip occurrences that are already in the past.
  for (let guard = 0; next.getTime() <= now.getTime() && guard < 1000; guard++) next = step(next);
  if (rule.until && next.getTime() > Date.parse(rule.until)) return null;
  return next;
}
