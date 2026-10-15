import { describe, expect, it } from 'vitest';
import { nextReminder, reminderTimes, remindersBetween } from './compute';

const card = (over = {}) => ({
  id: 'c1',
  due_at: new Date(2026, 9, 15, 17, 0).toISOString(),
  due_has_time: true,
  completed_at: null,
  deleted_at: null,
  ...over,
});
const hm = (d: Date) => `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;

describe('reminderTimes', () => {
  it('timed card: 1 day and 1 hour before', () => {
    expect(reminderTimes(card(), [1440, 60]).map((r) => hm(r.fireAt))).toEqual(['10/14 17:00', '10/15 16:00']);
  });
  it('per-card offsets override defaults; [] means off', () => {
    expect(reminderTimes(card({ reminder_offsets: [10] }), [1440]).map((r) => hm(r.fireAt))).toEqual(['10/15 16:50']);
    expect(reminderTimes(card({ reminder_offsets: [] }), [1440])).toEqual([]);
  });
  it('date-only card: same-day offsets collapse to 08:00, day offsets keep 08:00', () => {
    const c = card({ due_at: new Date(2026, 9, 15, 23, 59).toISOString(), due_has_time: false });
    expect(reminderTimes(c, [60, 10, 1440]).map((r) => hm(r.fireAt))).toEqual(['10/14 8:00', '10/15 8:00']);
  });
  it('done, deleted and undated cards have no reminders', () => {
    expect(reminderTimes(card({ completed_at: 'x' }), [60])).toEqual([]);
    expect(reminderTimes(card({ deleted_at: 'x' }), [60])).toEqual([]);
    expect(reminderTimes(card({ due_at: null }), [60])).toEqual([]);
  });
  it('keys change when the due date changes, so a rescheduled card reminds again', () => {
    const a = reminderTimes(card(), [60])[0]!.key;
    const b = reminderTimes(card({ due_at: new Date(2026, 9, 16, 17).toISOString() }), [60])[0]!.key;
    expect(a).not.toBe(b);
  });
});

describe('windows', () => {
  const cards = [card(), card({ id: 'c2', due_at: new Date(2026, 9, 15, 18, 0).toISOString() })];
  it('remindersBetween is exclusive of start, inclusive of end', () => {
    const from = new Date(2026, 9, 15, 16, 0);
    const to = new Date(2026, 9, 15, 17, 0);
    expect(remindersBetween(cards, [60], from, to).map((r) => r.cardId)).toEqual(['c2']);
  });
  it('nextReminder picks the soonest future one', () => {
    expect(nextReminder(cards, [60], new Date(2026, 9, 15, 15, 0))?.cardId).toBe('c1');
    expect(nextReminder(cards, [60], new Date(2026, 9, 15, 16, 30))?.cardId).toBe('c2');
    expect(nextReminder(cards, [60], new Date(2026, 9, 16))).toBeNull();
  });
});
