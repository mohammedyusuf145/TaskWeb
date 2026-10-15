import type { TimerConfig } from './engine';
import { DEFAULT_CONFIG } from './engine';
import { useSettings, updateSettings } from '@/features/settings/settings';
import { getDb, getUserId } from '@/lib/db';
import { DEFAULT_SETTINGS } from '@/lib/db/hooks';

export type TimerView = 'garden' | 'clock' | 'ring' | 'ambient';

/** Synced timer preferences (stored in settings.timer_defaults). Sound is per device (see audio.ts). */
export interface TimerPrefs {
  config: TimerConfig;
  perSubject: Record<string, TimerConfig>;
  dailyGoalMin: number;
  view: TimerView;
  chime: boolean;
}

export const DEFAULT_PREFS: TimerPrefs = { config: DEFAULT_CONFIG, perSubject: {}, dailyGoalMin: 120, view: 'garden', chime: true };

export function readPrefs(raw: Record<string, unknown> | undefined): TimerPrefs {
  const r = (raw ?? {}) as Partial<TimerPrefs>;
  return {
    ...DEFAULT_PREFS,
    ...r,
    config: { ...DEFAULT_CONFIG, ...(r.config ?? {}) },
    perSubject: r.perSubject ?? {},
  };
}

export function useTimerPrefs(): TimerPrefs {
  return readPrefs(useSettings().timer_defaults);
}

export async function updateTimerPrefs(patch: Partial<TimerPrefs>) {
  const row = await getDb().settings.get(getUserId());
  const current = readPrefs(row?.timer_defaults ?? DEFAULT_SETTINGS.timer_defaults);
  await updateSettings({ timer_defaults: { ...current, ...patch } as unknown as Record<string, unknown> });
}

/** Config for a subject: its saved one, else the general one. */
export function configFor(prefs: TimerPrefs, subjectId: string | null): TimerConfig {
  return (subjectId && prefs.perSubject[subjectId]) || prefs.config;
}
