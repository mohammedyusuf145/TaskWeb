import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { connectDatabase, disconnectDatabase, getDb, useDbStore } from '@/lib/db';
import type { MizanDB } from '@/lib/db/schema';
import { timer, useTimer, uuidFromKey } from './store';
import { initialState, start } from './engine';

const USER = '11111111-1111-1111-1111-111111111111';
let db: MizanDB;

beforeEach(() => {
  db = connectDatabase(`timer-${Math.random()}`);
  useDbStore.setState({ userId: USER });
  useTimer.setState({ state: initialState(), appliedAt: null, loaded: true });
});
afterEach(async () => {
  vi.useRealTimers();
  await db.delete();
  disconnectDatabase();
});

describe('uuidFromKey', () => {
  it('is deterministic and UUID-shaped', async () => {
    const a = await uuidFromKey('u:pomodoro:123');
    expect(a).toBe(await uuidFromKey('u:pomodoro:123'));
    expect(a).not.toBe(await uuidFromKey('u:pomodoro:124'));
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});

describe('timer store', () => {
  it('persists state to timer_state (synced row keyed by user)', async () => {
    await timer.start();
    const row = await getDb().timer_state.get(USER);
    expect((row?.state as { status: string }).status).toBe('running');
    expect(await getDb().outbox.get(`timer_state:${USER}`)).toBeTruthy();
  });

  it('logs a completed session exactly once, even if two devices complete it', async () => {
    const t0 = Date.UTC(2026, 9, 11, 14);
    const running = start(initialState(), t0);
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(t0 + 26 * 60_000);

    useTimer.setState({ state: running });
    expect(await timer.tick()).toBe(true);
    // A second device with the same pre-completion state completes it too.
    useTimer.setState({ state: running });
    expect(await timer.tick()).toBe(true);

    const sessions = await getDb().focus_sessions.toArray();
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({ focused_sec: 1500, completed: true, kind: 'focus' });
    expect(useTimer.getState().state.phase).toBe('short_break');
  });

  it('skip logs a partial session with its subject and card', async () => {
    const t0 = Date.now();
    useTimer.setState({ state: { ...start(initialState(), t0 - 12 * 60_000), subjectId: 's1', cardId: 'c1' } });
    await timer.skip();
    const [s] = await getDb().focus_sessions.toArray();
    expect(s).toMatchObject({ completed: false, subject_id: 's1', card_id: 'c1' });
    expect(s!.focused_sec).toBeGreaterThanOrEqual(719);
  });
});
