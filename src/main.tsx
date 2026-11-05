import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/ibm-plex-sans';
import '@fontsource/ibm-plex-sans-arabic/arabic-400.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-500.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-600.css';
import '@fontsource-variable/noto-kufi-arabic';
// Alternative Arabic text faces (Settings) and reading faces (Books): font files load only when used.
import '@fontsource/almarai/arabic-400.css';
import '@fontsource/almarai/arabic-700.css';
import '@fontsource-variable/noto-naskh-arabic';
import '@fontsource-variable/noto-serif';
import './index.css';
import { App } from './app/App';
import { applyDocumentLang, useI18n } from './lib/i18n';
import { initAuth } from './lib/auth';
import { registerSW } from 'virtual:pwa-register';
import { applyPrefs } from './lib/prefs';
import { initInstall } from './lib/install';
import { getT } from './lib/i18n';
import { toast } from './components/ui';

applyDocumentLang(useI18n.getState().lang);
applyPrefs();
void initAuth();
// Service worker: push reminders, notification clicks, app-shell caching (production builds only).
initInstall();
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  registerSW({
    immediate: true,
    onOfflineReady: () => toast(getT()('pwa.offlineReady'), { tone: 'success' }),
    // Look for a new version every hour while the app stays open.
    onRegisteredSW: (_url, reg) => reg && setInterval(() => void reg.update().catch(() => {}), 60 * 60 * 1000),
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
