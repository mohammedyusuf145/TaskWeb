import { Checkbox as C, Switch as S } from 'radix-ui';
import { Check } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function Checkbox({
  checked,
  onCheckedChange,
  label,
  disabled,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  label?: ReactNode;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex items-center gap-3">
      <C.Root
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(v) => onCheckedChange(v === true)}
        className={cn(
          'inline-flex size-5 shrink-0 items-center justify-center rounded-chip border border-border-strong bg-surface-2',
          'transition-colors duration-[var(--dur-fast)] data-[state=checked]:border-accent data-[state=checked]:bg-accent',
          'disabled:opacity-50',
        )}
      >
        <C.Indicator>
          <Check size={14} strokeWidth={2.5} className="text-accent-ink" />
        </C.Indicator>
      </C.Root>
      {label && (
        <label htmlFor={id} className="text-base text-text select-none">
          {label}
        </label>
      )}
    </div>
  );
}

export function Switch({
  checked,
  onCheckedChange,
  label,
  description,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
}) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4">
      <label htmlFor={id} className="min-w-0">
        <span className="block text-base text-text">{label}</span>
        {description && <span className="mt-0.5 block text-sm text-text-3">{description}</span>}
      </label>
      <S.Root
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        className={cn(
          'relative inline-flex h-6 w-10 shrink-0 items-center rounded-full border border-border-strong bg-surface-3',
          'transition-colors duration-[var(--dur-base)] data-[state=checked]:border-accent data-[state=checked]:bg-accent',
        )}
      >
        <S.Thumb
          className={cn(
            'block size-[18px] rounded-full bg-text shadow-sm transition-transform duration-[var(--dur-base)] ease-standard',
            'translate-x-[2px] data-[state=checked]:translate-x-[18px] data-[state=checked]:bg-accent-ink',
            'rtl:-translate-x-[2px] rtl:data-[state=checked]:-translate-x-[18px]',
          )}
        />
      </S.Root>
    </div>
  );
}
