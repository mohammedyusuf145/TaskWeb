import { describe, expect, it } from 'vitest';
import { parseQuickAdd, normalizeDigits } from './parse';

// Sunday 11 Oct 2026, 14:00 local
const now = new Date(2026, 9, 11, 14, 0);
const subjects = [
  { id: 'math', name: 'Math' },
  { id: 'phys', name: 'Physics' },
  { id: 'ar-math', name: 'الرياضيات' },
  { id: 'ar-ar', name: 'اللغة العربية' },
  { id: 'chem', name: 'الكيمياء' },
];
const p = (s: string) => parseQuickAdd(s, { now, subjects });
const ymdhm = (d: Date | null) =>
  d && `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

describe('quick-add: English', () => {
  it('the canonical example', () => {
    const r = p('Math homework tomorrow 5pm');
    expect(r.title).toBe('Math homework');
    expect(ymdhm(r.dueAt)).toBe('2026-10-12 17:00');
    expect(r.hasTime).toBe(true);
    expect(r.subjectId).toBe('math');
  });
  it('date only is end of day, no time', () => {
    const r = p('Read chapter 4 tomorrow');
    expect(ymdhm(r.dueAt)).toBe('2026-10-12 23:59');
    expect(r.hasTime).toBe(false);
    expect(r.title).toBe('Read chapter 4');
  });
  it('weekday: nearest occurrence, today included', () => {
    expect(ymdhm(p('quiz thursday').dueAt)).toBe('2026-10-15 23:59');
    expect(ymdhm(p('essay sunday').dueAt)).toBe('2026-10-11 23:59');
    expect(ymdhm(p('essay next sunday').dueAt)).toBe('2026-10-18 23:59');
    expect(ymdhm(p('lab on thu at 7:30am').dueAt)).toBe('2026-10-15 07:30');
  });
  it('relative days and weeks', () => {
    expect(ymdhm(p('project in 3 days').dueAt)).toBe('2026-10-14 23:59');
    expect(ymdhm(p('project in 2 weeks').dueAt)).toBe('2026-10-25 23:59');
    expect(ymdhm(p('revise day after tomorrow').dueAt)).toBe('2026-10-13 23:59');
    expect(ymdhm(p('plan next week').dueAt)).toBe('2026-10-18 23:59');
  });
  it('explicit dates are day-first; past dates roll to next year', () => {
    expect(ymdhm(p('exam 20/10').dueAt)).toBe('2026-10-20 23:59');
    expect(ymdhm(p('exam 5/1').dueAt)).toBe('2027-1-5 23:59');
    expect(ymdhm(p('exam 20/10/2026 9am').dueAt)).toBe('2026-10-20 09:00');
    expect(ymdhm(p('exam 2026-11-02').dueAt)).toBe('2026-11-2 23:59');
    expect(ymdhm(p('exam Oct 20').dueAt)).toBe('2026-10-20 23:59');
    expect(ymdhm(p('exam 3 nov').dueAt)).toBe('2026-11-3 23:59');
  });
  it('times', () => {
    expect(ymdhm(p('call at 5').dueAt)).toBe('2026-10-11 17:00');
    expect(ymdhm(p('call 16:30').dueAt)).toBe('2026-10-11 16:30');
    expect(ymdhm(p('call 9am').dueAt)).toBe('2026-10-12 09:00'); // 9am already passed today
    expect(ymdhm(p('tonight review').dueAt)).toBe('2026-10-11 20:00');
    expect(ymdhm(p('lunch noon tomorrow').dueAt)).toBe('2026-10-12 12:00');
  });
  it('priority, labels, estimate, exam', () => {
    const r = p('Unit 3 test friday !high #revision 45m');
    expect(r.priority).toBe('high');
    expect(r.labels).toEqual(['revision']);
    expect(r.estimateMin).toBe(45);
    expect(r.isExam).toBe(true);
    expect(r.title).toBe('Unit 3 test');
    expect(p('worksheet !! 1.5h').estimateMin).toBe(90);
    expect(p('worksheet !low').priority).toBe('low');
  });
  it('@subject and #subject tokens are removed from the title', () => {
    const r = p('worksheet @physics tomorrow');
    expect(r.subjectId).toBe('phys');
    expect(r.title).toBe('Worksheet');
    expect(p('#math drills').subjectId).toBe('math');
  });
  it('leaves a plain title alone', () => {
    const r = p('Buy a new notebook');
    expect(r).toMatchObject({ title: 'Buy a new notebook', dueAt: null, subjectId: null, priority: null, isExam: false });
  });
  it('does not mistake words containing day names', () => {
    expect(p('Monitor the experiment').dueAt).toBeNull();
    expect(p('Saturn rings poster').dueAt).toBeNull();
  });
});

describe('quick-add: Arabic', () => {
  it('واجب الرياضيات بكرة الساعة 5', () => {
    const r = p('واجب الرياضيات بكرة الساعة 5');
    expect(r.title).toBe('واجب الرياضيات');
    expect(ymdhm(r.dueAt)).toBe('2026-10-12 17:00');
    expect(r.subjectId).toBe('ar-math');
  });
  it('spelling variants of tomorrow, with diacritics', () => {
    expect(ymdhm(p('مراجعة غدًا').dueAt)).toBe('2026-10-12 23:59');
    expect(ymdhm(p('مراجعة غداً').dueAt)).toBe('2026-10-12 23:59');
    expect(ymdhm(p('مراجعة باچر').dueAt)).toBe('2026-10-12 23:59');
    expect(ymdhm(p('مراجعة بعد بكرة').dueAt)).toBe('2026-10-13 23:59');
  });
  it('weekdays with and without يوم / ال, and القادم', () => {
    expect(ymdhm(p('اختبار يوم الخميس').dueAt)).toBe('2026-10-15 23:59');
    expect(ymdhm(p('اختبار الخميس').dueAt)).toBe('2026-10-15 23:59');
    expect(ymdhm(p('اختبار الأحد').dueAt)).toBe('2026-10-11 23:59');
    expect(ymdhm(p('اختبار الأحد القادم').dueAt)).toBe('2026-10-18 23:59');
    expect(ymdhm(p('مشروع الإثنين').dueAt)).toBe('2026-10-12 23:59');
  });
  it('times with صباحاً / مساءً and Arabic-Indic digits', () => {
    expect(ymdhm(p('درس خصوصي غدا ٧ مساءً').dueAt)).toBe('2026-10-12 19:00');
    expect(ymdhm(p('درس غدا 8 صباحا').dueAt)).toBe('2026-10-12 08:00');
    expect(ymdhm(p('درس الليلة').dueAt)).toBe('2026-10-11 20:00');
    expect(ymdhm(p('درس بعد 3 أيام').dueAt)).toBe('2026-10-14 23:59');
    expect(ymdhm(p('درس بعد يومين').dueAt)).toBe('2026-10-13 23:59');
    expect(ymdhm(p('مشروع الأسبوع الجاي').dueAt)).toBe('2026-10-18 23:59');
  });
  it('exam, priority, estimate', () => {
    const r = p('امتحان الكيمياء الخميس عاجل 45 دقيقة');
    expect(r.isExam).toBe(true);
    expect(r.priority).toBe('high');
    expect(r.estimateMin).toBe(45);
    expect(r.subjectId).toBe('chem');
    expect(r.title).toBe('امتحان الكيمياء');
  });
  it('"الساعة" as a time is not read as a one-hour estimate', () => {
    const r = p('مذاكرة الساعة 4');
    expect(r.estimateMin).toBeNull();
    expect(ymdhm(r.dueAt)).toBe('2026-10-11 16:00');
    expect(p('مذاكرة ساعة').estimateMin).toBe(60);
  });
  it('subject with definite article prefix', () => {
    expect(p('واجب للعربية').subjectId).toBeNull(); // "العربية" alone is not the subject name
    expect(p('تلخيص اللغة العربية').subjectId).toBe('ar-ar');
  });
});

describe('normalizeDigits', () => {
  it('converts Arabic-Indic and Persian digits', () => {
    expect(normalizeDigits('٠١٢٣٤٥٦٧٨٩ ۴۵')).toBe('0123456789 45');
  });
});
