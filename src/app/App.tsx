import { RouterProvider } from 'react-router';
import { LazyMotion } from 'motion/react';
import { router } from './router';
import { TooltipProvider, Toaster } from '@/components/ui';
import { SettingsEffects } from '@/features/settings/settings';
import { useAuth } from '@/lib/auth';
// Registers the background upload of attachment files with the sync engine.
import '@/features/cards/attachments';

// Animation features load after first paint; until then elements render in their final state.
const loadMotion = () => import('./motionFeatures').then((r) => r.default);

export function App() {
  const ready = useAuth((s) => s.status === 'ready');
  return (
    <LazyMotion features={loadMotion} strict>
    <TooltipProvider>
      {ready && <SettingsEffects />}
      <RouterProvider router={router} />
      <Toaster />
    </TooltipProvider>
    </LazyMotion>
  );
}
