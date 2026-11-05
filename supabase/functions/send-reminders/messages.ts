// Localised push text. Kept separate so it can be unit-tested without Deno APIs.

export interface ReminderRow {
  card_id: string;
  board_id: string;
  title: string;
  is_exam: boolean;
  due_at: string;
  due_has_time: boolean;
  offset_min: number;
  subject_name: string | null;
  language: string;
  timezone: string;
}

function when(row: ReminderRow, ar: boolean): string {
  const m = row.offset_min;
  if (!row.due_has_time) {
    if (m === 0) return ar ? 'مستحقة اليوم' : 'Due today';
    const d = Math.round(m / 1440);
    if (d === 1) return ar ? 'مستحقة غدًا' : 'Due tomorrow';
    return ar ? `مستحقة بعد ${d} أيام` : `Due in ${d} days`;
  }
  const time = new Intl.DateTimeFormat(ar ? 'ar-BH-u-nu-latn' : 'en-GB', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: row.timezone || 'Asia/Bahrain',
  }).format(new Date(row.due_at));
  if (m === 0) return ar ? `حان الموعد · ${time}` : `Due now · ${time}`;
  if (m < 60) return ar ? `بعد ${m} دقيقة · ${time}` : `Due in ${m} min · ${time}`;
  if (m < 1440) {
    const h = Math.round(m / 60);
    return ar ? (h === 1 ? `بعد ساعة · ${time}` : `بعد ${h} ساعات · ${time}`) : `Due in ${h} h · ${time}`;
  }
  const d = Math.round(m / 1440);
  if (d === 1) return ar ? `غدًا · ${time}` : `Tomorrow · ${time}`;
  return ar ? `بعد ${d} أيام · ${time}` : `In ${d} days · ${time}`;
}

export function buildMessage(row: ReminderRow) {
  const ar = row.language === 'ar';
  const prefix = row.is_exam ? (ar ? 'اختبار: ' : 'Exam: ') : '';
  const body = [when(row, ar), row.subject_name].filter(Boolean).join(' · ');
  return {
    title: `${prefix}${row.title}`.slice(0, 120),
    body,
    tag: `card-${row.card_id}`,
    url: `/board/${row.board_id}?card=${row.card_id}`,
    lang: ar ? 'ar' : 'en',
    dir: ar ? 'rtl' : 'ltr',
  };
}
