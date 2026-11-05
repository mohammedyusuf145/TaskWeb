/**
 * Device notifications.
 *  - Signed in + VAPID key configured + service worker: real web push (works when the app is closed).
 *  - Otherwise: local notifications shown by the page while it's open in the background.
 */
import { supabase } from './supabase';
import { useAuth } from './auth';

const VAPID_PUBLIC_KEY = (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined) ?? '';
const ENDPOINT_KEY = 'mizan.pushEndpoint';

export type DeviceSupport = 'supported' | 'unsupported' | 'needs-install';

export function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function isIOS(): boolean {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function deviceSupport(): DeviceSupport {
  if (isIOS() && !isStandalone()) return 'needs-install';
  if (!('Notification' in window)) return 'unsupported';
  return 'supported';
}

/** True when reminders can reach this device while the app is closed. */
export function canUsePush(): boolean {
  return Boolean(
    VAPID_PUBLIC_KEY && supabase && useAuth.getState().mode === 'cloud' && 'serviceWorker' in navigator && 'PushManager' in window && import.meta.env.PROD,
  );
}

export function hasPushSubscription(): boolean {
  try {
    return Boolean(localStorage.getItem(ENDPOINT_KEY));
  } catch {
    return false;
  }
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function readyRegistration(timeoutMs = 4000): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  return Promise.race([navigator.serviceWorker.ready, new Promise<null>((r) => setTimeout(() => r(null), timeoutMs))]);
}

/** Ask permission and, where possible, subscribe this device to push. */
export async function enableDeviceNotifications(): Promise<'push' | 'local' | 'denied' | 'error'> {
  if (deviceSupport() !== 'supported') return 'error';
  const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  if (permission !== 'granted') return 'denied';
  if (!canUsePush()) return 'local';
  try {
    const reg = await readyRegistration();
    if (!reg) return 'local';
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) }));
    const json = sub.toJSON();
    const { error } = await supabase!.from('push_subscriptions').upsert(
      {
        endpoint: sub.endpoint,
        p256dh: json.keys?.p256dh ?? '',
        auth: json.keys?.auth ?? '',
        user_agent: navigator.userAgent.slice(0, 300),
        user_id: useAuth.getState().userId,
      },
      { onConflict: 'endpoint' },
    );
    if (error) return 'error';
    localStorage.setItem(ENDPOINT_KEY, sub.endpoint);
    return 'push';
  } catch {
    return 'error';
  }
}

export async function disableDeviceNotifications() {
  try {
    const reg = await readyRegistration(1500);
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      if (supabase) await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
      await sub.unsubscribe();
    }
  } catch {
    /* best effort */
  }
  try {
    localStorage.removeItem(ENDPOINT_KEY);
  } catch {
    /* ignore */
  }
}

/** Show a system notification from the page (used when push isn't available, and for tests). */
export async function showLocalNotification(title: string, options: NotificationOptions & { url?: string }) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const { url, ...opts } = options;
  const reg = await readyRegistration(1500);
  const full = { icon: '/icon-192.png', badge: '/icon-192.png', ...opts, data: { url: url ?? '/' } };
  if (reg) return reg.showNotification(title, full);
  const n = new Notification(title, full);
  n.onclick = () => {
    window.focus();
    if (url) window.location.assign(url);
  };
}
