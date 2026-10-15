import type { ThemePref } from '@/types/database';

const KEY = 'mizan.theme';
let mql: MediaQueryList | null = null;
let listener: (() => void) | null = null;

/** Apply the theme to <html data-theme>. Cached so index.html can set it before first paint. */
export function applyTheme(pref: ThemePref) {
  const resolve = () => {
    const h = document.documentElement;
    const before = h.dataset.theme;
    const dark = pref === 'dark' || (pref === 'system' && !window.matchMedia('(prefers-color-scheme: light)').matches);
    const next = dark ? 'dark' : 'light';
    if (before && before !== next && !matchMedia('(prefers-reduced-motion: reduce)').matches && h.dataset.motion !== 'reduce') {
      h.classList.add('theme-fade');
      window.setTimeout(() => h.classList.remove('theme-fade'), 420);
    }
    h.dataset.theme = next;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#08101F' : '#E4E9F2');
  };
  if (mql && listener) mql.removeEventListener('change', listener);
  mql = null;
  listener = null;
  if (pref === 'system') {
    mql = window.matchMedia('(prefers-color-scheme: light)');
    listener = resolve;
    mql.addEventListener('change', listener);
  }
  resolve();
  try {
    localStorage.setItem(KEY, pref);
  } catch {
    /* ignore */
  }
}
