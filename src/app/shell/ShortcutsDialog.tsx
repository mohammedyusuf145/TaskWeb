import { create } from 'zustand';
import { useT } from '@/lib/i18n';
import { Dialog, Kbd } from '@/components/ui';

export const useShortcutsDialog = create<{ open: boolean; setOpen: (v: boolean) => void }>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

export function ShortcutsDialog() {
  const t = useT();
  const { open, setOpen } = useShortcutsDialog();
  const rows: [string[], string][] = [
    [['N'], t('sc.new')],
    [['/'], t('sc.search')],
    [[isMac ? '⌘' : 'Ctrl', 'K'], t('sc.palette')],
    [['?'], t('sc.help')],
    [['Enter'], t('sc.open')],
    [['Space', '← ↑ → ↓', 'Space'], t('sc.dnd')],
    [['Esc'], t('sc.close')],
    [['T', 'D', 'W', 'M', 'A'], t('sc.calViews')],
    [['←', '→'], t('sc.calNav')],
  ];
  return (
    <Dialog open={open} onOpenChange={setOpen} title={t('sc.title')}>
      <dl className="flex flex-col divide-y divide-border">
        {rows.map(([keys, label]) => (
          <div key={label} className="flex items-center justify-between gap-4 py-2.5">
            <dt className="text-base text-text-2">{label}</dt>
            <dd className="flex shrink-0 items-center gap-1" dir="ltr">
              {keys.map((k, i) => (
                <Kbd key={i}>{k}</Kbd>
              ))}
            </dd>
          </div>
        ))}
      </dl>
    </Dialog>
  );
}
