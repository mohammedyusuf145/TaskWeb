import { create } from 'zustand';
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import type { Table } from 'dexie';
import { SYNCED_TABLES, type BaseRow, type TableName } from '@/types/database';
import type { MizanDB } from './schema';
import { cursorWithOverlap, shouldApplyRemote } from './merge';
import { onLocalChange } from './repo';

export type SyncState = 'local' | 'idle' | 'syncing' | 'offline' | 'error';

interface SyncStatus {
  state: SyncState;
  lastSyncedAt: string | null;
  initialPullDone: boolean;
}

export const useSyncStatus = create<SyncStatus>(() => ({
  state: 'local',
  lastSyncedAt: null,
  initialPullDone: false,
}));

const PUSH_CHUNK = 200;
const PULL_PAGE = 500;
const MAX_ATTEMPTS = 8;

type AnyRow = BaseRow & { server_updated_at?: string };

/**
 * Offline-first sync:
 *  - Local writes land in IndexedDB + an outbox (see repo.ts).
 *  - flush() pushes the outbox; the server's trigger rejects stale writes (last-write-wins).
 *  - pull() fetches rows changed since the last cursor (server clock).
 *  - Realtime delivers other devices' changes within seconds.
 */
export class SyncEngine {
  private channel: RealtimeChannel | null = null;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private flushing: Promise<void> | null = null;
  private unsubs: Array<() => void> = [];

  constructor(
    private db: MizanDB,
    private client: SupabaseClient,
    private userId: string,
  ) {}

  async start() {
    if (this.running) return;
    this.running = true;

    const onOnline = () => void this.syncNow();
    const onOffline = () => useSyncStatus.setState({ state: 'offline' });
    const onVisible = () => document.visibilityState === 'visible' && void this.syncNow();
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    document.addEventListener('visibilitychange', onVisible);
    this.unsubs.push(
      () => window.removeEventListener('online', onOnline),
      () => window.removeEventListener('offline', onOffline),
      () => document.removeEventListener('visibilitychange', onVisible),
      onLocalChange(() => this.scheduleFlush()),
    );

    this.subscribeRealtime();
    await this.syncNow();
    useSyncStatus.setState({ initialPullDone: true });
  }

  stop() {
    this.running = false;
    this.unsubs.forEach((u) => u());
    this.unsubs = [];
    if (this.flushTimer) clearTimeout(this.flushTimer);
    if (this.channel) void this.client.removeChannel(this.channel);
    this.channel = null;
    useSyncStatus.setState({ state: 'local', initialPullDone: false });
  }

  /** Push then pull. Safe to call often. */
  async syncNow() {
    if (!this.running) return;
    if (!navigator.onLine) {
      useSyncStatus.setState({ state: 'offline' });
      return;
    }
    useSyncStatus.setState({ state: 'syncing' });
    try {
      await this.flush();
      await this.runTasks();
      await this.pull();
      useSyncStatus.setState({ state: 'idle', lastSyncedAt: new Date().toISOString() });
    } catch (err) {
      useSyncStatus.setState({ state: navigator.onLine ? 'error' : 'offline' });
      if (import.meta.env.DEV) console.warn('[sync]', err);
    }
  }

  private async runTasks() {
    for (const task of tasks) {
      try {
        await task(this.client, this.userId);
      } catch (err) {
        if (import.meta.env.DEV) console.warn('[sync task]', err);
      }
    }
  }

  private scheduleFlush() {
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = setTimeout(() => {
      if (!navigator.onLine) return useSyncStatus.setState({ state: 'offline' });
      useSyncStatus.setState({ state: 'syncing' });
      this.flush()
        .then(() => this.runTasks())
        .then(() => useSyncStatus.setState({ state: 'idle', lastSyncedAt: new Date().toISOString() }))
        .catch(() => useSyncStatus.setState({ state: navigator.onLine ? 'error' : 'offline' }));
    }, 400);
  }

  /** Push queued local changes, parents before children (table order respects foreign keys). */
  flush(): Promise<void> {
    if (this.flushing) return this.flushing;
    this.flushing = this.doFlush().finally(() => {
      this.flushing = null;
    });
    return this.flushing;
  }

