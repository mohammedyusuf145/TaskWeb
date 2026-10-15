import { useLiveQuery } from 'dexie-react-hooks';
import type { Attachment, Board, Card, ChecklistItem, Column, FocusSession, Profile, Settings, Subject } from '@/types/database';
import { useDbStore } from './index';

const byPosition = <T extends { position: string }>(a: T, b: T) => (a.position < b.position ? -1 : a.position > b.position ? 1 : 0);

export const DEFAULT_SETTINGS: Omit<Settings, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'deleted_at'> = {
  language: 'ar',
  theme: 'dark',
  week_start: 0,
  calendar_primary: 'gregorian',
  calendar_show_secondary: true,
  notifications: { push: false, in_app: true, offsets_min: [1440, 60] },
  timer_defaults: {},
  timezone: (() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Bahrain';
    } catch {
      return 'Asia/Bahrain';
    }
  })(),
};

/** `undefined` while loading, then the stored row (or null). */
export function useProfile(): Profile | null | undefined {
  const { db, userId } = useDbStore();
  return useLiveQuery(async () => (db && userId ? ((await db.profiles.get(userId)) ?? null) : null), [db, userId]);
}

export function useSettingsRow(): Settings | null | undefined {
  const { db, userId } = useDbStore();
  return useLiveQuery(async () => (db && userId ? ((await db.settings.get(userId)) ?? null) : null), [db, userId]);
}

export function useSubjects(): Subject[] | undefined {
  const db = useDbStore((s) => s.db);
  return useLiveQuery(
    async () => (db ? (await db.subjects.toArray()).filter((s) => !s.deleted_at && !s.archived_at).sort(byPosition) : []),
    [db],
  );
}

export function useBoards(): Board[] | undefined {
  const db = useDbStore((s) => s.db);
  return useLiveQuery(
    async () => (db ? (await db.boards.toArray()).filter((b) => !b.deleted_at && !b.archived_at).sort(byPosition) : []),
    [db],
  );
}

export function useColumns(boardId: string | undefined): Column[] | undefined {
  const db = useDbStore((s) => s.db);
  return useLiveQuery(
    async () =>
      db && boardId
        ? (await db.columns.where('board_id').equals(boardId).toArray()).filter((c) => !c.deleted_at).sort(byPosition)
        : [],
    [db, boardId],
  );
}

export function useCards(boardId: string | undefined): Card[] | undefined {
  const db = useDbStore((s) => s.db);
  return useLiveQuery(
    async () =>
      db && boardId ? (await db.cards.where('board_id').equals(boardId).toArray()).filter((c) => !c.deleted_at).sort(byPosition) : [],
    [db, boardId],
  );
}

export function usePendingCount(): number {
  const db = useDbStore((s) => s.db);
  return useLiveQuery(async () => (db ? db.outbox.count() : 0), [db]) ?? 0;
}

/** All boards including archived ones (for the manage dialog). */
export function useAllBoards(): Board[] | undefined {
  const db = useDbStore((s) => s.db);
  return useLiveQuery(async () => (db ? (await db.boards.toArray()).filter((b) => !b.deleted_at).sort(byPosition) : []), [db]);
}

export function useCard(id: string | null | undefined): Card | null | undefined {
  const db = useDbStore((s) => s.db);
  return useLiveQuery(async () => (db && id ? ((await db.cards.get(id)) ?? null) : null), [db, id]);
}

export function useAllCards(): Card[] | undefined {
  const db = useDbStore((s) => s.db);
  return useLiveQuery(async () => (db ? (await db.cards.toArray()).filter((c) => !c.deleted_at) : []), [db]);
}

export function useChecklist(cardId: string | null | undefined): ChecklistItem[] | undefined {
  const db = useDbStore((s) => s.db);
  return useLiveQuery(
    async () =>
      db && cardId ? (await db.checklist_items.where('card_id').equals(cardId).toArray()).filter((i) => !i.deleted_at).sort(byPosition) : [],
    [db, cardId],
  );
}

export function useAttachments(cardId: string | null | undefined): (Attachment & { pending: boolean })[] | undefined {
  const db = useDbStore((s) => s.db);
  return useLiveQuery(async () => {
    if (!db || !cardId) return [];
    const rows = (await db.attachments.where('card_id').equals(cardId).toArray()).filter((a) => !a.deleted_at);
    const pending = new Set((await db.files.where('uploaded').equals(0).primaryKeys()) as string[]);
    return rows.sort((a, b) => a.created_at.localeCompare(b.created_at)).map((a) => ({ ...a, pending: pending.has(a.id) }));
  }, [db, cardId]);
}

export interface CardMeta {
  checklistDone: number;
  checklistTotal: number;
  attachments: number;
}

/** Checklist progress and attachment counts for every card on a board, in one query. */
export function useCardMeta(cardIds: string[] | undefined): Map<string, CardMeta> {
  const db = useDbStore((s) => s.db);
  const key = cardIds?.join(',') ?? '';
  return (
    useLiveQuery(async () => {
      const map = new Map<string, CardMeta>();
      if (!db || !cardIds?.length) return map;
      const get = (id: string) => {
        let m = map.get(id);
        if (!m) map.set(id, (m = { checklistDone: 0, checklistTotal: 0, attachments: 0 }));
        return m;
      };
      for (const i of await db.checklist_items.where('card_id').anyOf(cardIds).toArray()) {
        if (i.deleted_at) continue;
        const m = get(i.card_id);
        m.checklistTotal++;
        if (i.done) m.checklistDone++;
      }
      for (const a of await db.attachments.where('card_id').anyOf(cardIds).toArray()) if (!a.deleted_at) get(a.card_id).attachments++;
      return map;
    }, [db, key]) ?? new Map()
  );
}

/** Focus sessions that started on or after `since` (live). */
export function useFocusSessions(since: Date): FocusSession[] | undefined {
  const db = useDbStore((s) => s.db);
  const key = since.toISOString();
  return useLiveQuery(
    async () => (db ? (await db.focus_sessions.where('started_at').aboveOrEqual(key).toArray()).filter((s) => !s.deleted_at) : []),
    [db, key],
  );
}
