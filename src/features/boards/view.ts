import { create } from 'zustand';
import type { Card, Priority } from '@/types/database';
import { dueState } from '@/features/cards/due';
import { addDays, startOfDay } from '@/lib/dates';
import { normalizeDigits } from '@/features/quick-add/parse';

export type GroupBy = 'column' | 'subject' | 'priority' | 'due';
export type DueFilter = 'any' | 'overdue' | 'today' | 'week' | 'none';

export interface BoardFilters {
  search: string;
  subjects: string[]; // subject ids; 'none' = no subject
  priorities: Priority[];
  due: DueFilter;
  labels: string[];
  examsOnly: boolean;
}

export const EMPTY_FILTERS: BoardFilters = { search: '', subjects: [], priorities: [], due: 'any', labels: [], examsOnly: false };

export function activeFilterCount(f: BoardFilters): number {
  return f.subjects.length + f.priorities.length + f.labels.length + (f.due !== 'any' ? 1 : 0) + (f.examsOnly ? 1 : 0);
}

/** Case/diacritic-insensitive text match across title, description, notes and labels. */
function fold(s: string): string {
  return normalizeDigits(s)
    .toLowerCase()
    .replace(/[ً-ْـ]/g, '')
    .replace(/[إأآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه');
}

export function matchesFilters(card: Card, f: BoardFilters, now = new Date()): boolean {
  if (f.search.trim()) {
    const hay = fold([card.title, card.description, card.notes, ...card.labels].join(' '));
    if (!fold(f.search).trim().split(/\s+/).every((w) => hay.includes(w))) return false;
  }
  if (f.subjects.length && !f.subjects.includes(card.subject_id ?? 'none')) return false;
  if (f.priorities.length && !f.priorities.includes(card.priority)) return false;
  if (f.labels.length && !f.labels.some((l) => card.labels.includes(l))) return false;
  if (f.examsOnly && !card.is_exam) return false;
  if (f.due !== 'any') {
    const done = Boolean(card.completed_at);
    const state = dueState(card.due_at, done, now);
    if (f.due === 'none' && card.due_at) return false;
    if (f.due === 'overdue' && state !== 'overdue') return false;
    if (f.due === 'today' && !(card.due_at && !done && (state === 'today' || state === 'overdue'))) return false;
    if (f.due === 'week') {
      if (!card.due_at || done) return false;
      if (new Date(card.due_at) >= addDays(startOfDay(now), 7)) return false;
    }
  }
  return true;
}

export type DueBucket = 'overdue' | 'today' | 'tomorrow' | 'week' | 'later' | 'none' | 'done';

export function dueBucket(card: Card, now = new Date()): DueBucket {
  if (card.completed_at) return 'done';
  if (!card.due_at) return 'none';
  const due = new Date(card.due_at);
  if (due < now) return 'overdue';
  const today = startOfDay(now);
  if (due < addDays(today, 1)) return 'today';
  if (due < addDays(today, 2)) return 'tomorrow';
  if (due < addDays(today, 7)) return 'week';
  return 'later';
}

// ── View state (search/filters are per session; grouping is remembered) ────

const GROUP_KEY = 'mizan.board.groupBy';
function readGroup(): GroupBy {
  try {
    const v = localStorage.getItem(GROUP_KEY);
    if (v === 'subject' || v === 'priority' || v === 'due' || v === 'column') return v;
  } catch {
    /* ignore */
  }
  return 'column';
}

interface ViewState {
  filters: BoardFilters;
  groupBy: GroupBy;
  setFilters: (patch: Partial<BoardFilters>) => void;
  clearFilters: () => void;
  setGroupBy: (g: GroupBy) => void;
}

export const useBoardView = create<ViewState>((set, get) => ({
  filters: EMPTY_FILTERS,
  groupBy: readGroup(),
  setFilters: (patch) => set({ filters: { ...get().filters, ...patch } }),
  clearFilters: () => set({ filters: { ...EMPTY_FILTERS, search: get().filters.search } }),
  setGroupBy: (groupBy) => {
    try {
      localStorage.setItem(GROUP_KEY, groupBy);
    } catch {
      /* ignore */
    }
    set({ groupBy });
  },
}));
