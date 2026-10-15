/**
 * Validates tool inputs before running them. The API streams tool input eagerly, so a parsed input
 * can be partial or off-schema; anything invalid goes back to the model as an error result.
 */
export class ToolInputError extends Error {}

type O = Record<string, unknown>;
const bad = (msg: string): never => {
  throw new ToolInputError(msg);
};
const obj = (v: unknown, what: string): O => (typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as O) : bad(`${what} must be an object`));
const s = (v: unknown, what: string, max: number, min = 1): string => {
  if (typeof v !== 'string') return bad(`${what} must be a string`);
  const t = v.trim();
  return t.length >= min && t.length <= max ? t : bad(`${what} must be ${min}-${max} characters`);
};
const ns = (v: unknown, what: string, max: number): string | null => (v === null || v === undefined || v === '' ? null : s(v, what, max));
const arr = (v: unknown, what: string, min: number, max: number): unknown[] =>
  Array.isArray(v) && v.length >= min && v.length <= max ? v : bad(`${what} must be a list of ${min}-${max} items`);
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const date = (v: unknown, what: string, allowNone: boolean): string | null => {
  const t = ns(v, what, 10);
  if (t === null) return null;
  if (allowNone && t === 'none') return 'none';
  if (!DATE.test(t) || Number.isNaN(new Date(`${t}T00:00:00`).getTime())) bad(`${what} must be YYYY-MM-DD`);
  return t;
};
const time = (v: unknown, what: string, allowNone: boolean): string | null => {
  const t = ns(v, what, 5);
  if (t === null) return null;
  if (allowNone && t === 'none') return 'none';
  return TIME.test(t) ? t : bad(`${what} must be HH:MM`);
};
const priority = (v: unknown, allowKeep: boolean) => {
  if (v === 'low' || v === 'med' || v === 'high') return v;
  if (allowKeep && (v === 'keep' || v === null || v === undefined)) return null;
  return bad('priority must be low, med or high');
};

export interface GetTasksInput {
  range_days: number;
  include_done: boolean;
}
export function getTasksInput(v: unknown): GetTasksInput {
  const o = obj(v, 'input');
  const days = Number(o.range_days);
  return { range_days: Number.isFinite(days) ? Math.min(90, Math.max(1, Math.round(days))) : 14, include_done: o.include_done === true };
}

export interface ProposedCard {
  title: string;
  notes: string | null;
  due_date: string | null;
  due_time: string | null;
  priority: 'low' | 'med' | 'high';
  subject: string | null;
  is_exam: boolean;
}
export function proposeCardsInput(v: unknown): { reason: string; cards: ProposedCard[] } {
  const o = obj(v, 'input');
  return {
    reason: s(o.reason ?? '', 'reason', 400, 0),
    cards: arr(o.cards, 'cards', 1, 30).map((c, i) => {
      const x = obj(c, `cards[${i}]`);
      const due_date = date(x.due_date, `cards[${i}].due_date`, false);
      const due_time = time(x.due_time, `cards[${i}].due_time`, false);
      if (due_time && !due_date) bad(`cards[${i}] has a time without a date`);
      return {
        title: s(x.title, `cards[${i}].title`, 300),
        notes: ns(x.notes, `cards[${i}].notes`, 4000),
        due_date,
        due_time,
        priority: priority(x.priority ?? 'med', false)!,
        subject: ns(x.subject, `cards[${i}].subject`, 80),
        is_exam: x.is_exam === true,
      };
    }),
  };
}

