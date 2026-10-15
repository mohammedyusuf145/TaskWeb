import { Tabs as T } from 'radix-ui';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export const Tabs = T.Root;
export const TabsContent = T.Content;

export function TabsList({ children, className, label }: { children: ReactNode; className?: string; label: string }) {
  return (
    <T.List aria-label={label} className={cn('flex gap-1 border-b border-border', className)}>
      {children}
    </T.List>
  );
}

export function TabsTrigger({ value, children }: { value: string; children: ReactNode }) {
  return (
    <T.Trigger
      value={value}
      className={cn(
        'relative -mb-px inline-flex h-10 items-center gap-2 px-3 text-base text-text-3 transition-colors duration-[var(--dur-fast)]',
        'hover:text-text-2 data-[state=active]:text-text',
        'after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-accent after:opacity-0 after:transition-opacity',
        'data-[state=active]:after:opacity-100',
      )}
    >
      {children}
    </T.Trigger>
  );
}
