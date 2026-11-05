import { useLiveQuery } from 'dexie-react-hooks';
import { useDbStore } from '@/lib/db';
import type { ChatMessage, ChatThread, Flashcard, StudyTopic } from '@/types/database';

export function useThreads(): ChatThread[] | undefined {
  const db = useDbStore((s) => s.db);
  return useLiveQuery(
    async () =>
      db
        ? (await db.chat_threads.toArray())
            .filter((t) => !t.deleted_at)
            .sort((a, b) => (b.last_message_at ?? b.created_at).localeCompare(a.last_message_at ?? a.created_at))
        : [],
    [db],
  );
}

/** `undefined` while loading, including right after `id` changes (live queries briefly keep the old result). */
export function useThread(id: string | undefined): ChatThread | null | undefined {
  const db = useDbStore((s) => s.db);
  const r = useLiveQuery(async () => ({ id, row: db && id ? ((await db.chat_threads.get(id)) ?? null) : null }), [db, id]);
  if (!r || r.id !== id) return undefined;
  return r.row && !r.row.deleted_at ? r.row : null;
}

export function useMessages(threadId: string | undefined): ChatMessage[] | undefined {
  const db = useDbStore((s) => s.db);
  const r = useLiveQuery(
    async () => ({
      threadId,
      rows:
        db && threadId
          ? (await db.chat_messages.where('thread_id').equals(threadId).toArray())
              .filter((m) => !m.deleted_at)
              .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
          : [],
    }),
    [db, threadId],
  );
  return r && r.threadId === threadId ? r.rows : undefined;
}

export function useFlashcards(): Flashcard[] | undefined {
  const db = useDbStore((s) => s.db);
  return useLiveQuery(async () => (db ? (await db.flashcards.toArray()).filter((f) => !f.deleted_at) : []), [db]);
}

export function useStudyTopics(subjectId: string | null | undefined): StudyTopic[] | undefined {
  const db = useDbStore((s) => s.db);
  return useLiveQuery(
    async () => (db ? (await db.study_topics.toArray()).filter((t) => !t.deleted_at && t.subject_id === (subjectId ?? null)) : []),
    [db, subjectId],
  );
}