export interface UpdateCardInput {
  card_id: string;
  reason: string;
  title: string | null;
  notes: string | null;
  due_date: string | null;
  due_time: string | null;
  priority: 'low' | 'med' | 'high' | null;
  done: boolean | null;
}
export function updateCardInput(v: unknown): UpdateCardInput {
  const o = obj(v, 'input');
  const out: UpdateCardInput = {
    card_id: s(o.card_id, 'card_id', 64),
    reason: s(o.reason ?? '', 'reason', 400, 0),
    title: ns(o.title, 'title', 300),
    notes: o.notes === '' ? '' : ns(o.notes, 'notes', 4000),
    due_date: date(o.due_date, 'due_date', true),
    due_time: time(o.due_time, 'due_time', true),
    priority: priority(o.priority, true),
    done: typeof o.done === 'boolean' ? o.done : null,
  };
  if (Object.entries(out).every(([k, val]) => k === 'card_id' || k === 'reason' || val === null)) bad('no changes given');
  return out;
}

export interface QuizQuestion {
  kind: 'mcq' | 'short' | 'steps';
  prompt: string;
  choices: string[];
  answer: string;
  explanation: string;
  topic: string;
}
export function quizInput(v: unknown): { title: string; questions: QuizQuestion[] } {
  const o = obj(v, 'input');
  return {
    title: s(o.title, 'title', 200),
    questions: arr(o.questions, 'questions', 1, 12).map((q, i) => {
      const x = obj(q, `questions[${i}]`);
      const kind = x.kind === 'mcq' || x.kind === 'short' || x.kind === 'steps' ? x.kind : bad(`questions[${i}].kind is invalid`);
      const choices = kind === 'mcq' ? arr(x.choices, `questions[${i}].choices`, 2, 6).map((c, j) => s(c, `questions[${i}].choices[${j}]`, 500)) : [];
      const answer = s(x.answer, `questions[${i}].answer`, 2000);
      if (kind === 'mcq' && !choices.includes(answer)) bad(`questions[${i}].answer must exactly match one of its choices`);
      return {
        kind,
        prompt: s(x.prompt, `questions[${i}].prompt`, 2000),
        choices,
        answer,
        explanation: s(x.explanation ?? '', `questions[${i}].explanation`, 3000, 0),
        topic: s(x.topic ?? 'General', `questions[${i}].topic`, 80),
      };
    }),
  };
}

export function flashcardsInput(v: unknown): { topic: string; cards: { front: string; back: string }[] } {
  const o = obj(v, 'input');
  return {
    topic: s(o.topic ?? '', 'topic', 120, 0),
    cards: arr(o.cards, 'cards', 1, 40).map((c, i) => {
      const x = obj(c, `cards[${i}]`);
      return { front: s(x.front, `cards[${i}].front`, 2000), back: s(x.back, `cards[${i}].back`, 4000) };
    }),
  };
}

export function topicResultsInput(v: unknown): { topic: string; correct: number; total: number }[] {
  const o = obj(v, 'input');
  return arr(o.results, 'results', 1, 30).map((r, i) => {
    const x = obj(r, `results[${i}]`);
    const total = Math.round(Number(x.total));
    const correct = Math.round(Number(x.correct));
    if (!Number.isFinite(total) || total < 1 || total > 100) bad(`results[${i}].total must be 1-100`);
    if (!Number.isFinite(correct) || correct < 0 || correct > total) bad(`results[${i}].correct must be 0-total`);
    return { topic: s(x.topic, `results[${i}].topic`, 120), correct, total };
  });
}

/** Local date + optional time → stored due fields. Date-only cards are due at the end of the day. */
export function dueFrom(dateStr: string, timeStr: string | null): { due_at: string; due_has_time: boolean } {
  const [y, m, d] = dateStr.split('-').map(Number) as [number, number, number];
  if (timeStr) {
    const [h, min] = timeStr.split(':').map(Number) as [number, number];
    return { due_at: new Date(y, m - 1, d, h, min).toISOString(), due_has_time: true };
  }
  return { due_at: new Date(y, m - 1, d, 23, 59).toISOString(), due_has_time: false };
}

/** Lenient answer check for short answers: case, spacing, Arabic/Western digits and diacritics. */
export function normalizeAnswer(a: string): string {
  return a
    .normalize('NFKC')
    .replace(/[ً-ْـ]/g, '') // tashkeel, tatweel
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[إأآ]/g, 'ا')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}
