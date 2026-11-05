import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';

const control =
  'w-full rounded-control border border-border-strong bg-surface-2 text-text placeholder:text-text-3 ' +
  'transition-[border-color,box-shadow] duration-[var(--dur-fast)] ease-standard ' +
  'hover:border-[color-mix(in_oklab,var(--border-strong),var(--text)_12%)] ' +
  'focus-visible:outline-none focus-visible:border-accent focus-visible:shadow-[0_0_0_3px_var(--accent-soft)] ' +
  'aria-[invalid=true]:border-danger disabled:opacity-50';

export interface FieldProps {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  children: (ids: { id: string; describedBy?: string; invalid: boolean }) => ReactNode;
  className?: string;
}

/** Label + control + hint/error, wired for screen readers. */
export function Field({ label, hint, error, children, className }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-err` : undefined;
  const describedBy = [errId, hintId].filter(Boolean).join(' ') || undefined;
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-text-2">
          {label}
        </label>
      )}
      {children({ id, describedBy, invalid: Boolean(error) })}
      {error ? (
        <p id={errId} className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-sm text-text-3">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { size?: never }>(
  function Input({ className, ...rest }, ref) {
    return <input ref={ref} className={cn(control, 'h-10 px-3 text-base', className)} {...rest} />;
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, rows = 3, ...rest },
  ref,
) {
  return <textarea ref={ref} rows={rows} className={cn(control, 'px-3 py-2 text-base leading-relaxed resize-y', className)} {...rest} />;
});

/** Native select: best keyboard, screen reader and mobile behaviour. */
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...rest },
  ref,
) {
  return (
    <div className="relative">
      <select ref={ref} className={cn(control, 'h-10 appearance-none ps-3 pe-9 text-base', className)} {...rest}>
        {children}
      </select>
      <ChevronDown aria-hidden size={16} className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-text-3" />
    </div>
  );
});
