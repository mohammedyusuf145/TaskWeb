import { Dialog as D } from 'radix-ui';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useT } from '@/lib/i18n';
import { useMediaQuery } from '@/lib/useMediaQuery';

export interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  /** 'auto' = side panel from the inline-end on desktop, bottom sheet on phones. */
  side?: 'auto' | 'end' | 'bottom';
  width?: number;
  /** Custom visible header (e.g. an editable title). `title` is then announced to screen readers only. */
  headerContent?: ReactNode;
  /** Extra header actions next to the close button. */
  actions?: ReactNode;
}

export function Sheet({ open, onOpenChange, title, description, children, footer, side = 'auto', width = 480, headerContent, actions }: SheetProps) {
  const t = useT();
  const wide = useMediaQuery('(min-width: 768px)');
  const resolved = side === 'auto' ? (wide ? 'end' : 'bottom') : side;

  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="anim-overlay fixed inset-0 z-[var(--z-overlay)] bg-[var(--surface-overlay)]" />
        <D.Content
          style={resolved === 'end' ? { width: `min(${width}px, 100vw)` } : undefined}
          className={cn(
            'fixed z-[var(--z-sheet)] flex flex-col border-border bg-surface-2 shadow-sheet focus:outline-none',
            resolved === 'end' && 'anim-sheet-end inset-y-0 end-0 border-s',
            resolved === 'bottom' && 'anim-sheet-bottom inset-x-0 bottom-0 max-h-[92dvh] rounded-t-sheet border-t safe-bottom',
          )}
        >
          {resolved === 'bottom' && <div aria-hidden className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-border-strong" />}
          <header className="flex items-start justify-between gap-4 px-6 pt-5 pb-4">
            <div className="min-w-0 flex-1">
              <D.Title className={headerContent ? 'sr-only' : 'text-lg font-semibold text-text'}>{title}</D.Title>
              {headerContent}
              {description ? (
                <D.Description className="mt-1 text-base text-text-2">{description}</D.Description>
              ) : (
                <D.Description className="sr-only">{title}</D.Description>
              )}
            </div>
            {actions}
            <D.Close
              aria-label={t('c.close')}
              className="-me-2 inline-flex size-10 shrink-0 items-center justify-center rounded-control text-text-3 hover:bg-surface-3 hover:text-text"
            >
              <X size={18} />
            </D.Close>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">{children}</div>
          {footer && <footer className="flex justify-end gap-2 border-t border-border px-6 py-4">{footer}</footer>}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
