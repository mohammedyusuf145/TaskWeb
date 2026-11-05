import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { generateKeyBetween } from 'fractional-indexing';
import type { Subject } from '@/types/database';
import type { MessageKey } from '@/locales/en';
import { SUBJECT_COLORS, subjectColor } from '@/design/tokens';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/cn';
import { softDelete, upsert } from '@/lib/db/repo';
import { Button, Dialog, Field, Input, toast } from '@/components/ui';
import { SUBJECT_ICONS, SubjectIcon } from './icons';

/** Create or edit a subject: name, colour and icon. */
export function SubjectEditor({
  open,
  onOpenChange,
  subject,
  lastPosition,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  subject: Subject | null;
  lastPosition: string | null;
}) {
  const t = useT();
  const [name, setName] = useState('');
  const [color, setColor] = useState<string>(SUBJECT_COLORS[0].hex);
  const [icon, setIcon] = useState('book-open');

  useEffect(() => {
    if (!open) return;
    setName(subject?.name ?? '');
    setColor(subject?.color ?? SUBJECT_COLORS[0].hex);
    setIcon(subject?.icon ?? 'book-open');
  }, [open, subject]);

  async function save() {
    if (!name.trim()) return;
    await upsert('subjects', {
      ...(subject ? { id: subject.id } : { position: generateKeyBetween(lastPosition, null), archived_at: null }),
      name: name.trim(),
      color,
      icon,
    });
    toast(t('settings.saved'), { tone: 'success' });
    onOpenChange(false);
  }

  async function remove() {
    if (!subject) return;
    await softDelete('subjects', [subject.id]);
    onOpenChange(false);
    toast(subject.name, {
      action: { label: t('c.undo'), onClick: () => void upsert('subjects', { id: subject.id, deleted_at: null }) },
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={subject ? subject.name : t('settings.subjects.add')}
      footer={
        <>
          {subject && (
            <Button variant="danger" onClick={remove} className="me-auto">
              {t('c.delete')}
            </Button>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('c.cancel')}
          </Button>
          <Button variant="primary" onClick={save} disabled={!name.trim()}>
            {t('c.save')}
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <Field label={t('subject.name')}>
          {({ id }) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoFocus />}
        </Field>

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-text-2">{t('subject.color')}</legend>
          <div className="flex flex-wrap gap-2">
            {SUBJECT_COLORS.map((c) => (
              <button
                key={c.id}
                type="button"
                aria-label={t(`color.${c.id}`)}
                aria-pressed={color === c.hex}
                onClick={() => setColor(c.hex)}
                className={cn(
                  'inline-flex size-8 items-center justify-center rounded-full ring-offset-2 ring-offset-[var(--surface-2)] transition-shadow',
                  color === c.hex && 'ring-2 ring-[var(--text)]',
                )}
                style={{ background: subjectColor(c.hex) }}
              >
                {color === c.hex && <Check size={14} strokeWidth={3} className="text-[#0B0C0F]" />}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-text-2">{t('subject.icon')}</legend>
          <div className="grid grid-cols-9 gap-1">
            {Object.keys(SUBJECT_ICONS).map((key) => (
              <button
                key={key}
                type="button"
                aria-label={t(`icon.${key}` as MessageKey)}
                aria-pressed={icon === key}
                onClick={() => setIcon(key)}
                className={cn(
                  'inline-flex aspect-square items-center justify-center rounded-control border transition-colors',
                  icon === key ? 'border-transparent' : 'border-transparent text-text-3 hover:bg-surface-3 hover:text-text',
                )}
                style={icon === key ? { background: `color-mix(in oklab, ${subjectColor(color)} 18%, transparent)`, color: subjectColor(color) } : undefined}
              >
                <SubjectIcon name={key} size={16} />
              </button>
            ))}
          </div>
        </fieldset>
      </form>
    </Dialog>
  );
}
