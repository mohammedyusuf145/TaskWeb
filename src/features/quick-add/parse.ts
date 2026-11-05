/**
 * Quick-add parser: turns "Math homework tomorrow 5pm" or "واجب الرياضيات بكرة الساعة 5"
 * into card fields. Both languages are always parsed, whatever the UI language.
 *
 * Rules worth knowing:
 *  - Dates are day-first (15/10 = 15 October), as used in Bahrain.
 *  - A bare hour from 1 to 7 ("at 5", "الساعة 5") means the afternoon/evening.
 *  - A weekday means its nearest occurrence, today included; "next"/"القادم" skips today.
 *  - A time with no date means today, or tomorrow if that time has already passed.
 *  - A date with no time is due at the end of that day (due_has_time = false).
 *  - Subject words stay in the title; "#math" / "@math" tokens are removed.
 */

import type { Priority } from '@/types/database';

export interface ParseSubject {
  id: string;
  name: string;
}

export interface ParseContext {
  now: Date;
  subjects: ParseSubject[];
  weekStart?: 0 | 1 | 6;
}

export type TokenKind = 'date' | 'time' | 'subject' | 'priority' | 'label' | 'estimate' | 'exam';

export interface ParsedCard {
  title: string;
  dueAt: Date | null;
  hasTime: boolean;
  subjectId: string | null;
  priority: Priority | null;
  isExam: boolean;
  labels: string[];
  estimateMin: number | null;
  /** What was recognised, for the live preview. */
  tokens: { kind: TokenKind; text: string }[];
}

// Word boundaries that work for Arabic as well as Latin text.
const B = '(?<=^|[\\s،,.;(])';
const E = '(?=$|[\\s،,.;!?)])';

const AR_DIGITS = /[٠-٩۰-۹]/g;
export function normalizeDigits(s: string): string {
  return s.replace(AR_DIGITS, (d) => String((d.charCodeAt(0) & 0xf) % 10));
}

