/// <reference lib="webworker" />
/**
 * Mizan service worker.
 * Phase 3: web push reminders + notification clicks + precaching of the app shell.
 * Phase 6 extends this with runtime caching and the offline experience.
 */
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<{ url: string; revision: string | null }> };

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
// Single-page app: every navigation serves index.html from the cache, so the app opens offline.
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html'), { denylist: [/^\/functions\//, /^\/auth\//] }));

self.addEventListener('install', () => void self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

interface ReminderPayload {
  title: string;
  body: string;
  tag?: string;
  url?: string;
  lang?: string;
  dir?: NotificationDirection;
}

self.addEventListener('push', (event) => {
  let data: ReminderPayload;
  try {
    data = event.data?.json() as ReminderPayload;
  } catch {
    data = { title: 'Mizan', body: event.data?.text() ?? '' };
  }
  event.waitUntil(
    (async () => {
      // If Mizan is open and focused, let the page show it in-app instead of a system banner.
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const focused = windows.find((c) => (c as WindowClient).focused);
      if (focused) {
        focused.postMessage({ type: 'reminder', payload: data });
        return;
      }
      await self.registration.showNotification(data.title, {
        body: data.body,
        tag: data.tag,
        lang: data.lang,
        dir: data.dir,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        data: { url: data.url ?? '/' },
      });
    })(),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL((event.notification.data as { url?: string } | null)?.url ?? '/', self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const existing = windows.find((c) => new URL(c.url).origin === self.location.origin) as WindowClient | undefined;
      if (existing) {
        await existing.focus();
        existing.postMessage({ type: 'navigate', url });
        return;
      }
      await self.clients.openWindow(url);
    })(),
  );
});
