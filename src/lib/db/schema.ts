import Dexie, { type EntityTable } from 'dexie';
import type { TableMap, TableName } from '@/types/database';

/** One pending change. Keyed by table+id so repeated edits collapse into one push. */
export interface OutboxEntry {
  key: string; // `${table}:${id}`
  table: TableName;
  row_id: string;
  /** Bumped on every local edit; a push only clears the entry if rev is unchanged. */
  rev: number;
  queued_at: string;
  attempts: number;
}

/** Local copy of an attachment's bytes: works offline and in demo mode; uploaded when online. */
export interface LocalFile {
  id: string; // = attachments.id
  blob: Blob;
  uploaded: 0 | 1;
}

/** A reminder that has fired on this device (in-app inbox). Local only, never synced. */
export interface InboxItem {
  key: string; // `${cardId}:${offset}:${dueAt}`
  card_id: string;
  board_id: string;
  title: string;
  offset_min: number;
  due_at: string;
  fired_at: string;
  read: 0 | 1;
}

/** Per-table pull cursor (server clock) for incremental sync. */
export interface SyncCursor {
  table: TableName;
  server_updated_at: string;
}

type Tables = { [K in TableName]: EntityTable<TableMap[K], 'id'> };

export type MizanDB = Dexie &
  Tables & {
    outbox: EntityTable<OutboxEntry, 'key'>;
    cursors: EntityTable<SyncCursor, 'table'>;
    files: EntityTable<LocalFile, 'id'>;
    inbox: EntityTable<InboxItem, 'key'>;
  };

/** One local database per account so signing out never mixes data between users. */
export function openDatabase(userId: string): MizanDB {
  const db = new Dexie(`mizan-${userId}`) as MizanDB;
  db.version(1).stores({
    profiles: 'id',
    settings: 'id',
    subjects: 'id, position',
    boards: 'id, position',
    columns: 'id, board_id, position',
    cards: 'id, board_id, column_id, subject_id, due_at, is_sample',
    checklist_items: 'id, card_id',
    attachments: 'id, card_id',
    focus_sessions: 'id, started_at, subject_id',
    timer_state: 'id',
    chat_threads: 'id, subject_id, last_message_at',
    chat_messages: 'id, thread_id, created_at',
    flashcards: 'id, subject_id, due_at',
    outbox: 'key, table',
    cursors: 'table',
  });
  db.version(2).stores({ files: 'id, uploaded' });
  db.version(3).stores({ inbox: 'key, fired_at, read, card_id' });
  db.version(4).stores({ study_topics: 'id, subject_id' });
  return db;
}
