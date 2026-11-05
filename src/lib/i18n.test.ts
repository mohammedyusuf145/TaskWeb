import { describe, expect, it } from 'vitest';
import { en } from '@/locales/en';
import { ar } from '@/locales/ar';
import { translate } from './i18n';

describe('i18n', () => {
  it('Arabic covers every English key and nothing else', () => {
    expect(Object.keys(ar).sort()).toEqual(Object.keys(en).sort());
  });
  it('no empty strings', () => {
    for (const dict of [en, ar]) for (const v of Object.values(dict)) if (typeof v === 'string') expect(v.trim()).not.toBe('');
  });
  it('interpolates variables', () => {
    expect(translate('en', 'settings.account.signedIn', { email: 'a@b.co' })).toBe('Signed in as a@b.co');
  });
  it('Arabic plural forms', () => {
    expect(translate('ar', 'board.cards', { n: 1 })).toBe('بطاقة واحدة');
    expect(translate('ar', 'board.cards', { n: 2 })).toBe('بطاقتان');
    expect(translate('ar', 'board.cards', { n: 5 })).toBe('5 بطاقات');
    expect(translate('ar', 'board.cards', { n: 11 })).toBe('11 بطاقة');
  });
  it('Arabic strings use Western digits', () => {
    for (const v of Object.values(ar)) if (typeof v === 'string') expect(v).not.toMatch(/[٠-٩]/);
  });
});
