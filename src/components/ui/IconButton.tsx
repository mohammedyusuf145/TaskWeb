import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Tooltip } from './Tooltip';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Accessible name, also shown as tooltip. */
  label: string;
  icon: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  tooltip?: boolean;
  active?: boolean;
}

const sizes = { sm: 'size-8', md: 'size-10', lg: 'size-12' };

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, icon, size = 'md', tooltip = true, active, className, type = 'button', ...rest },
  ref,
) {
  const button = (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-control text-text-2',
        'transition-[background-color,color,transform] duration-[var(--dur-fast)] ease-standard hover:bg-surface-3 hover:text-text active:scale-[0.94]',
        'disabled:pointer-events-none disabled:opacity-50',
        active && 'bg-surface-3 text-text',
        sizes[size],
        className,
      )}
      {...rest}
    >
      {icon}
    </button>
  );
  return tooltip ? <Tooltip content={label}>{button}</Tooltip> : button;
});
