import { RadioGroup as R } from 'radix-ui';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface SegmentedOption<V extends string> {
  value: V;
  label: ReactNode;
  icon?: ReactNode;
}

/** A row of mutually exclusive options. Arrow keys move between them. */
export function Segmented<V extends string>({
  value,
  onValueChange,
  options,
  label,
  className,
}: {
  value: V;
  onValueChange: (v: V) => void;
  options: SegmentedOption<V>[];
  label: string;
  className?: string;
}) {
  return (
    <R.Root
      aria-label={label}
      value={value}
      onValueChange={(v) => onValueChange(v as V)}
      orientation="horizontal"
      className={cn('inline-flex rounded-control border border-border bg-surface-1 p-0.5', className)}
    >
      {options.map((o) => (
        <R.Item
          key={o.value}
          value={o.value}
          className={cn(
            'inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-[5px] px-3 text-base whitespace-nowrap text-text-2',
            'transition-colors duration-[var(--dur-fast)] hover:text-text',
            'data-[state=checked]:bg-surface-3 data-[state=checked]:text-text data-[state=checked]:raised',
          )}
        >
          {o.icon}
          <span>{o.label}</span>
        </R.Item>
      ))}
    </R.Root>
  );
}
