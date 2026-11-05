import { generateKeyBetween, generateNKeysBetween } from 'fractional-indexing';

/**
 * Fractional positions: inserting between two items never rewrites the others,
 * so concurrent edits on two devices don't fight over indexes.
 */
export function positionBetween(before: string | null | undefined, after: string | null | undefined): string {
  const a = before ?? null;
  const b = after ?? null;
  try {
    if (a !== null && b !== null && a >= b) return generateKeyBetween(a, null); // repair bad ordering
    return generateKeyBetween(a, b);
  } catch {
    // A malformed key (e.g. edited by hand) must never block a move: fall back to the end.
    try {
      return generateKeyBetween(a, null);
    } catch {
      return generateKeyBetween(null, null);
    }
  }
}

/** Position for placing an item at `index` within `siblings` (already sorted, excluding the moved item). */
export function positionAt<T extends { position: string }>(siblings: T[], index: number): string {
  const i = Math.max(0, Math.min(index, siblings.length));
  return positionBetween(siblings[i - 1]?.position, siblings[i]?.position);
}

export function positionsAfter(last: string | null | undefined, n: number): string[] {
  return generateNKeysBetween(last ?? null, null, n);
}

export const byPosition = <T extends { position: string }>(a: T, b: T) => (a.position < b.position ? -1 : a.position > b.position ? 1 : 0);
