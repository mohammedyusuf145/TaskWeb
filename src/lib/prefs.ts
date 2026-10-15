/**
 * Device preferences: accent, motion, interface sounds and text size.
 * Kept on this device (localStorage) because they describe the device and the moment,
 * not the study data; index.html reads accent and motion before first paint.
 */
import { create } from 'zustand';

export type Accent = 'gold' | 'pearl' | 'coral' | 'iris';
export type MotionPref = 'system' | 'full' | 'reduce';
export type TextSize = 'sm' | 'md' | 'lg';

export interface DevicePrefs {
  accent: Accent;
  motion: MotionPref;
  sounds: boolean;
  soundVolume: number; // 0..1
  haptics: boolean;
  textSize: TextSize;
}

const DEFAULTS: DevicePrefs = { accent: 'gold', motion: 'system', sounds: true, soundVolume: 0.6, haptics: true, textSize: 'md' };
const KEY = 'mizan.prefs';

function read(): DevicePrefs {
  try {
    return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<DevicePrefs>) };
  } catch {
    return DEFAULTS;
  }
}

export const usePrefs = create<DevicePrefs>(() => read());

const TEXT_PX: Record<TextSize, string> = { sm: '13px', md: '14px', lg: '16px' };

export function applyPrefs(p: DevicePrefs = usePrefs.getState()) {
  const h = document.documentElement;
  if (p.accent === 'gold') delete h.dataset.accent;
  else h.dataset.accent = p.accent;
  if (p.motion === 'reduce') h.dataset.motion = 'reduce';
  else delete h.dataset.motion;
  h.style.fontSize = TEXT_PX[p.textSize];
  try {
    localStorage.setItem('mizan.accent', p.accent);
    localStorage.setItem('mizan.motion', p.motion);
  } catch {
    /* ignore */
  }
}

export function setPrefs(patch: Partial<DevicePrefs>) {
  usePrefs.setState(patch);
  const next = usePrefs.getState();
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  applyPrefs(next);
}

/** True when animation should be minimal: the in-app setting wins over the OS one. */
export function prefersReducedMotion(): boolean {
  const m = usePrefs.getState().motion;
  if (m === 'reduce') return true;
  if (m === 'full') return false;
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function useReducedMotion(): boolean {
  const m = usePrefs((s) => s.motion);
  if (m !== 'system') return m === 'reduce';
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
