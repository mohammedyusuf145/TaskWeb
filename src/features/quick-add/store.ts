import { create } from 'zustand';

interface QuickAddState {
  open: boolean;
  boardId: string | null;
  columnId: string | null;
  /** Prefill, e.g. from a calendar slot (Phase 3). */
  dueAt: string | null;
  dueHasTime: boolean;
  show: (opts?: { boardId?: string | null; columnId?: string | null; dueAt?: string | null; dueHasTime?: boolean }) => void;
  hide: () => void;
}

export const useQuickAdd = create<QuickAddState>((set) => ({
  open: false,
  boardId: null,
  columnId: null,
  dueAt: null,
  dueHasTime: false,
  show: (opts = {}) =>
    set({ open: true, boardId: opts.boardId ?? null, columnId: opts.columnId ?? null, dueAt: opts.dueAt ?? null, dueHasTime: opts.dueHasTime ?? false }),
  hide: () => set({ open: false }),
}));

/** Board the user is looking at, set by the board page so "N" adds cards there. */
export const useCurrentBoard = create<{ boardId: string | null; set: (id: string | null) => void }>((set) => ({
  boardId: null,
  set: (boardId) => set({ boardId }),
}));
