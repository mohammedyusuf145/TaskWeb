import type { BaseRow } from '@/types/database';

/**
 * Decide whether an incoming server row should replace the local one.
 * Last write wins on `updated_at` (the time of the user's edit).
 *
 * - No local row: take the server row.
 * - Server row is newer or equal: take it (equal means it's our own echo or an identical replay).
 * - Local row is newer: keep local. If it is not queued for push (should not happen),
 *   the server will be corrected on the next flush only if it is queued, so we still keep local.
 */
export function shouldApplyRemote(local: Pick<BaseRow, 'updated_at'> | undefined, remote: Pick<BaseRow, 'updated_at'>): boolean {
  if (!local) return true;
  return Date.parse(remote.updated_at) >= Date.parse(local.updated_at);
}

/** Merge a partial edit into an existing row, producing the new full row. */
export function applyPatch<T extends BaseRow>(existing: T | undefined, patch: Partial<T>, base: Partial<T>): T {
  return { ...base, ...existing, ...patch } as T;
}

/** Move a pull cursor back a little so commits that landed out of order are not missed. */
export function cursorWithOverlap(cursor: string | undefined, overlapMs = 10_000): string {
  if (!cursor) return '1970-01-01T00:00:00.000Z';
  return new Date(Math.max(0, Date.parse(cursor) - overlapMs)).toISOString();
}
