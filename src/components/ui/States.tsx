import type { ReactNode } from 'react';
import { CircleAlert } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useT } from '@/lib/i18n';
import { Button } from './Button';

/**
 * Empty state: says what this place is for and offers the next step.
 * Left-aligned (inline-start) like the rest of the UI, never a centred hero.
 */
export function EmptyState({
  icon,
  title,
  body,
  action,
  className,
  children,
}: {
  icon?: ReactNode;
  title: ReactNode;
  body?: ReactNode;
  action?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <section className={cn('flex max-w-[480px] flex-col items-start gap-3', className)}>
      {icon && (
        <div className="mb-1 inline-flex size-10 items-center justify-center rounded-pop border border-border bg-surface-2 text-text-2 raised">
          {icon}
        </div>
      )}
      <h2 className="text-lg font-semibold text-text text-balance">{title}</h2>
      {body && <p className="text-base text-text-2">{body}</p>}
      {children}
      {action && <div className="mt-2 flex flex-wrap gap-2">{action}</div>}
    </section>
  );
}

export function ErrorState({ title, body, onRetry }: { title?: ReactNode; body?: ReactNode; onRetry?: () => void }) {
  const t = useT();
  return (
    <EmptyState
      icon={<CircleAlert size={20} className="text-danger" />}
      title={title ?? t('err.title')}
      body={body ?? t('err.body')}
      action={onRetry && <Button onClick={onRetry}>{t('c.retry')}</Button>}
    />
  );
}
