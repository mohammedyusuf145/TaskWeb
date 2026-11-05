import { useNavigate, useRouteError } from 'react-router';
import { Compass } from 'lucide-react';
import { useT } from '@/lib/i18n';
import { Button, EmptyState, ErrorState } from '@/components/ui';

export function RouteError() {
  const error = useRouteError();
  if (import.meta.env.DEV) console.error(error);
  return (
    <div className="mx-auto max-w-[var(--content-max)] px-4 py-16 md:px-8">
      <ErrorState onRetry={() => window.location.reload()} />
    </div>
  );
}

export function NotFound() {
  const t = useT();
  const navigate = useNavigate();
  return (
    <div className="mx-auto max-w-[var(--content-max)] px-4 py-16 md:px-8">
      <EmptyState
        icon={<Compass size={20} />}
        title={t('err.notFound')}
        action={
          <Button variant="primary" onClick={() => navigate('/board')}>
            {t('err.home')}
          </Button>
        }
      />
    </div>
  );
}
