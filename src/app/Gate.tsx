import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useAuth } from '@/lib/auth';
import { useProfile } from '@/lib/db/hooks';
import { useSyncStatus } from '@/lib/db/sync';
import { useT } from '@/lib/i18n';
import { Splash } from './RouteFallback';

/** Wait up to `ms` for the first pull from the server before deciding onboarding vs board. */
function useFirstPull(ms = 6000): boolean {
  const mode = useAuth((s) => s.mode);
  const done = useSyncStatus((s) => s.initialPullDone);
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setTimedOut(true), ms);
    return () => clearTimeout(id);
  }, [ms]);
  return mode !== 'cloud' || done || timedOut;
}

/** Signed in + onboarded → children. Otherwise routes to /welcome or /onboarding. */
export function RequireWorkspace({ children }: { children: ReactNode }) {
  const t = useT();
  const status = useAuth((s) => s.status);
  const profile = useProfile();
  const pulled = useFirstPull();

  if (status === 'loading') return <Splash label={t('app.loading')} />;
  if (status === 'signedOut') return <Navigate to="/welcome" replace />;
  if (profile === undefined || (!profile?.onboarded_at && !pulled)) return <Splash label={t('app.loading')} />;
  if (!profile?.onboarded_at) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

/** For /welcome: signed-in users go straight in. */
export function RedirectIfSignedIn({ children }: { children: ReactNode }) {
  const t = useT();
  const status = useAuth((s) => s.status);
  const location = useLocation();
  if (status === 'loading') return <Splash label={t('app.loading')} />;
  if (status === 'ready') return <Navigate to={(location.state as { from?: string } | null)?.from ?? '/board'} replace />;
  return <>{children}</>;
}

/** For /onboarding: needs an account, and skips ahead if already onboarded. */
export function RequireUnonboarded({ children }: { children: ReactNode }) {
  const t = useT();
  const status = useAuth((s) => s.status);
  const profile = useProfile();
  const pulled = useFirstPull();
  if (status === 'loading') return <Splash label={t('app.loading')} />;
  if (status === 'signedOut') return <Navigate to="/welcome" replace />;
  if (profile === undefined || (!profile?.onboarded_at && !pulled)) return <Splash label={t('app.loading')} />;
  if (profile?.onboarded_at) return <Navigate to="/board" replace />;
  return <>{children}</>;
}
