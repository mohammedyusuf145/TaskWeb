import { useEffect } from 'react';
import type { Settings } from '@/types/database';
import { DEFAULT_SETTINGS, useSettingsRow } from '@/lib/db/hooks';
import { upsert } from '@/lib/db/repo';
import { getDb, getUserId } from '@/lib/db';
import { useI18n } from '@/lib/i18n';
import { applyTheme } from '@/lib/theme';

export type SettingsValues = typeof DEFAULT_SETTINGS;

/** Current settings merged over defaults. The UI language comes from the i18n store so it never lags. */
export function useSettings(): SettingsValues {
  const row = useSettingsRow();
  const lang = useI18n((s) => s.lang);
  return { ...DEFAULT_SETTINGS, ...stripMeta(row), language: lang };
}

function stripMeta(row: Settings | null | undefined): Partial<SettingsValues> {
  if (!row) return {};
  const { id: _i, user_id: _u, created_at: _c, updated_at: _up, deleted_at: _d, ...values } = row;
  return values;
}

export async function updateSettings(patch: Partial<SettingsValues>) {
  if (patch.language) useI18n.getState().setLang(patch.language);
  if (patch.theme) applyTheme(patch.theme);
  const existing = stripMeta(await getDb().settings.get(getUserId()));
  await upsert('settings', { ...DEFAULT_SETTINGS, ...existing, ...patch, id: getUserId() });
}

/** Keeps <html lang/dir/data-theme> in line with the stored settings (e.g. after sync from another device). */
export function SettingsEffects() {
  const row = useSettingsRow();
  useEffect(() => {
    if (!row) return;
    if (row.language !== useI18n.getState().lang) useI18n.getState().setLang(row.language);
    applyTheme(row.theme);
  }, [row?.language, row?.theme, row]);
  return null;
}
