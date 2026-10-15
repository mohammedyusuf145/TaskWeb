import { DropdownMenu as M, Popover as P } from 'radix-ui';
import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';

const panel = 'anim-pop z-[var(--z-sheet)] min-w-[200px] rounded-pop border border-border bg-surface-3 p-1 shadow-pop';

export const Menu = M.Root;
export const MenuTrigger = M.Trigger;

export function MenuContent({ children, align = 'end' }: { children: ReactNode; align?: 'start' | 'end' | 'center' }) {
  return (
    <M.Portal>
      <M.Content align={align} sideOffset={6} className={panel}>
        {children}
      </M.Content>
    </M.Portal>
  );
}

export function MenuItem({
  children,
  icon,
  onSelect,
  danger,
  shortcut,
  disabled,
}: {
  children: ReactNode;
  icon?: ReactNode;
  onSelect?: () => void;
  danger?: boolean;
  shortcut?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <M.Item
      onSelect={onSelect}
      disabled={disabled}
      className={cn(
        'flex h-9 cursor-default items-center gap-2.5 rounded-[6px] px-2.5 text-base outline-none select-none data-[disabled]:opacity-40',
        'data-[highlighted]:bg-[color-mix(in_oklab,var(--surface-3),var(--text)_6%)]',
        danger ? 'text-danger' : 'text-text',
      )}
    >
      {icon && <span className="text-text-3">{icon}</span>}
      <span className="flex-1">{children}</span>
      {shortcut && <span className="text-xs text-text-3">{shortcut}</span>}
    </M.Item>
  );
}

export function MenuCheckboxItem({ children, checked, onCheckedChange }: { children: ReactNode; checked: boolean; onCheckedChange: (v: boolean) => void }) {
  return (
    <M.CheckboxItem
      checked={checked}
      onCheckedChange={onCheckedChange}
      onSelect={(e) => e.preventDefault()}
      className={cn(
        'group flex h-9 cursor-default items-center gap-2.5 rounded-[6px] px-2.5 text-base text-text outline-none select-none',
        'data-[highlighted]:bg-[color-mix(in_oklab,var(--surface-3),var(--text)_6%)]',
      )}
    >
      <span className="inline-flex size-4 items-center justify-center rounded-chip border border-border-strong group-data-[state=checked]:border-accent group-data-[state=checked]:bg-accent">
        <M.ItemIndicator>
          <Check size={12} strokeWidth={3} className="text-accent-ink" />
        </M.ItemIndicator>
      </span>
      <span className="flex-1">{children}</span>
    </M.CheckboxItem>
  );
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <M.Label className="px-2.5 pt-2 pb-1 text-xs font-medium text-text-3">{children}</M.Label>;
}

/** Arbitrary content inside a menu (e.g. colour swatches). */
export const MenuGroup = M.Group;

export function MenuSeparator() {
  return <M.Separator className="my-1 h-px bg-border" />;
}

export const Popover = P.Root;
export const PopoverTrigger = P.Trigger;

export function PopoverContent({ children, className, align = 'start' }: { children: ReactNode; className?: string; align?: 'start' | 'end' | 'center' }) {
  return (
    <P.Portal>
      <P.Content align={align} sideOffset={6} className={cn(panel, 'p-3', className)}>
        {children}
      </P.Content>
    </P.Portal>
  );
}
