import { Command } from 'cmdk';
import { Dialog as D } from 'radix-ui';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { create } from 'zustand';
import { Keyboard, Languages, Palette, Plus, SunMoon, Search, SquareKanban } from 'lucide-react';
import { NAV_ITEMS, SETTINGS_ITEM } from '../nav';
import { useI18n, useT } from '@/lib/i18n';
import { updateSettings, useSettings } from '@/features/settings/settings';
import { useQuickAdd } from '@/features/quick-add/store';
import { useAllCards, useBoards } from '@/lib/db/hooks';
import { useShortcutsDialog } from './ShortcutsDialog';
import type { ReactNode } from 'react';

export const usePalette = create<{ open: boolean; setOpen: (open: boolean) => void }>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));

/** Cmd/Ctrl+K: jump anywhere, run any action. Grows with each phase. */
export function CommandPalette() {
  const t = useT();
  const navigate = useNavigate();
  const { open, setOpen } = usePalette();
  const lang = useI18n((s) => s.lang);
  const settings = useSettings();
  const cards = useAllCards();
  const boards = useBoards();
  const activeBoards = new Set((boards ?? []).map((b) => b.id));
  const [query, setQuery] = useState('');
  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(!usePalette.getState().open);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setOpen]);

  const run = (fn: () => void) => {
    setOpen(false);
    fn();
  };

  return (
    <D.Root open={open} onOpenChange={setOpen}>
      <D.Portal>
        <D.Overlay className="anim-overlay fixed inset-0 z-[var(--z-palette)] bg-[var(--surface-overlay)]" />
        <D.Content
          aria-describedby={undefined}
          className="anim-dialog fixed inset-x-0 top-[12dvh] z-[var(--z-palette)] mx-auto w-[calc(100vw-32px)] max-w-[560px] overflow-hidden rounded-pop border border-border bg-surface-2 shadow-sheet focus:outline-none"
        >
          <D.Title className="sr-only">{t('nav.search')}</D.Title>
          <Command loop label={t('nav.search')} className="flex flex-col">
            <div className="flex items-center gap-3 border-b border-border px-4">
              <Search size={16} className="shrink-0 text-text-3" />
              <Command.Input
                autoFocus
                value={query}
                onValueChange={setQuery}
                placeholder={t('palette.placeholder')}
                className="h-12 w-full bg-transparent text-md text-text placeholder:text-text-3 focus:outline-none"
              />
            </div>
            <Command.List className="max-h-[min(60dvh,400px)] overflow-y-auto p-2">
              <Command.Empty className="px-3 py-6 text-base text-text-3">{t('palette.empty')}</Command.Empty>
              <Group heading={t('palette.navigate')}>
                {[...NAV_ITEMS, SETTINGS_ITEM].map(({ to, labelKey, icon: Icon }) => (
                  <Item key={to} value={`${to} ${t(labelKey)}`} icon={<Icon size={16} />} onSelect={() => run(() => navigate(to))}>
                    {t(labelKey)}
                  </Item>
                ))}
              </Group>
              <Group heading={t('palette.actions')}>
                <Item value="new card add بطاقة جديدة" icon={<Plus size={16} />} onSelect={() => run(() => useQuickAdd.getState().show())}>
                  {t('palette.newCard')}
                </Item>
                <Item
                  value="language arabic english لغة"
                  icon={<Languages size={16} />}
                  onSelect={() => run(() => void updateSettings({ language: lang === 'ar' ? 'en' : 'ar' }))}
                >
                  {t('palette.toggleLang')}
                </Item>
                <Item
                  value="theme dark light مظهر"
                  icon={<SunMoon size={16} />}
                  onSelect={() =>
                    run(() => {
                      const current = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
                      void updateSettings({ theme: current === 'light' ? 'dark' : 'light' });
                    })
                  }
                >
                  {t('palette.toggleTheme')}
                  <span className="ms-auto text-xs text-text-3">{t(`settings.theme.${settings.theme}`)}</span>
                </Item>
                <Item value="keyboard shortcuts اختصارات" icon={<Keyboard size={16} />} onSelect={() => run(() => useShortcutsDialog.getState().setOpen(true))}>
                  {t('palette.shortcuts')}
                </Item>
                <Item value="design system tokens" icon={<Palette size={16} />} onSelect={() => run(() => navigate('/design'))}>
                  {t('design.title')}
                </Item>
              </Group>
              {query.trim().length > 0 && cards && cards.length > 0 && (
                <Group heading={t('palette.cards')}>
                  {cards
                    .filter((c) => activeBoards.has(c.board_id))
                    .slice(0, 500)
                    .map((c) => (
                      <Item
                        key={c.id}
                        value={`card ${c.id} ${c.title} ${c.labels.join(' ')}`}
                        icon={<SquareKanban size={16} />}
                        onSelect={() => run(() => navigate(`/board/${c.board_id}?card=${c.id}`))}
                      >
                        <span className="truncate" dir="auto">
                          {c.title}
                        </span>
                      </Item>
                    ))}
                </Group>
              )}
            </Command.List>
          </Command>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

function Group({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <Command.Group
      heading={heading}
      className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-text-3"
    >
      {children}
    </Command.Group>
  );
}

function Item({ value, icon, onSelect, children }: { value: string; icon: ReactNode; onSelect: () => void; children: ReactNode }) {
  return (
    <Command.Item
      value={value}
      onSelect={onSelect}
      className="flex h-10 cursor-default items-center gap-3 rounded-control px-3 text-base text-text-2 data-[selected=true]:bg-surface-3 data-[selected=true]:text-text"
    >
      <span className="text-text-3">{icon}</span>
      {children}
    </Command.Item>
  );
}
