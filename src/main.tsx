import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/readex-pro';
import '@fontsource-variable/bricolage-grotesque';
import '@fontsource-variable/reem-kufi';
import './index.css';
import { App } from './app/App';
import { applyDocumentLang, useI18n } from './lib/i18n';
import { initAuth } from './lib/auth';
import { registerSW } from 'virtual:pwa-register';
import { applyPrefs } from './lib/prefs';

applyDocumentLang(useI18n.getState().lang);
applyPrefs();
void initAuth();
// Service worker: push reminders, notification clicks, app-shell caching (production builds only).
if (import.meta.env.PROD && 'serviceWorker' in navigator) registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
