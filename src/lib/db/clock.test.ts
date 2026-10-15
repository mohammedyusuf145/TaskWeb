import { afterEach, describe, expect, it, vi } from 'vitest';
import { nowIso, resetClock } from './clock';

afterEach(() => {
  vi.useRealTimers();
  resetClock();
});

describe('nowIso', () => {
  it('is strictly increasing even within one millisecond', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-11T10:00:00.000Z'));
    const a = nowIso();
    const b = nowIso();
    const c = nowIso();
    expect(a < b && b < c).toBe(true);
  });
  it('is always later than the row being replaced, even if the device clock is behind', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-11T10:00:00.000Z'));
    const next = nowIso('2026-10-11T12:00:00.000Z');
    expect(Date.parse(next)).toBeGreaterThan(Date.parse('2026-10-11T12:00:00.000Z'));
  });
});
