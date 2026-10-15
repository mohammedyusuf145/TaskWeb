import { describe, expect, it } from 'vitest';
import { positionAt, positionBetween, positionsAfter } from './position';

describe('fractional positions', () => {
  it('orders between neighbours', () => {
    const [a, b] = positionsAfter(null, 2) as [string, string];
    const mid = positionBetween(a, b);
    expect(a < mid && mid < b).toBe(true);
  });
  it('positionAt start, middle, end', () => {
    const items = positionsAfter(null, 3).map((position) => ({ position }));
    const start = positionAt(items, 0);
    const middle = positionAt(items, 2);
    const end = positionAt(items, 3);
    expect(start < items[0]!.position).toBe(true);
    expect(items[1]!.position < middle && middle < items[2]!.position).toBe(true);
    expect(end > items[2]!.position).toBe(true);
  });
  it('survives many inserts at the same spot', () => {
    let lo = positionBetween(null, null);
    const hi = positionBetween(lo, null);
    for (let i = 0; i < 200; i++) {
      const next = positionBetween(lo, hi);
      expect(lo < next && next < hi).toBe(true);
      lo = next;
    }
  });
  it('repairs inverted neighbours instead of throwing', () => {
    const [a, b] = positionsAfter(null, 2) as [string, string];
    expect(positionBetween(b, a) > b).toBe(true);
    expect(() => positionBetween('not a key', null)).not.toThrow();
  });
});
