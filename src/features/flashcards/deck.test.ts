import { describe, expect, it } from 'vitest';
import type { Flashcard } from '@/types/database';
import { deckStats, forecast, parseImport, shuffle, stage } from './deck';

const now = new Date(2026, 10, 6, 10);
const card = (p: Partial<Flashcard>): Flashcard => ({ id: Math.random().toString(36), front: 'f', back: 'b', ease: 2.5, interval_days: 0, repetitions: 0, lapses: 0, due_at: now.toISOString(), subject_id: null, deleted_at: null, ...p }) as Flashcard;
const inDays = (d: number) => new Date(2026, 10, 6 + d, 9).toISOString();

describe('deck stages and stats', () => {
  it('classifies new, learning and mature', () => {
    expect(stage(card({}))).toBe('new');
    expect(stage(card({ repetitions: 2, interval_days: 6 }))).toBe('learning');
    expect(stage(card({ repetitions: 0, lapses: 1, interval_days: 0 }))).toBe('learning');
    expect(stage(card({ repetitions: 6, interval_days: 30 }))).toBe('mature');
  });
  it('counts due cards and mastery', () => {
    const s = deckStats([card({}), card({ repetitions: 5, interval_days: 40, due_at: inDays(10) }), card({ repetitions: 1, interval_days: 1, due_at: inDays(-2) })], now);
    expect(s).toMatchObject({ total: 3, due: 2, new: 1, learning: 1, mature: 1 });
    expect(s.mastery).toBeCloseTo(1 / 3);
  });
  it('forecasts the next days, folding overdue into today', () => {
    expect(forecast([card({ due_at: inDays(-3) }), card({ due_at: inDays(0) }), card({ due_at: inDays(2) }), card({ due_at: inDays(30) })], 7, now)).toEqual([2, 0, 1, 0, 0, 0, 0]);
  });
});

describe('import', () => {
  it('splits on tab, semicolon, dash and double colon; reports skipped lines', () => {
    const r = parseImport('photosynthesis\tmaking food from light\nالخلية ; وحدة بناء الكائن الحي\n2+2 - 4\nH2O :: water\nno separator here\n\n');
    expect(r.cards).toEqual([
      { front: 'photosynthesis', back: 'making food from light' },
      { front: 'الخلية', back: 'وحدة بناء الكائن الحي' },
      { front: '2+2', back: '4' },
      { front: 'H2O', back: 'water' },
    ]);
    expect(r.skipped).toBe(1);
  });
  it('keeps hyphenated words intact', () => {
    expect(parseImport('well-known - famous').cards).toEqual([{ front: 'well-known', back: 'famous' }]);
  });
  it('shuffle keeps every item', () => {
    let seed = 1;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    expect(shuffle([1, 2, 3, 4, 5], rand).sort()).toEqual([1, 2, 3, 4, 5]);
  });
});
