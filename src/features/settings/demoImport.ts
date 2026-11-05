/**
 * Moving "this device" (demo mode) data into a signed-in account.
 * The demo database is read as-is; rows keep their ids, take the account's user id, and are queued
 * for sync in foreign-key order. Rows whose id *is* the user id (profile, settings, timer) are re-keyed.
 */
import Dexie from 'dexie';
import { getDb, getUserId } from '@/lib/db';
import { upsertMany } from '@/lib/db/repo';
import { openDatabase } from '@/lib/db/schema';
import { SYNCED_TABLES, type TableName } from '@/types/database';

const DEMO_ID_KEY = 'mizan.demoId';
const doneKey = (id: string) => `mizan.demoImported.${id}`;
/** Per-user singletons: the demo user's id becomes the account's id. */
const KEYED_BY_USER: TableName[] = ['settings', 'timer_state'];
/** The account keeps its own profile (name, onboarding state). */
const SKIP: TableName[] = ['profiles'];

function demoId(): string | null {
  try {
    const id = localStorage.getItem(DEMO_ID_KEY);
    return id && localStorage.getItem(doneKey(id)) !== '1' ? id : null;
  } catch {
    return null;
  }
}

/** How many study items the demo holds (cards, sessions, books, flashcards…), or 0 if nothing to import. */
export async function demoDataCount(): Promise<number> {
  const id = demoId();
  if (!id || id === getUserId() || !(await Dexie.exists(`mizan-${id}`))) return 0;
  const db = openDatabase(id);
  try {
    let n = 0;
    for (const t of ['cards', 'focus_sessions', 'books', 'flashcards', 'chat_threads'] as TableName[]) {
      n += (await db.table(t).toArray()).filter((r: { deleted_at: string | null; is_sample?: boolean }) => !r.deleted_at && !r.is_sample).length;
    }
    return n;
  } finally {
    db.close();
  }
}

export async function importDemoData(): Promise<number> {
  const id = demoId();
  if (!id) return 0;
  const demo = openDatabase(id);
  const userId = getUserId();
  let total = 0;
  try {
    for (const t of SYNCED_TABLES) {
      if (SKIP.includes(t)) continue;
      const rows = (await demo.table(t).toArray()).filter((r: { deleted_at: string | null }) => !r.deleted_at) as Record<string, unknown>[];
      if (!rows.length) continue;
      const patches = rows.map(({ user_id: _u, ...r }) => (KEYED_BY_USER.includes(t) ? { ...r, id: userId } : r));
      // Settings and timer: keep the account's own row if it already has one.
      if (KEYED_BY_USER.includes(t) && (await getDb().table(t).get(userId))) continue;
      await upsertMany(t, patches as never);
      total += patches.length;
    }
    // Attachment files stored on the device: copy and mark for upload.
    const files = await demo.files.toArray();
    if (files.length) await getDb().files.bulkPut(files.map((f) => ({ ...f, uploaded: 0 as const })));
    localStorage.setItem(doneKey(id), '1');
  } finally {
    demo.close();
  }
  return total;
}

export function dismissDemoImport() {
  const id = (() => {
    try {
      return localStorage.getItem(DEMO_ID_KEY);
    } catch {
      return null;
    }
  })();
  if (id) localStorage.setItem(doneKey(id), '1');
}
