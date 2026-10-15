import { createBrowserRouter, Navigate } from 'react-router';
import { AppShell } from './shell/AppShell';
import { RequireUnonboarded, RequireWorkspace, RedirectIfSignedIn } from './Gate';
import { NotFound, RouteError } from '@/routes/RouteError';
import { Splash } from './RouteFallback';

/** Each page is a separate chunk, loaded on first visit. */
export const router = createBrowserRouter([
  {
    errorElement: <RouteError />,
    hydrateFallbackElement: <Splash label="" />,
    children: [
      {
        path: '/welcome',
        lazy: async () => {
          const { AuthPage } = await import('@/routes/AuthPage');
          return { element: <RedirectIfSignedIn><AuthPage /></RedirectIfSignedIn> };
        },
      },
      {
        path: '/onboarding',
        lazy: async () => {
          const { OnboardingPage } = await import('@/routes/OnboardingPage');
          return { element: <RequireUnonboarded><OnboardingPage /></RequireUnonboarded> };
        },
      },
      {
        element: (
          <RequireWorkspace>
            <AppShell />
          </RequireWorkspace>
        ),
        children: [
          { index: true, element: <Navigate to="/board" replace /> },
          { path: '/board/:boardId?', lazy: async () => ({ Component: (await import('@/routes/BoardPage')).BoardPage }) },
          { path: '/calendar', lazy: async () => ({ Component: (await import('@/routes/CalendarPage')).CalendarPage }) },
          { path: '/focus', lazy: async () => ({ Component: (await import('@/routes/FocusPage')).FocusPage }) },
          { path: '/tutor/:threadId?', lazy: async () => ({ Component: (await import('@/routes/TutorPage')).TutorPage }) },
          { path: '/stats', lazy: async () => ({ Component: (await import('@/routes/StatsPage')).StatsPage }) },
          { path: '/settings', lazy: async () => ({ Component: (await import('@/routes/SettingsPage')).SettingsPage }) },
          { path: '/design', lazy: async () => ({ Component: (await import('@/routes/DesignPage')).DesignPage }) },
          { path: '*', element: <NotFound /> },
        ],
      },
    ],
  },
]);
