import { describe, expect, it } from 'vitest';
import type { Card } from '@/types/database';
import { EMPTY_FILTERS, activeFilterCount, dueBucket, matchesFilters } from './view';

const now = new Date(2026, 9, 11, 14, 0);
const card = (over: Partial<Card> = {}): Card => ({
  id: 'c',
  user_id: 'u',
  board_id: 'b',
  column_id: 'col',
  subject_id: 'math',
  title: 'Worksheet 2.4',
  description: 'Derivatives practice',
  notes: '',
  due_at: null,
  due_has_time: false,
  priority: 'med',
  labels: ['revision'],
  is_exam: false,
  estimate_min: null,
  repeat_rule: null,
  position: 'a0',
  completed_at: null,
  is_sample: false,
  reminder_offsets: null,
  created_at: '',
  updated_at: '',
  deleted_at: null,
  ...over,
});
const at = (days: number, h = 12) => new Date(2026, 9, 11 + days, h).toISOString();
const f = (over = {}) => ({ ...EMPTY_FILTERS, ...over });

describe('matchesFilters', () => {
  it('search across title, description and labels, all words required', () => {
    expect(matchesFilters(card(), f({ search: 'derivatives' }), now)).toBe(true);
    expect(matchesFilters(card(), f({ search: 'worksheet revision' }), now)).toBe(true);
    expect(matchesFilters(card(), f({ search: 'worksheet physics' }), now)).toBe(false);
  });
  it('Arabic search ignores hamza forms and diacritics', () => {
    const c = card({ title: 'مراجعة الإحصاء' });
    expect(matchesFilters(c, f({ search: 'الاحصاء' }), now)).toBe(true);
    expect(matchesFilters(c, f({ search: 'مراجعه' }), now)).toBe(true);
  });
  it('subject, including "no subject"', () => {
    expect(matchesFilters(card(), f({ subjects: ['math'] }), now)).toBe(true);
    expect(matchesFilters(card(), f({ subjects: ['phys'] }), now)).toBe(false);
    expect(matchesFilters(card({ subject_id: null }), f({ subjects: ['none'] }), now)).toBe(true);
  });
  it('priority, labels, exams', () => {
    expect(matchesFilters(card({ priority: 'high' }), f({ priorities: ['high'] }), now)).toBe(true);
    expect(matchesFilters(card(), f({ priorities: ['high'] }), now)).toBe(false);
    expect(matchesFilters(card(), f({ labels: ['revision'] }), now)).toBe(true);
    expect(matchesFilters(card(), f({ examsOnly: true }), now)).toBe(false);
  });
  it('due filters', () => {
    expect(matchesFilters(card({ due_at: at(-1) }), f({ due: 'overdue' }), now)).toBe(true);
    expect(matchesFilters(card({ due_at: at(0, 18) }), f({ due: 'today' }), now)).toBe(true);
    expect(matchesFilters(card({ due_at: at(-1) }), f({ due: 'today' }), now)).toBe(true); // overdue still needs doing today
    expect(matchesFilters(card({ due_at: at(5) }), f({ due: 'week' }), now)).toBe(true);
    expect(matchesFilters(card({ due_at: at(9) }), f({ due: 'week' }), now)).toBe(false);
    expect(matchesFilters(card(), f({ due: 'none' }), now)).toBe(true);
    expect(matchesFilters(card({ due_at: at(-1), completed_at: at(-1) }), f({ due: 'overdue' }), now)).toBe(false);
  });
  it('counts active filters (search excluded)', () => {
    expect(activeFilterCount(f({ search: 'x', subjects: ['a', 'b'], due: 'week' }))).toBe(3);
  });
});

describe('dueBucket', () => {
  it('buckets by day', () => {
    expect(dueBucket(card({ due_at: at(-1) }), now)).toBe('overdue');
    expect(dueBucket(card({ due_at: at(0, 20) }), now)).toBe('today');
    expect(dueBucket(card({ due_at: at(1) }), now)).toBe('tomorrow');
    expect(dueBucket(card({ due_at: at(4) }), now)).toBe('week');
    expect(dueBucket(card({ due_at: at(20) }), now)).toBe('later');
    expect(dueBucket(card(), now)).toBe('none');
    expect(dueBucket(card({ completed_at: at(0) }), now)).toBe('done');
  });
});
