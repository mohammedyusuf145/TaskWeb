import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Search, Settings } from 'lucide-react';
import { useT } from '@/lib/i18n';
import { IconButton } from '@/components/ui';
import { usePalette } from './CommandPalette';
import { LogoMark } from './Logo';
import { ReminderCenter } from '@/features/reminders/ReminderCenter';

/**
 * Page title row. On phones it also carries search and settings,
 * since the tab bar holds only the five main destinations.
 */
export function PageHeader({ title, meta, actions }: { title: ReactNode; meta?: ReactNode; actions?: ReactNode }) {
  const t = useT();
  const openPalette = usePalette((s) => s.setOpen);
  return (
    <header className="sticky top-0 z-[var(--z-sticky)] border-b border-border bg-[color-mix(in_oklab,var(--bg),transparent_8%)] backdrop-blur-xl md:rounded-t-[var(--radius-canvas)]">
      <div className="mx-auto flex h-14 max-w-[var(--content-max)] items-center gap-3 px-4 md:h-[68px] md:px-8">
        <span className="md:hidden">
          <LogoMark size={24} />
        </span>
        <div className="flex min-w-0 flex-1 items-baseline gap-3">
          {typeof title === 'string' ? <h1 className="truncate font-display text-xl font-semibold text-text md:text-2xl">{title}</h1> : title}
          {meta && <div className="hidden truncate text-sm text-text-3 sm:block">{meta}</div>}
        </div>
        {actions}
        <ReminderCenter />
        <div className="-ms-2 flex items-center md:hidden">
          <IconButton label={t('nav.search')} icon={<Search size={18} />} onClick={() => openPalette(true)} tooltip={false} />
          <Link
            to="/settings"
            aria-label={t('nav.settings')}
            className="inline-flex size-10 items-center justify-center rounded-control text-text-2 hover:bg-surface-3 hover:text-text"
          >
            <Settings size={18} />
          </Link>
        </div>
      </div>
    </header>
  );
}

export function PageBody({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-[var(--content-max)] px-4 py-6 md:px-8 md:py-8 ${className}`}>{children}</div>;
}
