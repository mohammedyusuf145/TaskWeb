import { Cloud, CloudOff, HardDrive, RefreshCw, CircleAlert } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useSyncStatus } from '@/lib/db/sync';
import { usePendingCount } from '@/lib/db/hooks';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/cn';

/** Quiet status line: where your data lives and whether it's caught up. */
export function SyncIndicator({ compact = false }: { compact?: boolean }) {
  const t = useT();
  const mode = useAuth((s) => s.mode);
  const state = useSyncStatus((s) => s.state);
  const pending = usePendingCount();

  let icon = <HardDrive size={14} />;
  let label: string = t('sync.local');
  let tone = 'text-text-3';

  if (mode === 'cloud') {
    if (state === 'offline') {
      icon = <CloudOff size={14} />;
      label = t('sync.offline');
      tone = 'text-warning';
    } else if (state === 'error') {
      icon = <CircleAlert size={14} />;
      label = t('sync.error');
      tone = 'text-danger';
    } else if (state === 'syncing' || pending > 0) {
      icon = <RefreshCw size={14} className="anim-spin" />;
      label = pending > 0 ? t('sync.pending', { n: pending }) : t('sync.syncing');
    } else {
      icon = <Cloud size={14} />;
      label = t('sync.synced');
    }
  }

  return (
    <div role="status" aria-live="polite" title={label} className={cn('flex min-w-0 items-center gap-2 text-xs', tone)}>
      <span className="shrink-0">{icon}</span>
      <span className={cn('truncate', compact && 'sr-only')}>{label}</span>
    </div>
  );
}
