import { NavLink, useMatch } from 'react-router';
import { motion } from 'motion/react';
import { NAV_ITEMS, type NavItem } from '../nav';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/cn';
import { FocusIndicator } from '@/features/timer/FocusIndicator';

/** Phone navigation: a floating dock above the home indicator; the active pill glides between tabs. */
export function BottomTabs() {
  const t = useT();
  return (
    <nav
      aria-label={t('nav.main')}
      className="fixed inset-x-0 bottom-0 z-[var(--z-nav)] px-3 pb-[max(10px,env(safe-area-inset-bottom))] md:hidden"
    >
      <ul className="mx-auto flex h-16 max-w-[460px] items-stretch gap-1 rounded-[22px] border border-border-strong bg-surface-2 p-1.5 shadow-sheet">
        {NAV_ITEMS.map((item) => (
          <Tab key={item.to} item={item} label={t(item.labelKey)} />
        ))}
      </ul>
    </nav>
  );
}

function Tab({ item, label }: { item: NavItem; label: string }) {
  const active = useMatch({ path: item.to, end: false }) !== null;
  const Icon = item.icon;
  return (
    <li className="relative flex-1">
      <NavLink
        to={item.to}
        className={cn(
          'press relative flex h-full flex-col items-center justify-center gap-0.5 rounded-[16px] text-[11px] font-medium transition-colors duration-[var(--dur-fast)]',
          active ? 'text-text' : 'text-text-3 active:text-text-2',
        )}
      >
        {active && <motion.span layoutId="dock-pill" aria-hidden className="absolute inset-0 rounded-[16px] bg-surface-3 raised" />}
        <span className="relative">
          {item.to === '/focus' && <FocusIndicator compact />}
          <Icon size={20} strokeWidth={active ? 2.1 : 1.75} className={active ? 'text-accent-text' : undefined} />
        </span>
        <span className="relative">{label}</span>
      </NavLink>
    </li>
  );
}
