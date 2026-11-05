import { create } from 'zustand';
import { getDb, getUserId } from '@/lib/db';
import { upsert } from '@/lib/db/repo';
import {
  advance,
  initialState,
  markHidden,
  pause,
  setConfig,
  setMode,
  skip,
  start,
  stop,
  type Mode,
  type SessionLog,
  type TimerConfig,
  type TimerState,
} from './engine';

interface TimerStore {
  state: TimerState;
  /** updated_at of the row we last wrote or applied, to ignore our own echoes. */
  appliedAt: string | null;
  loaded: boolean;
}

export const useTimer = create<TimerStore>(() => ({ state: initialState(), appliedAt: null, loaded: false }));

type Listener = (logs: SessionLog[], ended: TimerState['phase'][], prev: TimerState) => void;
const listeners = new Set<Listener>();
/** Called after phases end (chime, notification, milestones). */
export function onPhaseEnd(fn: Listener) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Deterministic UUID from a string (SHA-1, v5 layout) so the same session logs once across devices. */
export async function uuidFromKey(key: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-1', new TextEncoder().encode(key))).slice(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function writeLogs(logs: SessionLog[]) {
  if (!logs.length) return;
  const userId = getUserId();
  for (const l of logs) {
    const id = await uuidFromKey(`${userId}:${l.key}`);
    // A row from another device for the same session already exists: keep it (same content).
    if (await getDb().focus_sessions.get(id)) continue;
    await upsert('focus_sessions', {
      id,
      kind: l.kind,
      started_at: new Date(l.startedAt).toISOString(),
      ended_at: new Date(l.endedAt).toISOString(),
      planned_sec: l.plannedSec,
      focused_sec: l.focusedSec,
      completed: l.completed,
      subject_id: l.subjectId,
      card_id: l.cardId,
    });
  }
}

/** Save locally (instant) and queue for sync; other devices pick it up via Realtime. */
async function commit(next: TimerState, logs: SessionLog[] = []) {
  useTimer.setState({ state: next });
  const row = await upsert('timer_state', { id: getUserId(), state: next as unknown as Record<string, unknown> });
  useTimer.setState({ appliedAt: row.updated_at });
  await writeLogs(logs);
}

/** Apply a state that arrived from storage or another device. */
export function applyRemote(state: TimerState, updatedAt: string) {
  const { appliedAt } = useTimer.getState();
  if (appliedAt && updatedAt <= appliedAt) return;
  useTimer.setState({ state, appliedAt: updatedAt, loaded: true });
}

export function markLoaded() {
  useTimer.setState({ loaded: true });
}

const cur = () => useTimer.getState().state;

export const timer = {
  start: () => commit(start(cur(), Date.now())),
  pause: () => commit(pause(cur(), Date.now())),
  toggle: () => (cur().status === 'running' ? timer.pause() : timer.start()),
  skip: () => {
    const r = skip(cur(), Date.now());
    return commit(r.state, r.log ? [r.log] : []);
  },
  stop: () => {
    const r = stop(cur(), Date.now());
    return commit(r.state, r.log ? [r.log] : []);
  },
  setMode: (mode: Mode) => commit(setMode(cur(), mode)),
  setConfig: (config: TimerConfig) => commit(setConfig(cur(), config)),
  link: (patch: { subjectId?: string | null; cardId?: string | null }) => commit({ ...cur(), ...patch }),
  /** Bring the timer up to date; returns true if a phase ended. */
  tick: async () => {
    const prev = cur();
    const r = advance(prev, Date.now());
    if (!r.ended.length) return false;
    await commit(r.state, r.logs);
    listeners.forEach((fn) => fn(r.logs, r.ended, prev));
    return true;
  },
  visibility: (hiddenAt: number, visibleAt: number) => {
    const next = markHidden(cur(), hiddenAt, visibleAt);
    if (next !== cur()) void commit(next);
  },
};