  private async doFlush() {
    const entries = await this.db.outbox.toArray();
    if (entries.length === 0) return;

    for (const name of SYNCED_TABLES) {
      const forTable = entries.filter((e) => e.table === name && e.attempts < MAX_ATTEMPTS);
      for (let i = 0; i < forTable.length; i += PUSH_CHUNK) {
        const chunk = forTable.slice(i, i + PUSH_CHUNK);
        const rows = (await this.table(name).bulkGet(chunk.map((e) => e.row_id))).filter(Boolean) as AnyRow[];
        const payload = rows.map(({ server_updated_at: _s, ...row }) => row);
        const { error } = await this.client.from(name).upsert(payload, { onConflict: 'id' });
        if (error) {
          // A Postgres error code means the server rejected the rows (constraint, RLS): count the attempt.
          // No code means the request never arrived (network): retry later without penalty.
          if (error.code) await this.db.outbox.bulkPut(chunk.map((e) => ({ ...e, attempts: e.attempts + 1 })));
          throw new Error(`push ${name}: ${error.message}`);
        }
        // Clear entries only if they were not edited again while the request was in flight.
        await this.db.transaction('rw', this.db.outbox, async () => {
          for (const e of chunk) {
            const current = await this.db.outbox.get(e.key);
            if (current && current.rev === e.rev) await this.db.outbox.delete(e.key);
          }
        });
      }
    }
  }

  private async pull() {
    for (const name of SYNCED_TABLES) {
      const cursorRow = await this.db.cursors.get(name);
      let since = cursorWithOverlap(cursorRow?.server_updated_at);
      let maxSeen = cursorRow?.server_updated_at;

      for (;;) {
        const { data, error } = await this.client
          .from(name)
          .select('*')
          .gt('server_updated_at', since)
          .order('server_updated_at', { ascending: true })
          .limit(PULL_PAGE);
        if (error) throw new Error(`pull ${name}: ${error.message}`);
        const rows = (data ?? []) as AnyRow[];
        if (rows.length === 0) break;
        await this.applyRemote(name, rows);
        const last = rows[rows.length - 1]!.server_updated_at!;
        maxSeen = !maxSeen || last > maxSeen ? last : maxSeen;
        if (rows.length < PULL_PAGE) break;
        since = last;
      }
      if (maxSeen) await this.db.cursors.put({ table: name, server_updated_at: maxSeen });
    }
  }

  /** Apply server rows with last-write-wins against the local copy. */
  async applyRemote(name: TableName, rows: AnyRow[]) {
    const t = this.table(name);
    await this.db.transaction('rw', t, async () => {
      for (const remote of rows) {
        if (remote.user_id !== this.userId) continue;
        const local = (await t.get(remote.id)) as AnyRow | undefined;
        if (shouldApplyRemote(local, remote)) await t.put(remote);
      }
    });
  }

  private subscribeRealtime() {
    let channel = this.client.channel(`sync:${this.userId}`);
    for (const name of SYNCED_TABLES) {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: name, filter: `user_id=eq.${this.userId}` },
        (payload) => {
          const row = payload.new as AnyRow | undefined;
          if (row && 'id' in row) void this.applyRemote(name, [row]);
        },
      );
    }
    // Re-pull after (re)connecting to fill any gap while the socket was down.
    this.channel = channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') void this.syncNow();
    });
  }

  private table(name: TableName): Table<AnyRow, string> {
    return this.db[name] as unknown as Table<AnyRow, string>;
  }
}

type SyncTask = (client: SupabaseClient, userId: string) => Promise<void>;
const tasks = new Set<SyncTask>();

/** Extra work to run after each successful push, e.g. uploading attachment files. */
export function registerSyncTask(task: SyncTask): () => void {
  tasks.add(task);
  return () => tasks.delete(task);
}

let engine: SyncEngine | null = null;

export function startSync(db: MizanDB, client: SupabaseClient, userId: string) {
  engine?.stop();
  engine = new SyncEngine(db, client, userId);
  void engine.start();
}

export function stopSync() {
  engine?.stop();
  engine = null;
}

export function syncNow() {
  return engine?.syncNow();
}
