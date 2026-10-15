import { Dialog as D } from 'radix-ui';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useT } from '@/lib/i18n';

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
}

export function Dialog({ open, onOpenChange, title, description, children, footer, className }: DialogProps) {
  const t = useT();
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="anim-overlay fixed inset-0 z-[var(--z-overlay)] bg-[var(--surface-overlay)] backdrop-blur-[2px]" />
        <D.Content
          className={cn(
            'anim-dialog fixed inset-0 z-[var(--z-sheet)] m-auto h-fit max-h-[calc(100dvh-32px)] w-[calc(100vw-32px)] max-w-[440px] overflow-y-auto',
            'rounded-sheet border border-border bg-surface-2 p-6 shadow-sheet focus:outline-none',
            className,
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <D.Title className="text-lg font-semibold text-text">{title}</D.Title>
            <D.Close
              aria-label={t('c.close')}
              className="-me-2 -mt-1 inline-flex size-8 items-center justify-center rounded-control text-text-3 hover:bg-surface-3 hover:text-text"
            >
              <X size={18} />
            </D.Close>
          </div>
          {description ? (
            <D.Description className="mt-2 text-base text-text-2">{description}</D.Description>
          ) : (
            <D.Description className="sr-only">{title}</D.Description>
          )}
          {children && <div className="mt-5">{children}</div>}
          {footer && <div className="mt-6 flex flex-wrap justify-end gap-2">{footer}</div>}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
