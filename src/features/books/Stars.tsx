import { Star } from 'lucide-react';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/cn';

/** Read-only rating. */
export function Stars({ value, size = 13, className }: { value: number | null; size?: number; className?: string }) {
  const t = useT();
  if (!value) return null;
  return (
    <span role="img" aria-label={t('books.rating.n', { n: value })} className={cn('inline-flex items-center gap-0.5', className)} dir="ltr">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={size} className={n <= value ? 'fill-accent text-accent' : 'text-border-strong'} strokeWidth={1.75} />
      ))}
    </span>
  );
}

/** Rating input: a radio group of five stars; arrow keys move, clicking the current star clears it. */
export function StarInput({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  const t = useT();
  return (
    <div role="radiogroup" aria-label={t('books.rating')} className="inline-flex items-center gap-1" dir="ltr">
      {[1, 2, 3, 4, 5].map((n) => {
        const on = (value ?? 0) >= n;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={t('books.rating.n', { n })}
            tabIndex={value === n || (!value && n === 1) ? 0 : -1}
            onClick={() => onChange(value === n ? null : n)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight' || e.key === 'ArrowUp') onChange(Math.min(5, (value ?? 0) + 1));
              if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') onChange(Math.max(1, (value ?? 2) - 1));
            }}
            className="press inline-flex size-9 items-center justify-center rounded-[6px] hover:bg-surface-3"
          >
            <Star size={20} strokeWidth={1.6} className={cn('transition-colors', on ? 'fill-accent text-accent' : 'text-text-3')} />
          </button>
        );
      })}
    </div>
  );
}
