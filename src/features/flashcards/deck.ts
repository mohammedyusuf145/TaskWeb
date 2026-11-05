/** Pure deck maths for the Flashcards page: card stages, a due forecast and plain-text import. */
import type { Flashcard } from '@/types/database';
import { isDue } from '@/features/tutor/srs';

export type Stage = 'new' | 'learning' | 'mature';
/** Mature once the interval reaches three weeks (the usual SM-2 convention). */
export const MATURE_DAYS = 21;

export function stage(c: Pick<Flashcard, 'repetitions' | 'interval_days' | 'lapses'>): Stage {
  if (c.repetitions === 0 && c.lapses === 0 && c.interval_days === 0) return 'new';
  return c.interval_days >= MATURE_DAYS ? 'mature' : 'learning';
}

export interface DeckStats {
  total: number;
  due: number;
  new: number;
  learning: number;
  mature: number;
  /** Share of cards that are mature, 0..1. */
  mastery: number;
}

export function deckStats(cards: Flashcard[], now = new Date()): DeckStats {
  const s: DeckStats = { total: cards.length, due: 0, new: 0, learning: 0, mature: 0, mastery: 0 };
  for (const c of cards) {
    s[stage(c)]++;
    if (isDue(c, now)) s.due++;
  }
  s.mastery = s.total ? s.mature / s.total : 0;
  return s;
}

/** Cards coming due on each of the next `days` days (index 0 = today, including overdue). */
export function forecast(cards: Flashcard[], days = 7, now = new Date()): number[] {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const out = Array.from({ length: days }, () => 0);
  for (const c of cards) {
    const d = Math.floor((new Date(c.due_at).getTime() - start) / 86_400_000);
    out[Math.max(0, d)] !== undefined && (out[Math.max(0, d)]! += 1);
  }
  return out;
}

/**
 * Parses pasted cards: one per line, front and back separated by a tab, " ; ", " - ", " – " or " :: ".
 * Lines without a separator are skipped and reported.
 */
export function parseImport(text: string): { cards: { front: string; back: string }[]; skipped: number } {
  const cards: { front: string; back: string }[] = [];
  let skipped = 0;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(/^(.+?)(?:\t|\s+::\s+|\s+;\s+|\s+[-–—]\s+)(.+)$/);
    if (!m || !m[1]!.trim() || !m[2]!.trim()) {
      skipped++;
      continue;
    }
    cards.push({ front: m[1]!.trim().slice(0, 2000), back: m[2]!.trim().slice(0, 4000) });
  }
  return { cards: cards.slice(0, 500), skipped };
}

/** Fisher–Yates with an injectable random source (tests pass a seeded one). */
export function shuffle<T>(list: T[], rand = Math.random): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}
