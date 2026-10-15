import { NavLink, useMatch } from 'react-router';
import { PanelLeftClose, PanelLeftOpen, Plus, Search } from 'lucide-react';
import { motion } from 'motion/react';
import { useQuickAdd } from '@/features/quick-add/store';
import { NAV_ITEMS, SETTINGS_ITEM, type NavItem } from '../nav';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/cn';
import { Kbd, Tooltip } from '@/components/ui';
import { LogoMark } from './Logo';
import { SyncIndicator } from './SyncIndicator';
import { usePalette } from './CommandPalette';
import { useShell } from './useShell';
import { FocusIndicator } from '@/features/timer/FocusIndicator';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

export function Sidebar({ forceCollapsed }: { forceCollapsed: boolean }) {
  const t = useT();
  const userCollapsed = useShell((s) => s.collapsed);
  const toggle = useShell((s) => s.toggle);
  const collapsed = forceCollapsed || userCollapsed;
  const openPalette = usePalette((s) => s.setOpen);

  return (
    <aside
      aria-label={t('nav.main')}
      className={cn(
        'sticky top-0 hidden h-dvh shrink-0 flex-col bg-frame md:flex',
        'transition-[width] duration-[var(--dur-slow)] ease-standard',
      )}
      style={{ width: collapsed ? 'var(--sidebar-w-collapsed)' : 'var(--sidebar-w)' }}
    >
      <div className={cn('flex h-16 items-center gap-3', collapsed ? 'justify-center' : 'px-5')}>
        <LogoMark size={30} />
        {!collapsed && <span className="font-display text-[19px] font-semibold text-text">{t('app.name')}</span>}
      </div>

      <div className="flex flex-col gap-2 px-3 pb-3">
        <NewCardButton collapsed={collapsed} label={t('board.newCard')} />
        <SearchButton collapsed={collapsed} onClick={() => openPalette(true)} label={t('nav.search')} />
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3 pt-1">
        {NAV_ITEMS.map((item) => (
          <SideLink key={item.to} item={item} collapsed={collapsed} />
        ))}
      </nav>

      <div className="flex flex-col gap-1 px-3 py-3">
        <SideLink item={SETTINGS_ITEM} collapsed={collapsed} />
        <div className={cn('flex h-10 items-center', collapsed ? 'justify-center' : 'justify-between ps-3')}>
          {!collapsed && <SyncIndicator />}
          {forceCollapsed ? (
            collapsed && <SyncIndicator compact />
          ) : (
            <Tooltip content={collapsed ? t('nav.expand') : t('nav.collapse')} side="right">
              <button
                type="button"
                onClick={toggle}
                aria-label={collapsed ? t('nav.expand') : t('nav.collapse')}
                className="inline-flex size-8 items-center justify-center rounded-control text-text-3 hover:bg-surface-3 hover:text-text"
              >
                {collapsed ? <PanelLeftOpen size={16} className="flip-rtl" /> : <PanelLeftClose size={16} className="flip-rtl" />}
              </button>
            </Tooltip>
          )}
        </div>
      </div>
    </aside>
  );
}

function SearchButton({ collapsed, onClick, label }: { collapsed: boolean; onClick: () => void; label: string }) {
  const button = (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-keyshortcuts={isMac ? 'Meta+K' : 'Control+K'}
      className={cn(
        'press flex h-10 w-full items-center gap-2 rounded-control border border-border bg-surface-1 text-sm text-text-3',
        'transition-colors hover:border-border-strong hover:text-text-2',
        collapsed ? 'justify-center' : 'px-2.5',
      )}
    >
      <Search size={15} />
      {!collapsed && (
        <>
          <span className="flex-1 truncate text-start">{label}</span>
          <span className="flex gap-0.5" dir="ltr">
            <Kbd>{isMac ? '⌘' : 'Ctrl'}</Kbd>
            <Kbd>K</Kbd>
          </span>
        </>
      )}
    </button>
  );
  return collapsed ? (
    <Tooltip content={label} side="right">
      {button}
    </Tooltip>
  ) : (
    button
  );
}

function SideLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const t = useT();
  const label = t(item.labelKey);
  const Icon = item.icon;
  // Plain string className (not NavLink's function form) so the Tooltip's Slot can merge props safely.
  const isActive = useMatch({ path: item.to, end: false }) !== null;
  const link = (
    <NavLink
      to={item.to}
      aria-label={collapsed ? label : undefined}
      className={cn(
        'press relative flex h-11 items-center gap-3 rounded-[12px] text-base transition-colors duration-[var(--dur-fast)]',
        collapsed ? 'justify-center' : 'px-3',
        isActive ? 'text-text' : 'text-text-2 hover:bg-[color-mix(in_oklab,var(--surface-1),transparent_40%)] hover:text-text',
      )}
    >
      {isActive && (
        <motion.span layoutId={`nav-pill-${item.to === '/settings' ? 'b' : 'a'}`} aria-hidden className="absolute inset-0 rounded-[12px] border border-border bg-bg shadow-card" />
      )}
      <span className="relative">
        <Icon size={19} strokeWidth={isActive ? 2.1 : 1.75} className={isActive ? 'text-accent-text' : undefined} />
        {item.to === '/focus' && collapsed && <FocusIndicator compact />}
      </span>
      {!collapsed && <span className={cn('relative truncate', isActive && 'font-medium')}>{label}</span>}
      {item.to === '/focus' && !collapsed && (
        <span className="relative ms-auto">
          <FocusIndicator />
        </span>
      )}
    </NavLink>
  );
  return collapsed ? (
    <Tooltip content={label} side="right">
      {link}
    </Tooltip>
  ) : (
    link
  );
}

function NewCardButton({ collapsed, label }: { collapsed: boolean; label: string }) {
  const button = (
    <button
      type="button"
      onClick={() => useQuickAdd.getState().show()}
      aria-label={label}
      aria-keyshortcuts="n"
      className={cn(
        'press flex h-10 w-full items-center gap-2 rounded-control bg-accent text-base font-medium text-accent-ink',
        'transition-colors hover:bg-accent-hover',
        collapsed ? 'justify-center' : 'px-3',
      )}
    >
      <Plus size={17} strokeWidth={2.2} />
      {!collapsed && (
        <>
          <span className="flex-1 truncate text-start">{label}</span>
          <Kbd className="!border-[color-mix(in_oklab,var(--accent-ink),transparent_75%)] !bg-transparent !text-accent-ink">N</Kbd>
        </>
      )}
    </button>
  );
  return collapsed ? (
    <Tooltip content={label} side="right">
      {button}
    </Tooltip>
  ) : (
    button
  );
}
