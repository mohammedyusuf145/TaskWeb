/**
 * Monotonic ISO timestamps for last-write-wins.
 * Two edits in the same millisecond still get strictly increasing times,
 * and a new edit is always later than the row it replaces.
 */
let last = 0;

export function nowIso(after?: string | null): string {
  let t = Date.now();
  const floor = Math.max(last, after ? Date.parse(after) || 0 : 0);
  if (t <= floor) t = floor + 1;
  last = t;
  return new Date(t).toISOString();
}

/** Test helper. */
export function resetClock() {
  last = 0;
}
