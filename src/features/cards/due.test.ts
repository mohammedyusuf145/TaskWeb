import { describe, expect, it } from 'vitest';
import { dueState } from './due';

const now = new Date(2026, 9, 11, 12, 0);
const at = (d: number, h: number) => new Date(2026, 9, 11 + d, h, 0).toISOString();

describe('dueState', () => {
  it('no date', () => expect(dueState(null, false, now)).toBe('none'));
  it('past and not done is overdue', () => expect(dueState(at(0, 9), false, now)).toBe('overdue'));
  it('later today', () => expect(dueState(at(0, 18), false, now)).toBe('today'));
  it('within two days is soon', () => expect(dueState(at(2, 9), false, now)).toBe('soon'));
  it('further out is later', () => expect(dueState(at(5, 9), false, now)).toBe('later'));
  it('completed cards are never urgent', () => expect(dueState(at(-1, 9), true, now)).toBe('done'));
});
