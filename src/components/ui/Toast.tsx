import { create } from 'zustand';
import { Check, CircleAlert, Info, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useT } from '@/lib/i18n';

export interface ToastItem {
  id: number;
  message: string;
  tone: 'neutral' | 'success' | 'danger';
  action?: { label: string; onClick: () => void };
  duration: number;
}

interface ToastState {
  items: ToastItem[];
  push: (t: Omit<ToastItem, 'id' | 'duration' | 'tone'> & Partial<Pick<ToastItem, 'duration' | 'tone'>>) => number;
  dismiss: (id: number) => void;
}

let seq = 0;
const timers = new Map<number, ReturnType<typeof setTimeout>>();

export const useToasts = create<ToastState>((set, get) => ({
  items: [],
  push: (t) => {
    const id = ++seq;
    const item: ToastItem = { tone: 'neutral', duration: t.action ? 6000 : 3500, ...t, id };
    set({ items: [...get().items.slice(-2), item] });
    timers.set(id, setTimeout(() => get().dismiss(id), item.duration));
    return id;
  },
  dismiss: (id) => {
    clearTimeout(timers.get(id));
    timers.delete(id);
    set({ items: get().items.filter((i) => i.id !== id) });
  },
}));

export const toast = (message: string, opts: Partial<Omit<ToastItem, 'id' | 'message'>> = {}) =>
  useToasts.getState().push({ message, ...opts });

const icons = {
  neutral: <Info size={16} className="text-text-2" />,
  success: <Check size={16} className="text-accent" />,
  danger: <CircleAlert size={16} className="text-danger" />,
};

/** Toast region. Bottom inline-end on desktop (clear of the sidebar); above the tab bar on phones. */
export function Toaster() {
  const items = useToasts((s) => s.items);
  const dismiss = useToasts((s) => s.dismiss);
  const t = useT();
  return (
    <div
      aria-live="polite"
      role="status"
      className={cn(
        'pointer-events-none fixed inset-x-4 bottom-[calc(var(--bottombar-h)+16px+env(safe-area-inset-bottom))] z-[var(--z-toast)] flex flex-col items-center gap-2',
        'md:inset-x-auto md:end-6 md:bottom-6 md:items-end',
      )}
    >
      {items.map((i) => (
        <div
          key={i.id}
          className="anim-toast pointer-events-auto flex w-full max-w-[400px] items-center gap-3 rounded-pop border border-border bg-surface-3 py-2.5 ps-3.5 pe-2 text-base text-text shadow-pop"
        >
          {icons[i.tone]}
          <span className="min-w-0 flex-1">{i.message}</span>
          {i.action && (
            <button
              type="button"
              onClick={() => {
                i.action!.onClick();
                dismiss(i.id);
              }}
              className="rounded-control px-2 py-1 text-base font-medium text-accent-text hover:bg-accent-soft"
            >
              {i.action.label}
            </button>
          )}
          <button
            type="button"
            aria-label={t('c.close')}
            onClick={() => dismiss(i.id)}
            className="inline-flex size-8 items-center justify-center rounded-control text-text-3 hover:text-text"
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
