import type { Table } from 'dexie';
import type { BaseRow, TableMap, TableName } from '@/types/database';
import { getDb, getUserId } from './index';
import { nowIso } from './clock';
import type { OutboxEntry } from './schema';

type Listener = () => void;
const listeners = new Set<Listener>();

/** Sync engine subscribes here to push soon after any local change. */
export function onLocalChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function table<T extends TableName>(name: T): Table<TableMap[T], string> {
  return getDb()[name] as unknown as Table<TableMap[T], string>;
}

export function newId(): string {
  return crypto.randomUUID();
}

type Patch<T extends TableName> = Partial<TableMap[T]> & { id?: string };

/**
 * Create or update rows locally and queue them for sync. Writes are instant
 * (optimistic): the UI reads from IndexedDB, so it updates immediately.
 */
export async function upsertMany<T extends TableName>(name: T, patches: Patch<T>[]): Promise<TableMap[T][]> {
  const db = getDb();
  const userId = getUserId();
  const t = table(name);
  const out: TableMap[T][] = [];

  await db.transaction('rw', t, db.outbox, async () => {
    for (const patch of patches) {
      const id = patch.id ?? newId();
      const existing = await t.get(id);
      const updated_at = nowIso(existing?.updated_at);
      const row = {
        created_at: updated_at,
        deleted_at: null,
        ...existing,
        ...patch,
        id,
        user_id: userId,
        updated_at,
      } as TableMap[T] & BaseRow;
      await t.put(row);
      await queue(name, id);
      out.push(row);
    }
  });

  listeners.forEach((fn) => fn());
  return out;
}

export async function upsert<T extends TableName>(name: T, patch: Patch<T>): Promise<TableMap[T]> {
  const [row] = await upsertMany(name, [patch]);
  return row!;
}

/** Soft delete: the tombstone syncs so other devices remove the row too. */
export async function softDelete<T extends TableName>(name: T, ids: string[]): Promise<void> {
  const deleted_at = new Date().toISOString();
  await upsertMany(
    name,
    ids.map((id) => ({ id, deleted_at }) as Patch<T>),
  );
}

async function queue(name: TableName, id: string) {
  const db = getDb();
  const key = `${name}:${id}`;
  const existing = await db.outbox.get(key);
  const entry: OutboxEntry = {
    key,
    table: name,
    row_id: id,
    rev: (existing?.rev ?? 0) + 1,
    queued_at: existing?.queued_at ?? new Date().toISOString(),
    attempts: 0,
  };
  await db.outbox.put(entry);
}

/** Live rows without tombstones. */
export function alive<T extends { deleted_at: string | null }>(rows: T[]): T[] {
  return rows.filter((r) => !r.deleted_at);
}
