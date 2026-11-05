/** "Install Mizan": keeps the browser's install prompt so Settings can offer it at the right moment. */
import { create } from 'zustand';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface InstallState {
  prompt: BeforeInstallPromptEvent | null;
  installed: boolean;
}

const standalone = () =>
  typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true);

export const useInstall = create<InstallState>(() => ({ prompt: null, installed: standalone() }));

export function initInstall() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    useInstall.setState({ prompt: e as BeforeInstallPromptEvent });
  });
  window.addEventListener('appinstalled', () => useInstall.setState({ prompt: null, installed: true }));
}

export async function promptInstall(): Promise<boolean> {
  const p = useInstall.getState().prompt;
  if (!p) return false;
  await p.prompt();
  const { outcome } = await p.userChoice;
  useInstall.setState({ prompt: null, installed: outcome === 'accepted' });
  return outcome === 'accepted';
}

/** iPhone/iPad Safari has no install prompt: the user adds it from the Share menu. */
export const isIosSafari = () => typeof navigator !== 'undefined' && /iP(hone|ad|od)/.test(navigator.userAgent) && !/CriOS|FxiOS/.test(navigator.userAgent);
