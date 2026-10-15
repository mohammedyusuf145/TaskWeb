import { CalendarDays, ChartColumn, GraduationCap, LayoutGrid, Settings, Timer, type LucideIcon } from 'lucide-react';
import type { MessageKey } from '@/locales/en';

export interface NavItem {
  to: string;
  labelKey: MessageKey;
  icon: LucideIcon;
}

/** Primary destinations, in the same order on the sidebar and the phone tab bar. */
export const NAV_ITEMS: NavItem[] = [
  { to: '/board', labelKey: 'nav.board', icon: LayoutGrid },
  { to: '/calendar', labelKey: 'nav.calendar', icon: CalendarDays },
  { to: '/focus', labelKey: 'nav.timer', icon: Timer },
  { to: '/tutor', labelKey: 'nav.tutor', icon: GraduationCap },
  { to: '/stats', labelKey: 'nav.stats', icon: ChartColumn },
];

export const SETTINGS_ITEM: NavItem = { to: '/settings', labelKey: 'nav.settings', icon: Settings };
