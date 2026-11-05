import { BookOpen, CalendarDays, Layers, ChartColumn, GraduationCap, LayoutGrid, Settings, Sun, Timer, type LucideIcon } from 'lucide-react';
import type { MessageKey } from '@/locales/en';

export interface NavItem {
  to: string;
  labelKey: MessageKey;
  icon: LucideIcon;
}

/** Primary destinations, grouped as on the sidebar. */
export const NAV_GROUPS: { labelKey: MessageKey; items: NavItem[] }[] = [
  {
    labelKey: 'nav.group.plan',
    items: [
      { to: '/today', labelKey: 'nav.today', icon: Sun },
      { to: '/board', labelKey: 'nav.board', icon: LayoutGrid },
      { to: '/calendar', labelKey: 'nav.calendar', icon: CalendarDays },
    ],
  },
  {
    labelKey: 'nav.group.study',
    items: [
      { to: '/focus', labelKey: 'nav.timer', icon: Timer },
      { to: '/tutor', labelKey: 'nav.tutor', icon: GraduationCap },
      { to: '/cards', labelKey: 'nav.cards', icon: Layers },
      { to: '/books', labelKey: 'nav.books', icon: BookOpen },
    ],
  },
  { labelKey: 'nav.group.insight', items: [{ to: '/stats', labelKey: 'nav.stats', icon: ChartColumn }] },
];

export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

/** The phone dock holds four destinations plus "More". */
export const DOCK_ITEMS: NavItem[] = NAV_ITEMS.filter((i) => ['/today', '/board', '/calendar', '/focus'].includes(i.to));
export const MORE_ITEMS: NavItem[] = NAV_ITEMS.filter((i) => !DOCK_ITEMS.includes(i));

export const SETTINGS_ITEM: NavItem = { to: '/settings', labelKey: 'nav.settings', icon: Settings };