/** Strip Arabic diacritics/tatweel and unify alef/ya/ta-marbuta forms for matching. */
function foldArabic(s: string): string {
  return s
    .replace(/[ً-ْـ]/g, '')
    .replace(/[إأآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه');
}

const EN_WEEKDAYS: [RegExp, number][] = [
  [/sun(?:day)?/, 0],
  [/mon(?:day)?/, 1],
  [/tue(?:s|sday)?/, 2],
  [/wed(?:nesday)?/, 3],
  [/thu(?:r|rs|rsday)?/, 4],
  [/fri(?:day)?/, 5],
  [/sat(?:urday)?/, 6],
];
// Folded spellings (see foldArabic).
const AR_WEEKDAYS: [string, number][] = [
  ['احد', 0],
  ['اثنين', 1],
  ['ثلاثاء', 2],
  ['ثلاثا', 2],
  ['اربعاء', 3],
  ['اربعا', 3],
  ['خميس', 4],
  ['جمعه', 5],
  ['سبت', 6],
];
const EN_MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

interface State {
  text: string; // working copy (folded), matched spans blanked out
  original: string; // same length as text, original characters
  day: Date | null;
  time: { h: number; m: number } | null;
  tonight: boolean;
  out: ParsedCard;
}

/** Run a regex over the working text; on each match call fn, and blank the span if fn returns true. */
function take(st: State, re: RegExp, fn: (m: RegExpExecArray, raw: string) => boolean | void) {
  const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
  let m: RegExpExecArray | null;
  const spans: [number, number][] = [];
  while ((m = g.exec(st.text))) {
    if (m[0].length === 0) {
      g.lastIndex++;
      continue;
    }
    const raw = st.original.slice(m.index, m.index + m[0].length);
    if (fn(m, raw.trim()) !== false) spans.push([m.index, m.index + m[0].length]);
  }
  for (const [a, b] of spans) {
    st.text = st.text.slice(0, a) + ' '.repeat(b - a) + st.text.slice(b);
    st.original = st.original.slice(0, a) + ' '.repeat(b - a) + st.original.slice(b);
  }
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function plusDays(d: Date, n: number) {
  const x = startOfDay(d);
  x.setDate(x.getDate() + n);
  return x;
}
function weekdayFrom(now: Date, target: number, skipToday: boolean) {
  let diff = (target - now.getDay() + 7) % 7;
  if (diff === 0 && skipToday) diff = 7;
  return plusDays(now, diff);
}
function hour12(h: number, mer: 'am' | 'pm' | null): number {
  if (mer === 'pm') return h % 12 + 12;
  if (mer === 'am') return h % 12;
  return h >= 1 && h <= 7 ? h + 12 : h; // bare hour: afternoon/evening
}

export function parseQuickAdd(input: string, ctx: ParseContext): ParsedCard {
  const now = ctx.now;
  // Diacritics and tatweel are dropped up front so "غدًا" matches "غدا"; folding below is 1:1 per character.
  const original = normalizeDigits(input).replace(/[\u064B-\u0652\u0640]/g, '');
  const folded = [...original]
    .map((ch) => {
      const f = foldArabic(ch).toLowerCase();
      return f.length === ch.length ? f : ch;
    })
    .join('');

  const st: State = {
    text: folded,
    original,
    day: null,
    time: null,
    tonight: false,
    out: { title: '', dueAt: null, hasTime: false, subjectId: null, priority: null, isExam: false, labels: [], estimateMin: null, tokens: [] },
  };
  const tok = (kind: TokenKind, text: string) => st.out.tokens.push({ kind, text });

  const subjectKey = (s: string) => foldArabic(s).toLowerCase().replace(/[\s_-]+/g, '');
  const subjects = ctx.subjects.map((s) => ({ ...s, key: subjectKey(s.name), folded: foldArabic(s.name).toLowerCase() }));

  // 1. #tags and @subject
  take(st, new RegExp(`${B}([#@])([^\\s#@،,]+)`), (m, raw) => {
    const key = subjectKey(m[2]!);
    const subject = subjects.find((s) => s.key === key || s.key.startsWith(key) && key.length >= 3);
    if (subject && !st.out.subjectId) {
      st.out.subjectId = subject.id;
      tok('subject', subject.name);
      return;
    }
    if (m[1] === '#') {
      const label = raw.slice(1);
      if (!st.out.labels.includes(label)) st.out.labels.push(label);
      tok('label', label);
      return;
    }
    return false;
  });

  // 2. Priority
  take(st, new RegExp(`${B}(!!!|!!|!high|!h|!urgent|urgent|عاجل|اولويه عاليه)${E}`), (_m, raw) => {
    st.out.priority = 'high';
    tok('priority', raw);
  });
  take(st, new RegExp(`${B}(!low|!l|اولويه منخفضه)${E}`), (_m, raw) => {
    st.out.priority = 'low';
    tok('priority', raw);
  });
  take(st, new RegExp(`${B}(!med|!m|!medium)${E}`), (_m, raw) => {
    st.out.priority = 'med';
    tok('priority', raw);
  });

  // 3. Dates (longest phrases first)
  const setDay = (d: Date, raw: string) => {
    if (st.day) return false;
    st.day = d;
    tok('date', raw);
    return true;
  };
  take(st, new RegExp(`${B}(day after tomorrow|بعد بكره|بعد بكرا|بعد باكر|بعد باچر|بعد غد)${E}`), (_m, raw) => setDay(plusDays(now, 2), raw));
  take(st, new RegExp(`${B}(tonight|الليله)${E}`), (_m, raw) => {
    if (setDay(startOfDay(now), raw) === false) return false;
    st.tonight = true;
  });
  take(st, new RegExp(`${B}(today|اليوم)${E}`), (_m, raw) => setDay(startOfDay(now), raw));
  take(st, new RegExp(`${B}(tomorrow|tmrw|tmr|غدا|غد|بكره|بكرا|باكر|باچر)${E}`), (_m, raw) => setDay(plusDays(now, 1), raw));
  take(st, new RegExp(`${B}(next week|الاسبوع القادم|الاسبوع الجاي|الاسبوع اللي بعده)${E}`), (_m, raw) => {
    const ws = ctx.weekStart ?? 0;
    const diff = (ws - now.getDay() + 7) % 7 || 7;
    return setDay(plusDays(now, diff), raw);
  });
  take(st, new RegExp(`${B}in (\\d+) (day|days|week|weeks)${E}`), (m, raw) => {
    const n = Number(m[1]) * (m[2]!.startsWith('week') ? 7 : 1);
    return setDay(plusDays(now, n), raw);
  });
  take(st, new RegExp(`${B}بعد (\\d+)? ?(يوم|يومين|ايام|اسبوع|اسبوعين|اسابيع)${E}`), (m, raw) => {
    const unit = m[2]!;
    const n = unit === 'يومين' ? 2 : unit === 'اسبوعين' ? 14 : (Number(m[1] ?? 1) || 1) * (unit.startsWith('اسب') || unit === 'اسابيع' ? 7 : 1);
    return setDay(plusDays(now, n), raw);
  });
  // English weekdays
  for (const [re, idx] of EN_WEEKDAYS) {
    take(st, new RegExp(`${B}(?:(next|this) )?(?:on )?(?:${re.source})${E}`), (m, raw) => setDay(weekdayFrom(now, idx, m[1] === 'next'), raw));
  }
  // Arabic weekdays: (يوم)? (ال)?<day> (القادم|الجاي)?
  for (const [name, idx] of AR_WEEKDAYS) {
    take(st, new RegExp(`${B}(?:يوم )?(?:ال)?${name}( القادم| الجاي)?${E}`), (m, raw) => setDay(weekdayFrom(now, idx, Boolean(m[1])), raw));
  }
  // ISO 2026-10-15
  take(st, new RegExp(`${B}(\\d{4})-(\\d{1,2})-(\\d{1,2})${E}`), (m, raw) =>
    setDay(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])), raw),
  );
  // 15/10 or 15/10/2026 (day first)
  take(st, new RegExp(`${B}(\\d{1,2})/(\\d{1,2})(?:/(\\d{2,4}))?${E}`), (m, raw) => {
    const d = Number(m[1]);
    const mo = Number(m[2]) - 1;
    if (d < 1 || d > 31 || mo < 0 || mo > 11) return false;
    let y = m[3] ? Number(m[3]) : now.getFullYear();
    if (y < 100) y += 2000;
    let date = new Date(y, mo, d);
    if (!m[3] && date < startOfDay(now)) date = new Date(y + 1, mo, d);
    return setDay(date, raw);
  });
  // 15 Oct / Oct 15
  const mon = `(${EN_MONTHS.join('|')})[a-z]*\\.?`;
  const monthDate = (d: number, mo: number, raw: string) => {
    let date = new Date(now.getFullYear(), mo, d);
    if (date < startOfDay(now)) date = new Date(now.getFullYear() + 1, mo, d);
    return setDay(date, raw);
  };
  take(st, new RegExp(`${B}(\\d{1,2}) ${mon}${E}`), (m, raw) => monthDate(Number(m[1]), EN_MONTHS.indexOf(m[2]!), raw));
  take(st, new RegExp(`${B}${mon} (\\d{1,2})${E}`), (m, raw) => monthDate(Number(m[2]), EN_MONTHS.indexOf(m[1]!), raw));

  // 4. Times
  const setTime = (h: number, mi: number, raw: string) => {
    if (st.time || h > 23 || mi > 59) return false;
    st.time = { h, m: mi };
    tok('time', raw);
    return true;
  };
  take(st, new RegExp(`${B}(?:at |@ ?)?(\\d{1,2})(?::(\\d{2}))? ?(am|pm|a\\.m\\.|p\\.m\\.)${E}`), (m, raw) => {
    const h = Number(m[1]);
    if (h < 1 || h > 12) return false;
    return setTime(hour12(h, m[3]!.startsWith('p') ? 'pm' : 'am'), Number(m[2] ?? 0), raw);
  });
  take(st, new RegExp(`${B}(?:الساعه )?(\\d{1,2})(?::(\\d{2}))? ?(صباحا|الصبح|ص|مساء|المسا|العصر|الظهر|بالليل|م)${E}`), (m, raw) => {
    const h = Number(m[1]);
    if (h < 1 || h > 12) return false;
    const am = ['صباحا', 'الصبح', 'ص'].includes(m[3]!);
    const noonish = m[3] === 'الظهر' && h === 12;
    return setTime(noonish ? 12 : hour12(h, am ? 'am' : 'pm'), Number(m[2] ?? 0), raw);
  });
  take(st, new RegExp(`${B}(?:at |الساعه )?(\\d{1,2}):(\\d{2})${E}`), (m, raw) => {
    const h = Number(m[1]);
    // "5:30" without am/pm: 24h if ≥ 13 or 0, otherwise the afternoon heuristic.
    return setTime(h >= 13 || h === 0 ? h : hour12(h, null), Number(m[2]), raw);
  });
  take(st, new RegExp(`${B}(?:at|الساعه) (\\d{1,2})${E}`), (m, raw) => {
    const h = Number(m[1]);
    if (h > 23) return false;
    return setTime(h >= 13 || h === 0 ? h : hour12(h, null), 0, raw);
  });
  take(st, new RegExp(`${B}(noon|الظهر)${E}`), (_m, raw) => setTime(12, 0, raw));

  // 5. Estimate
  take(st, new RegExp(`${B}~?(\\d+(?:\\.\\d+)?) ?(m|min|mins|minutes|h|hr|hrs|hour|hours|د|دقيقه|دقايق|دقائق|ساعه|ساعات)${E}`), (m, raw) => {
    const n = Number(m[1]);
    const hours = /^(h|hr|hrs|hour|hours|ساعه|ساعات)$/.test(m[2]!);
    const min = Math.round(hours ? n * 60 : n);
    if (!min || min > 1440 || st.out.estimateMin) return false;
    st.out.estimateMin = min;
    tok('estimate', raw);
  });
  take(st, new RegExp(`${B}(ساعه|ساعتين|نص ساعه|نصف ساعه|ربع ساعه)${E}`), (m, raw) => {
    if (st.out.estimateMin) return false;
    st.out.estimateMin = { ساعه: 60, ساعتين: 120, 'نص ساعه': 30, 'نصف ساعه': 30, 'ربع ساعه': 15 }[m[1]!] ?? null;
    tok('estimate', raw);
  });

  // 6. Exam (kept in the title)
  if (new RegExp(`${B}(exam|test|quiz|midterm|final|اختبار|امتحان|كويز)`).test(st.text)) {
    st.out.isExam = true;
    tok('exam', '');
  }

  // 7. Subject by plain name (kept in the title). Longest names first.
  if (!st.out.subjectId) {
    const sorted = [...subjects].sort((a, b) => b.folded.length - a.folded.length);
    for (const s of sorted) {
      const name = s.folded.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Arabic: allow the definite article and common prefixes (ال، لل، بال).
      const re = new RegExp(`${B}(?:ال|لل|بال|و)?${name.replace(/^ال/, '')}${E}`);
      if (re.test(st.text)) {
        st.out.subjectId = s.id;
        tok('subject', s.name);
        break;
      }
    }
  }

  // Due date
  if (st.day || st.time) {
    let day = st.day ?? startOfDay(now);
    const time = st.time ?? (st.tonight ? { h: 20, m: 0 } : null);
    if (time) {
      const d = new Date(day.getFullYear(), day.getMonth(), day.getDate(), time.h, time.m);
      if (!st.day && d.getTime() <= now.getTime()) day = plusDays(now, 1);
      st.out.dueAt = new Date(day.getFullYear(), day.getMonth(), day.getDate(), time.h, time.m);
      st.out.hasTime = true;
    } else {
      st.out.dueAt = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59);
      st.out.hasTime = false;
    }
  }

  st.out.title = cleanTitle(st.original);
  return st.out;
}

const DANGLING = /^(?:at|on|by|due|for|في|يوم|الساعه|الساعة|قبل|-|–|—|,|،|:)\s+|\s+(?:at|on|by|due|for|في|يوم|الساعه|الساعة|قبل|-|–|—|,|،|:)$/i;

function cleanTitle(s: string): string {
  let t = s.replace(/​/g, '').replace(/\s+/g, ' ').trim();
  for (let i = 0; i < 4; i++) {
    const next = t.replace(DANGLING, '').trim();
    if (next === t) break;
    t = next;
  }
  t = t.replace(/[\s,،\-–—:]+$/, '').trim();
  if (/^[a-z]/.test(t)) t = t[0]!.toUpperCase() + t.slice(1);
  return t;
}
