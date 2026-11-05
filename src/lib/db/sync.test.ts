import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { connectDatabase, disconnectDatabase } from './index';
import { upsert, softDelete } from './repo';
import { SyncEngine } from './sync';
import { openDatabase, type MizanDB } from './schema';

const USER = '11111111-1111-1111-1111-111111111111';

/** Minimal fake of the bits of supabase-js the engine uses, backed by an in-memory "server". */
function fakeClient(server: Map<string, Record<string, unknown>>, opts: { failWith?: { code?: string; message: string } } = {}) {
  let clock = Date.parse('2026-10-11T00:00:00Z');
  const from = (table: string) => ({
    upsert: async (rows: Record<string, unknown>[]) => {
      if (opts.failWith) return { error: opts.failWith };
      for (const r of rows) {
        const key = `${table}:${r.id}`;
        const prev = server.get(key);
        // Mirror the Postgres trigger: stale writes lose.
        if (prev && String(r.updated_at) < String(prev.updated_at)) continue;
        server.set(key, { ...r, server_updated_at: new Date(++clock).toISOString() });
      }
      return { error: null };
    },
    select: () => {
      let since = '';
      const q = {
        gt: (_c: string, v: string) => ((since = v), q),
        order: () => q,
        limit: async () => ({
          data: [...server.entries()]
            .filter(([k, r]) => k.startsWith(`${table}:`) && String(r.server_updated_at) > since)
            .map(([, r]) => r)
            .sort((a, b) => String(a.server_updated_at).localeCompare(String(b.server_updated_at))),
          error: null,
        }),
      };
      return q;
    },
  });
  const channel = { on: () => channel, subscribe: () => channel };
  return { from, channel: () => channel, removeChannel: async () => {} } as unknown as SupabaseClient;
}

let db: MizanDB;
beforeEach(() => {
  // A unique database per test; repo.ts reads the user id from the store, set in each test.
  db = connectDatabase(`${USER}-${Math.random()}`);
});
afterEach(async () => {
  await db.delete();
  disconnectDatabase();
});

describe('local writes', () => {
  it('queue one outbox entry per row, collapsing repeated edits', async () => {
    const { useDbStore } = await import('./index');
    useDbStore.setState({ userId: USER });
    const b = await upsert('boards', { name: 'School', position: 'a0', archived_at: null });
    await upsert('boards', { id: b.id, name: 'School 2' });
    const entries = await db.outbox.toArray();
    expect(entries).toHaveLength(1);
    expect(entries[0]!.rev).toBe(2);
    const row = await db.boards.get(b.id);
    expect(row?.name).toBe('School 2');
    expect(row?.user_id).toBe(USER);
    expect(Date.parse(row!.updated_at)).toBeGreaterThanOrEqual(Date.parse(row!.created_at));
  });

  it('soft delete writes a tombstone that syncs', async () => {
    const { useDbStore } = await import('./index');
    useDbStore.setState({ userId: USER });
    const b = await upsert('boards', { name: 'X', position: 'a0', archived_at: null });
    await softDelete('boards', [b.id]);
    expect((await db.boards.get(b.id))?.deleted_at).toBeTruthy();
  });
});

describe('SyncEngine', () => {
  it('pushes the outbox and clears it', async () => {
    const { useDbStore } = await import('./index');
    useDbStore.setState({ userId: USER });
    const server = new Map();
    await upsert('boards', { name: 'School', position: 'a0', archived_at: null });
    const engine = new SyncEngine(db, fakeClient(server), USER);
    await engine.flush();
    expect(server.size).toBe(1);
    expect(await db.outbox.count()).toBe(0);
  });

  it('keeps the outbox when the server rejects rows, and counts the attempt', async () => {
    const { useDbStore } = await import('./index');
    useDbStore.setState({ userId: USER });
    await upsert('boards', { name: 'School', position: 'a0', archived_at: null });
    const engine = new SyncEngine(db, fakeClient(new Map(), { failWith: { code: '23514', message: 'check' } }), USER);
    await expect(engine.flush()).rejects.toThrow();
    const [entry] = await db.outbox.toArray();
    expect(entry?.attempts).toBe(1);
  });

  it('does not penalise network failures', async () => {
    const { useDbStore } = await import('./index');
    useDbStore.setState({ userId: USER });
    await upsert('boards', { name: 'School', position: 'a0', archived_at: null });
    const engine = new SyncEngine(db, fakeClient(new Map(), { failWith: { message: 'Failed to fetch' } }), USER);
    await expect(engine.flush()).rejects.toThrow();
    expect((await db.outbox.toArray())[0]?.attempts).toBe(0);
  });

  it('applies remote rows with last-write-wins', async () => {
    const { useDbStore } = await import('./index');
    useDbStore.setState({ userId: USER });
    const local = await upsert('boards', { name: 'Local newer', position: 'a0', archived_at: null });
    const engine = new SyncEngine(db, fakeClient(new Map()), USER);
    const older = { ...local, name: 'Remote older', updated_at: new Date(Date.parse(local.updated_at) - 1000).toISOString() };
    await engine.applyRemote('boards', [older]);
    expect((await db.boards.get(local.id))?.name).toBe('Local newer');
    const newer = { ...local, name: 'Remote newer', updated_at: new Date(Date.parse(local.updated_at) + 1000).toISOString() };
    await engine.applyRemote('boards', [newer]);
    expect((await db.boards.get(local.id))?.name).toBe('Remote newer');
  });

  it('ignores rows that belong to another user', async () => {
    const engine = new SyncEngine(db, fakeClient(new Map()), USER);
    await engine.applyRemote('boards', [
      { id: 'x', user_id: 'someone-else', created_at: '', updated_at: '2026-01-01T00:00:00Z', deleted_at: null } as never,
    ]);
    expect(await db.boards.count()).toBe(0);
  });

  it('two devices converge through the server', async () => {
    const { useDbStore } = await import('./index');
    const server = new Map();
    const client = fakeClient(server);

    // Device A creates a board and pushes.
    useDbStore.setState({ userId: USER });
    const board = await upsert('boards', { name: 'From A', position: 'a0', archived_at: null });
    await new SyncEngine(db, client, USER).flush();

    // Device B (its own local database) pulls it.
    const dbB = openDatabase(`${USER}-deviceB-${Math.random()}`);
    const engineB = new SyncEngine(dbB, client, USER);
    await (engineB as unknown as { pull: () => Promise<void> }).pull();
    expect((await dbB.boards.get(board.id))?.name).toBe('From A');
    await dbB.delete();
  });
});
