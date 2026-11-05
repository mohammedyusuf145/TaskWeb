import { create } from 'zustand';
import { openDatabase, type MizanDB } from './schema';

interface DbState {
  db: MizanDB | null;
  userId: string | null;
}

export const useDbStore = create<DbState>(() => ({ db: null, userId: null }));

export function connectDatabase(userId: string): MizanDB {
  const current = useDbStore.getState();
  if (current.db && current.userId === userId) return current.db;
  current.db?.close();
  const db = openDatabase(userId);
  useDbStore.setState({ db, userId });
  return db;
}

export function disconnectDatabase() {
  useDbStore.getState().db?.close();
  useDbStore.setState({ db: null, userId: null });
}

/** The open database. Only call inside the signed-in app tree. */
export function getDb(): MizanDB {
  const { db } = useDbStore.getState();
  if (!db) throw new Error('Database is not connected');
  return db;
}

export function getUserId(): string {
  const { userId } = useDbStore.getState();
  if (!userId) throw new Error('No user');
  return userId;
}

export function useDb(): MizanDB {
  const db = useDbStore((s) => s.db);
  if (!db) throw new Error('Database is not connected');
  return db;
}

export type { MizanDB };
