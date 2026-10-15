import { describe, expect, it } from 'vitest';
import { cursorWithOverlap, shouldApplyRemote } from './merge';

describe('shouldApplyRemote (last-write-wins)', () => {
  it('takes the server row when there is no local copy', () => {
    expect(shouldApplyRemote(undefined, { updated_at: '2026-10-11T10:00:00.000Z' })).toBe(true);
  });
  it('takes a newer server row', () => {
    expect(shouldApplyRemote({ updated_at: '2026-10-11T10:00:00.000Z' }, { updated_at: '2026-10-11T10:00:01.000Z' })).toBe(true);
  });
  it('keeps a newer local edit', () => {
    expect(shouldApplyRemote({ updated_at: '2026-10-11T10:00:02.000Z' }, { updated_at: '2026-10-11T10:00:01.000Z' })).toBe(false);
  });
  it('accepts an equal timestamp (own echo / replay)', () => {
    expect(shouldApplyRemote({ updated_at: '2026-10-11T10:00:00.000Z' }, { updated_at: '2026-10-11T10:00:00.000Z' })).toBe(true);
  });
  it('compares instants, not strings (different offsets)', () => {
    expect(shouldApplyRemote({ updated_at: '2026-10-11T13:00:00+03:00' }, { updated_at: '2026-10-11T10:00:01Z' })).toBe(true);
  });
});

describe('cursorWithOverlap', () => {
  it('starts from the epoch with no cursor', () => {
    expect(cursorWithOverlap(undefined)).toBe('1970-01-01T00:00:00.000Z');
  });
  it('steps back by the overlap window', () => {
    expect(cursorWithOverlap('2026-10-11T10:00:10.000Z', 10_000)).toBe('2026-10-11T10:00:00.000Z');
  });
});
