/**
 * Spaced repetition (SM-2 family, four buttons). Pure: the review UI and tests share it.
 * Ease stays within 1.3–5 (the database enforces the same range).
 */
export type Grade = 'again' | 'hard' | 'good' | 'easy';

export interface SrsState {
  ease: number;
  interval_days: number;
  repetitions: number;
  lapses: number;
  due_at: string;
}

const DAY = 86_400_000;
const RELEARN_MS = 10 * 60_000;
const MAX_INTERVAL = 365;
const clampEase = (e: number) => Math.min(5, Math.max(1.3, Math.round(e * 100) / 100));

export function newCardState(now = new Date()): SrsState {
  return { ease: 2.5, interval_days: 0, repetitions: 0, lapses: 0, due_at: now.toISOString() };
}

export function review(s: SrsState, grade: Grade, now = new Date()): SrsState {
  const t = now.getTime();
  if (grade === 'again') {
    return {
      ease: clampEase(s.ease - 0.2),
      interval_days: 0,
      repetitions: 0,
      lapses: s.repetitions > 0 ? s.lapses + 1 : s.lapses,
      due_at: new Date(t + RELEARN_MS).toISOString(),
    };
  }
  const ease = clampEase(grade === 'hard' ? s.ease - 0.15 : grade === 'easy' ? s.ease + 0.15 : s.ease);
  let interval: number;
  if (s.repetitions === 0) interval = grade === 'easy' ? 3 : 1;
  else if (s.repetitions === 1) interval = grade === 'hard' ? 2 : grade === 'good' ? 3 : 6;
  else {
    const base = Math.max(1, s.interval_days);
    interval = grade === 'hard' ? base * 1.2 : grade === 'good' ? base * ease : base * ease * 1.3;
    // Always move forward, and keep hard < good < easy.
    interval = Math.max(base + (grade === 'hard' ? 0 : 1), interval);
  }
  interval = Math.min(MAX_INTERVAL, Math.round(interval));
  return { ease, interval_days: interval, repetitions: s.repetitions + 1, lapses: s.lapses, due_at: new Date(t + interval * DAY).toISOString() };
}

/** Due if scheduled any time today or earlier (day-based cards shouldn't wait for the exact minute). */
export function isDue(s: Pick<SrsState, 'due_at'>, now = new Date()): boolean {
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
  const due = new Date(s.due_at).getTime();
  // Relearning cards (minutes away) wait for their time.
  return due - now.getTime() <= 0 || (due < end && due - now.getTime() > RELEARN_MS * 1.5);
}

/** What each button would schedule, for labels like "Good · 3d". */
export function preview(s: SrsState, now = new Date()): Record<Grade, number> {
  const out = {} as Record<Grade, number>;
  for (const g of ['again', 'hard', 'good', 'easy'] as Grade[]) out[g] = new Date(review(s, g, now).due_at).getTime() - now.getTime();
  return out;
}
