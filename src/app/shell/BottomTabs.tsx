import { useState } from 'react';
import { NavLink, useLocation, useMatch } from 'react-router';
import * as m from 'motion/react-m';
import { Ellipsis } from 'lucide-react';
import { DOCK_ITEMS, MORE_ITEMS, SETTINGS_ITEM, type NavItem } from '../nav';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/cn';
import { Sheet } from '@/components/ui';
import { FocusIndicator } from '@/features/timer/FocusIndicator';

/**
 * Phone navigation: a floating dock with the four daily destinations and "More",
 * which opens the rest (Tutor, Books, Stats, Settings) in a bottom sheet.
 */
export function BottomTabs() {
  const t = useT();
  const [more, setMore] = useState(false);
  const path = useLocation().pathname;
  const inMore = [...MORE_ITEMS, SETTINGS_ITEM].some((i) => path.startsWith(i.to));
  return (
    <>
      <nav aria-label={t('nav.main')} className="fixed inset-x-0 bottom-0 z-[var(--z-nav)] px-3 pb-[max(10px,env(safe-area-inset-bottom))] md:hidden">
        <ul className="mx-auto flex h-16 max-w-[460px] items-stretch gap-1 rounded-[16px] border border-border-strong bg-surface-2 p-1.5 shadow-sheet">
          {DOCK_ITEMS.map((item) => (
            <Tab key={item.to} item={item} label={t(item.labelKey)} />
          ))}
          <li className="relative flex-1">
            <button
              type="button"
              onClick={() => setMore(true)}
              aria-haspopup="dialog"
              aria-expanded={more}
              className={cn('press relative flex h-full w-full flex-col items-center justify-center gap-0.5 rounded-[12px] text-xs font-medium', inMore ? 'text-text' : 'text-text-3')}
            >
              {inMore && <m.span layoutId="dock-pill" aria-hidden className="absolute inset-0 rounded-[12px] bg-surface-3 raised" />}
              <Ellipsis size={20} className={cn('relative', inMore && 'text-accent-text')} />
              <span className="relative">{t('nav.more')}</span>
            </button>
          </li>
        </ul>
      </nav>
      <Sheet open={more} onOpenChange={setMore} title={t('nav.more')} side="bottom">
        <ul className="grid grid-cols-2 gap-2 pb-2">
          {[...MORE_ITEMS, SETTINGS_ITEM].map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  onClick={() => setMore(false)}
                  className={({ isActive }) =>
                    cn('press flex h-16 items-center gap-3 rounded-[12px] border px-4 text-base', isActive ? 'border-accent bg-accent-soft text-text' : 'border-border bg-surface-1 text-text-2')
                  }
                >
                  <Icon size={20} />
                  {t(item.labelKey)}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </Sheet>
    </>
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
          'press relative flex h-full flex-col items-center justify-center gap-0.5 rounded-[12px] text-xs font-medium transition-colors duration-[var(--dur-fast)]',
          active ? 'text-text' : 'text-text-3 active:text-text-2',
        )}
      >
        {active && <m.span layoutId="dock-pill" aria-hidden className="absolute inset-0 rounded-[12px] bg-surface-3 raised" />}
        <span className="relative">
          {item.to === '/focus' && <FocusIndicator compact />}
          <Icon size={20} strokeWidth={active ? 2.1 : 1.75} className={active ? 'text-accent-text' : undefined} />
        </span>
        <span className="relative">{label}</span>
      </NavLink>
    </li>
  );
}
