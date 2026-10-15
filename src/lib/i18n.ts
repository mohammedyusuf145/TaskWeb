import { create } from 'zustand';
import { en, type MessageKey } from '@/locales/en';
import { ar } from '@/locales/ar';

export type Lang = 'ar' | 'en';

const dicts = { en, ar } as const;

type Vars<K extends MessageKey> = (typeof en)[K] extends (v: infer V) => string
  ? V
  : Record<string, string | number> | undefined;

type ArgsFor<K extends MessageKey> = (typeof en)[K] extends (v: infer V) => string ? [vars: V] : [vars?: Vars<K>];

export type TFunction = <K extends MessageKey>(key: K, ...args: ArgsFor<K>) => string;

export function translate(lang: Lang, key: MessageKey, vars?: unknown): string {
  const value = (dicts[lang] as Record<string, unknown>)[key] ?? (en as Record<string, unknown>)[key];
  if (typeof value === 'function') return (value as (v: unknown) => string)(vars);
  if (typeof value !== 'string') return key;
  if (!vars) return value;
  return value.replace(/\{(\w+)\}/g, (_, name: string) => String((vars as Record<string, unknown>)[name] ?? ''));
}

const STORAGE_KEY = 'mizan.lang';

function initialLang(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'ar' || stored === 'en') return stored;
  } catch {
    /* storage unavailable */
  }
  return 'ar';
}

interface I18nState {
  lang: Lang;
  setLang: (lang: Lang) => void;
}

export const useI18n = create<I18nState>((set) => ({
  lang: initialLang(),
  setLang: (lang) => {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* ignore */
    }
    applyDocumentLang(lang);
    set({ lang });
  },
}));

export function applyDocumentLang(lang: Lang) {
  const html = document.documentElement;
  html.lang = lang;
  html.dir = lang === 'ar' ? 'rtl' : 'ltr';
}

/** Hook returning a typed translate function bound to the current language. */
export function useT(): TFunction {
  const lang = useI18n((s) => s.lang);
  return ((key: MessageKey, vars?: unknown) => translate(lang, key, vars)) as TFunction;
}

export function getT(): TFunction {
  const lang = useI18n.getState().lang;
  return ((key: MessageKey, vars?: unknown) => translate(lang, key, vars)) as TFunction;
}

/** BCP-47 locale for Intl with Western digits in both languages. */
export function intlLocale(lang: Lang): string {
  return lang === 'ar' ? 'ar-BH-u-nu-latn' : 'en-GB';
}
