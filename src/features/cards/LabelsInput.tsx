import { useId, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { useAllCards } from '@/lib/db/hooks';
import { useT } from '@/lib/i18n';

/** Chips + free text. Enter or comma adds; Backspace on an empty field removes the last label. */
export function LabelsInput({ value, onChange }: { value: string[]; onChange: (labels: string[]) => void }) {
  const t = useT();
  const listId = useId();
  const [draft, setDraft] = useState('');
  const all = useAllCards();
  const suggestions = useMemo(() => [...new Set((all ?? []).flatMap((c) => c.labels))].filter((l) => !value.includes(l)).sort(), [all, value]);

  const add = (raw: string) => {
    const label = raw.replace(/^#/, '').trim().slice(0, 40);
    if (label && !value.includes(label) && value.length < 20) onChange([...value, label]);
    setDraft('');
  };

  return (
    <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-control border border-transparent px-1 py-1 focus-within:border-border-strong focus-within:bg-surface-1">
      {value.map((l) => (
        <span key={l} className="inline-flex h-6 items-center gap-1 rounded-chip bg-surface-3 ps-2 pe-1 text-xs text-text-2" dir="auto">
          {l}
          <button
            type="button"
            onClick={() => onChange(value.filter((x) => x !== l))}
            aria-label={t('card.removeLabel', { name: l })}
            className="inline-flex size-4 items-center justify-center rounded-chip text-text-3 hover:text-text"
          >
            <X size={11} />
          </button>
        </span>
      ))}
      <input
        value={draft}
        list={listId}
        onChange={(e) => {
          const v = e.target.value;
          if (v.endsWith(',') || v.endsWith('،')) add(v.slice(0, -1));
          else setDraft(v);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            add(draft);
          }
          if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1));
        }}
        onBlur={() => draft.trim() && add(draft)}
        placeholder={value.length ? '' : t('card.addLabel')}
        aria-label={t('card.addLabel')}
        dir="auto"
        className="h-7 min-w-24 flex-1 bg-transparent px-1 text-base text-text placeholder:text-text-3 focus:outline-none"
      />
      <datalist id={listId}>
        {suggestions.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </div>
  );
}
