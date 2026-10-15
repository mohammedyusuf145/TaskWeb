import { useT } from '@/lib/i18n';
import { cn } from '@/lib/cn';
import { OFFSET_PRESETS } from './compute';

/** Multi-select of reminder offsets. */
export function OffsetChips({ value, onChange, label }: { value: number[]; onChange: (v: number[]) => void; label: string }) {
  const t = useT();
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {OFFSET_PRESETS.map((o) => {
        const on = value.includes(o);
        return (
          <button
            key={o}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== o) : [...value, o].sort((a, b) => a - b))}
            className={cn(
              'inline-flex h-8 items-center rounded-control border px-2.5 text-sm transition-colors',
              on ? 'border-accent bg-accent-soft text-text' : 'border-border text-text-2 hover:border-border-strong hover:text-text',
            )}
          >
            {t(`rem.offset.${o}`)}
          </button>
        );
      })}
    </div>
  );
}
