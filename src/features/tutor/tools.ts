/**
 * Runs the tutor's tools against the local (offline-first) database.
 * Read-only tools run automatically; anything that changes cards runs only after the student
 * confirms in the UI (see ToolWidgets).
 */
import { getDb } from '@/lib/db';
import { newId, upsert, upsertMany } from '@/lib/db/repo';
import type { Card, StudyTopic, Subject } from '@/types/database';
import { createCard, setCardDone, updateCard } from '@/features/boards/ops';
import { byPosition } from '@/features/boards/position';
import { newCardState } from './srs';
import { dueFrom, getTasksInput, type ProposedCard, topicResultsInput, type UpdateCardInput } from './toolInput';
import { isoDay } from './context';

const live = <T extends { deleted_at: string | null }>(rows: T[]) => rows.filter((r) => !r.deleted_at);

export const AUTO_TOOLS = new Set(['get_tasks', 'record_topic_results']);
export const INTERACTIVE_TOOLS = new Set(['propose_cards', 'update_card', 'make_quiz', 'make_flashcards']);

async function subjectsById(): Promise<Map<string, Subject>> {
  return new Map(live(await getDb().subjects.toArray()).map((s) => [s.id, s]));
}

export async function runGetTasks(raw: unknown): Promise<string> {
  const input = getTasksInput(raw);
  const db = getDb();
  const now = new Date();
  const until = new Date(now.getTime() + input.range_days * 86_400_000).toISOString();
  const overdueFrom = new Date(now.getTime() - 14 * 86_400_000).toISOString();
  const subjects = await subjectsById();
  const boards = new Map(live(await db.boards.toArray()).map((b) => [b.id, b]));
  const cards = live(await db.cards.where('due_at').between(overdueFrom, until, true, true).toArray())
    .filter((c) => boards.has(c.board_id) && !boards.get(c.board_id)!.archived_at)
    .filter((c) => input.include_done || !c.completed_at)
    .sort((a, b) => (a.due_at ?? '').localeCompare(b.due_at ?? ''))
    .slice(0, 60);
  const undated = input.include_done ? [] : live(await db.cards.toArray()).filter((c) => !c.due_at && !c.completed_at && boards.has(c.board_id)).length;
  return JSON.stringify({
    today: isoDay(now),
    cards: cards.map((c) => {
      const d = new Date(c.due_at!);
      return {
        id: c.id,
        title: c.title,
        subject: c.subject_id ? (subjects.get(c.subject_id)?.name ?? null) : null,
        due: c.due_has_time ? `${isoDay(d)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : isoDay(d),
        overdue: !c.completed_at && d.getTime() < now.getTime(),
        is_exam: c.is_exam,
        priority: c.priority,
        labels: c.labels,
        done: Boolean(c.completed_at),
      };
    }),
    undated_open_cards: undated,
  });
}

/** Adds quiz results to per-subject topic stats (case-insensitive topic match). */
export async function runRecordTopics(raw: unknown, subjectId: string | null): Promise<string> {
  const results = topicResultsInput(raw);
  const db = getDb();
  const existing = live(await db.study_topics.toArray()).filter((t) => t.subject_id === subjectId);
  const key = (s: string) => s.trim().toLocaleLowerCase();
  const now = new Date().toISOString();
  const patches: Partial<StudyTopic>[] = [];
  for (const r of results) {
    const row = existing.find((t) => key(t.topic) === key(r.topic)) ?? patches.find((p) => key(p.topic!) === key(r.topic));
    if (row && 'attempts' in row && row.id) {
      const attempts = (row.attempts ?? 0) + r.total;
      const correct = Math.min(attempts, (row.correct ?? 0) + r.correct);
      const i = patches.findIndex((p) => p.id === row.id);
      const patch = { id: row.id, topic: row.topic!, attempts, correct, last_seen_at: now };
      if (i >= 0) patches[i] = { ...patches[i], ...patch };
      else patches.push(patch);
    } else {
      patches.push({ id: newId(), subject_id: subjectId, topic: r.topic.slice(0, 120), attempts: r.total, correct: r.correct, last_seen_at: now });
    }
  }
  await upsertMany('study_topics', patches);
  return JSON.stringify({ recorded: results.length });
}

/** Board and column new tutor cards go to: the first active board, first column that isn't "done". */
async function targetColumn(): Promise<{ board_id: string; column_id: string } | null> {
  const db = getDb();
  const boards = live(await db.boards.toArray())
    .filter((b) => !b.archived_at)
    .sort(byPosition);
  for (const b of boards) {
    const cols = live(await db.columns.where('board_id').equals(b.id).toArray()).sort(byPosition);
    const col = cols.find((c) => c.kind !== 'done') ?? cols[0];
    if (col) return { board_id: b.id, column_id: col.id };
  }
  return null;
}

export function matchSubject(name: string | null, subjects: Subject[]): Subject | null {
  if (!name) return null;
  const n = name.trim().toLocaleLowerCase();
  return subjects.find((s) => s.name.trim().toLocaleLowerCase() === n) ?? subjects.find((s) => s.name.toLocaleLowerCase().includes(n) || n.includes(s.name.toLocaleLowerCase())) ?? null;
}

export async function applyProposedCards(cards: ProposedCard[], fallbackSubject: string | null): Promise<Card[]> {
  const target = await targetColumn();
  if (!target) throw new Error('no_board');
  const subjects = live(await getDb().subjects.toArray());
  const out: Card[] = [];
  for (const c of cards) {
    const due = c.due_date ? dueFrom(c.due_date, c.due_time) : { due_at: null, due_has_time: false };
    out.push(
      await createCard({
        ...target,
        title: c.title.slice(0, 300),
        notes: c.notes ?? '',
        priority: c.priority,
        is_exam: c.is_exam,
        subject_id: matchSubject(c.subject, subjects)?.id ?? fallbackSubject,
        labels: ['tutor'],
        ...due,
      }),
    );
  }
  return out;
}

export async function applyCardUpdate(u: UpdateCardInput): Promise<Card> {
  const db = getDb();
  const card = await db.cards.get(u.card_id);
  if (!card || card.deleted_at) throw new Error('not_found');
  const patch: Partial<Card> = {};
  if (u.title !== null) patch.title = u.title.slice(0, 300);
  if (u.notes !== null) patch.notes = u.notes;
  if (u.priority !== null) patch.priority = u.priority;
  if (u.due_date === 'none') Object.assign(patch, { due_at: null, due_has_time: false });
  else if (u.due_date !== null || u.due_time !== null) {
    const base = u.due_date ?? (card.due_at ? isoDay(new Date(card.due_at)) : null);
    if (base) {
      const keepTime = card.due_at && card.due_has_time ? `${String(new Date(card.due_at).getHours()).padStart(2, '0')}:${String(new Date(card.due_at).getMinutes()).padStart(2, '0')}` : null;
      const t = u.due_time === 'none' ? null : (u.due_time ?? keepTime);
      Object.assign(patch, dueFrom(base, t));
    }
  }
  if (Object.keys(patch).length) await updateCard(card.id, patch);
  if (u.done !== null && Boolean(card.completed_at) !== u.done) await setCardDone(card, u.done);
  return (await db.cards.get(card.id))!;
}

export async function saveFlashcards(cards: { front: string; back: string }[], subjectId: string | null): Promise<number> {
  const now = new Date();
  await upsertMany(
    'flashcards',
    cards.map((c) => ({ id: newId(), subject_id: subjectId, front: c.front.slice(0, 2000), back: c.back.slice(0, 4000), ...newCardState(now) })),
  );
  return cards.length;
}

export const touchThread = (id: string, patch: { title?: string; last_message_at?: string }) => upsert('chat_threads', { id, ...patch });
