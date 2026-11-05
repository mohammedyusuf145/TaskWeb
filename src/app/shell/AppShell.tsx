import { Outlet, useLocation } from 'react-router';
import { Suspense } from 'react';
import { MotionConfig } from 'motion/react';
import * as m from 'motion/react-m';
import { useReducedMotion } from '@/lib/prefs';
import { useT } from '@/lib/i18n';
import { useMediaQuery } from '@/lib/useMediaQuery';
import { Sidebar } from './Sidebar';
import { BottomTabs } from './BottomTabs';
import { CommandPalette } from './CommandPalette';
import { RouteFallback } from '../RouteFallback';
import { ShortcutsDialog, useShortcutsDialog } from './ShortcutsDialog';
import { QuickAddDialog } from '@/features/quick-add/QuickAddDialog';
import { useQuickAdd } from '@/features/quick-add/store';
import { useHotkeys } from '@/lib/hotkeys';
import { ReminderScheduler } from '@/features/reminders/ReminderScheduler';
import { TimerRunner } from '@/features/timer/TimerRunner';

/**
 * The app sits on a canvas laid over a darker frame, like a sheet on a designer's desk.
 * Phone (<768): full-bleed canvas + floating dock.
 * Tablet (768–1023): icon rail on the frame.
 * Desktop (≥1024): full sidebar on the frame, user-collapsible.
 */
export function AppShell() {
  const t = useT();
  const desktop = useMediaQuery('(min-width: 1024px)');
  const reduced = useReducedMotion();
  // One entrance per destination: the canvas content rises into place on navigation.
  const section = useLocation().pathname.split('/')[1] ?? '';
  useHotkeys({
    n: () => useQuickAdd.getState().show(),
    '?': () => useShortcutsDialog.getState().setOpen(true),
  });
  return (
    <MotionConfig reducedMotion={reduced ? 'always' : 'never'} transition={{ type: 'spring', stiffness: 520, damping: 50, mass: 0.9 }}>
    <div className="flex min-h-dvh bg-frame">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-[var(--z-toast)] focus:rounded-control focus:bg-accent focus:px-3 focus:py-2 focus:text-accent-ink"
      >
        {t('app.skip')}
      </a>
      <Sidebar forceCollapsed={!desktop} />
      <main
        id="main"
        tabIndex={-1}
        className="min-w-0 flex-1 bg-bg pb-[calc(var(--bottombar-h)+env(safe-area-inset-bottom))] [overflow:clip] focus:outline-none md:mt-2 md:me-2 md:min-h-[calc(100dvh-8px)] md:rounded-t-[var(--radius-canvas)] md:border md:border-b-0 md:border-border md:pb-0 md:shadow-card"
      >
        <m.div
          key={section}
          initial={reduced ? false : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
          className="flex min-h-full flex-col"
        >
          <Suspense fallback={<RouteFallback />}>
            <Outlet />
          </Suspense>
        </m.div>
      </main>
      <BottomTabs />
      <CommandPalette />
      <QuickAddDialog />
      <ShortcutsDialog />
      <ReminderScheduler />
      <TimerRunner />
    </div>
    </MotionConfig>
  );
}
