import type { Style } from './protocol';
import { CONTEXT_OPEN } from './protocol';

export interface ContextInput {
  now: Date;
  timezone: string;
  lang: 'ar' | 'en';
  style: Style;
  subject: string | null;
  subjects: string[];
  upcoming: { title: string; due_at: string; due_has_time: boolean; is_exam: boolean; subject: string | null }[];
  weak: { topic: string; correct: number; attempts: number }[];
}

const pad = (n: number) => String(n).padStart(2, '0');
export const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
/** Keeps titles from breaking the block's structure. */
const clean = (s: string, max = 120) => s.replace(/[<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

/**
 * The per-message context the tutor sees. Lives inside the student's message (never the system
 * prompt) so the conversation stays append-only and cache-friendly.
 */
export function buildContext(c: ContextInput): string {
  const lines = [
    CONTEXT_OPEN,
    `now: ${WEEKDAYS[c.now.getDay()]} ${isoDay(c.now)} ${hm(c.now)} (${c.timezone})`,
    `lang: ${c.lang}`,
    `style: ${c.style}`,
    `subject: ${c.subject ? clean(c.subject, 60) : 'general'}`,
  ];
  if (c.subjects.length) lines.push(`student's subjects: ${c.subjects.map((s) => clean(s, 40)).join(', ')}`);
  const items = [...c.upcoming].sort((a, b) => a.due_at.localeCompare(b.due_at)).slice(0, 8);
  if (items.length) {
    lines.push('upcoming (use get_tasks for more):');
    for (const u of items) {
      const d = new Date(u.due_at);
      const when = u.due_has_time ? `${isoDay(d)} ${hm(d)}` : isoDay(d);
      lines.push(`- ${when}${u.is_exam ? ' EXAM' : ''}${u.subject ? ` [${clean(u.subject, 40)}]` : ''} ${clean(u.title)}`);
    }
  }
  const weak = c.weak.filter((w) => w.attempts >= 2 && w.correct / w.attempts < 0.7).slice(0, 6);
  if (weak.length) lines.push(`weak topics in this subject: ${weak.map((w) => `${clean(w.topic, 60)} (${w.correct}/${w.attempts})`).join('; ')}`);
  lines.push('</context>');
  return lines.join('\n');
}
