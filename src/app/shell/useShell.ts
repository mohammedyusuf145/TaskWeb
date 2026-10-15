import { create } from 'zustand';

const KEY = 'mizan.sidebarCollapsed';

function read(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export const useShell = create<{ collapsed: boolean; toggle: () => void }>((set, get) => ({
  collapsed: read(),
  toggle: () => {
    const collapsed = !get().collapsed;
    try {
      localStorage.setItem(KEY, collapsed ? '1' : '0');
    } catch {
      /* ignore */
    }
    set({ collapsed });
  },
}));
