import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { CheckCircle2, CircleDashed, Copy, MoreHorizontal, Timer, Trash2, X } from 'lucide-react';
import { useNavigate } from 'react-router';
import type { Card, Priority } from '@/types/database';
import { useCard, useColumns, useSubjects } from '@/lib/db/hooks';
import { useI18n, useT } from '@/lib/i18n';
import { useAutosave } from '@/lib/useAutosave';
import { formatDateLong, toDateInputValue, fromDateInputValue } from '@/lib/dates';
import { cn } from '@/lib/cn';
import { Markdown } from '@/components/content/Markdown';
import {
  Button,
  EmptyState,
  Input,
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
  Segmented,
  Select,
  Sheet,
  Skeleton,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  toast,
} from '@/components/ui';
import { deleteCards, duplicateCard, moveCardToEnd, restore, setCardDone, updateCard } from '@/features/boards/ops';
import { ChecklistEditor } from './ChecklistEditor';
import { LabelsInput } from './LabelsInput';
import { RepeatField } from './RepeatField';
import { AttachmentsField } from './AttachmentsField';
import { OffsetChips } from '@/features/reminders/OffsetChips';
import { useSettings } from '@/features/settings/settings';

/** Side panel (desktop) / bottom sheet (phone) with every field of a card. Edits save as you go. */
export function CardDetail({ cardId, onClose }: { cardId: string | null; onClose: () => void }) {
  const t = useT();
  const card = useCard(cardId);
  const open = Boolean(cardId);

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => !v && onClose()}
      title={card?.title ?? t('nav.board')}
      width={600}
      headerContent={card ? <TitleField key={card.id} card={card} /> : undefined}
      actions={card ? <CardActions card={card} onClose={onClose} /> : undefined}
    >
      {card === undefined ? (
        <div className="flex flex-col gap-3" aria-busy="true">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
          <Skeleton className="h-32" />
        </div>
      ) : card === null || card.deleted_at ? (
        <EmptyState icon={<CircleDashed size={20} />} title={t('card.notFound')} action={<Button onClick={onClose}>{t('c.close')}</Button>} />
      ) : (
        <CardFields key={card.id} card={card} />
      )}
    </Sheet>
  );
}

function TitleField({ card }: { card: Card }) {
  const t = useT();
  const title = useAutosave(card.title, (v) => (v.trim() ? updateCard(card.id, { title: v.trim().slice(0, 300) }) : undefined));
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = '0px';
    el.style.height = `${el.scrollHeight}px`;
  }, [title.value]);
  return (
    <textarea
      ref={ref}
      rows={1}
      value={title.value}
      onChange={(e) => title.onChange(e.target.value.replace(/\n/g, ' '))}
      onBlur={title.onBlur}
      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), (e.target as HTMLTextAreaElement).blur())}
      aria-label={t('card.titleLabel')}
      dir="auto"
      maxLength={300}
      className="-mx-1.5 block w-full resize-none overflow-hidden rounded-control bg-transparent px-1.5 py-0.5 text-xl font-semibold leading-snug text-text hover:bg-surface-1 focus:bg-surface-1 focus:outline-none"
    />
  );
}

function CardActions({ card, onClose }: { card: Card; onClose: () => void }) {
  const t = useT();
  const navigate = useNavigate();
  const done = Boolean(card.completed_at);
  return (
    <div className="flex shrink-0 items-center gap-1">
      {!done && (
        <Button size="sm" variant="ghost" iconStart={<Timer size={15} />} onClick={() => navigate(`/focus?card=${card.id}`)}>
          <span className="max-sm:sr-only">{t('focus.startFromCard')}</span>
        </Button>
      )}
      <Button
        size="sm"
        variant={done ? 'secondary' : 'ghost'}
        iconStart={done ? <CheckCircle2 size={15} className="text-accent" /> : <CheckCircle2 size={15} />}
        onClick={() => setCardDone(card, !done)}
      >
        <span className="max-sm:sr-only">{done ? t('card.markUndone') : t('card.markDone')}</span>
      </Button>
      <Menu>
        <MenuTrigger asChild>
          <button
            type="button"
            aria-label={t('card.more')}
            className="inline-flex size-10 items-center justify-center rounded-control text-text-3 hover:bg-surface-3 hover:text-text"
          >
            <MoreHorizontal size={18} />
          </button>
        </MenuTrigger>
        <MenuContent>
          <MenuItem
            icon={<Copy size={15} />}
            onSelect={async () => {
              await duplicateCard(card);
              toast(t('card.duplicated'), { tone: 'success' });
            }}
          >
            {t('card.duplicate')}
          </MenuItem>
          <MenuSeparator />
          <MenuItem
            icon={<Trash2 size={15} />}
            danger
            onSelect={async () => {
              onClose();
              await deleteCards([card.id]);
              toast(t('card.deleted'), { action: { label: t('c.undo'), onClick: () => void restore('cards', [card.id]) } });
            }}
          >
            {t('card.delete')}
          </MenuItem>
        </MenuContent>
      </Menu>
    </div>
  );
}

function Row({ label, children, align = 'center' }: { label: string; children: ReactNode; align?: 'center' | 'start' }) {
  return (
    <div className={cn('grid grid-cols-[96px_minmax(0,1fr)] gap-3 py-1.5 sm:grid-cols-[132px_minmax(0,1fr)]', align === 'center' ? 'items-center' : 'items-start')}>
      <span className={cn('text-sm text-text-3', align === 'start' && 'pt-2.5')}>{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="border-t border-border pt-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium text-text-2">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

function CardFields({ card }: { card: Card }) {
  const t = useT();
  const lang = useI18n((s) => s.lang);
  const columns = useColumns(card.board_id);
  const subjects = useSubjects();
  const due = card.due_at ? new Date(card.due_at) : null;
  const notes = useAutosave(card.notes, (v) => updateCard(card.id, { notes: v.slice(0, 20000) }));
  const description = useAutosave(card.description, (v) => updateCard(card.id, { description: v.slice(0, 20000) }));
  const [descTab, setDescTab] = useState(card.description ? 'preview' : 'write');
  const timeValue = useMemo(
    () => (due && card.due_has_time ? `${String(due.getHours()).padStart(2, '0')}:${String(due.getMinutes()).padStart(2, '0')}` : ''),
    [due, card.due_has_time],
  );

  const setDate = (value: string) => {
    const d = fromDateInputValue(value);
    if (!d) return updateCard(card.id, { due_at: null, due_has_time: false, repeat_rule: null });
    if (due && card.due_has_time) d.setHours(due.getHours(), due.getMinutes());
    else d.setHours(23, 59);
    return updateCard(card.id, { due_at: d.toISOString() });
  };
  const setTime = (value: string) => {
    const base = due ?? new Date();
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
    if (!value) {
      d.setHours(23, 59);
      return updateCard(card.id, { due_at: d.toISOString(), due_has_time: false });
    }
    const [h, m] = value.split(':').map(Number);
    d.setHours(h ?? 0, m ?? 0);
    return updateCard(card.id, { due_at: d.toISOString(), due_has_time: true });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col">
        <Row label={t('card.status')}>
          <Select
            value={card.column_id}
            onChange={(e) => moveCardToEnd(card.id, e.target.value)}
          >
            {columns?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Row>
        <Row label={t('card.subject')}>
          <Select value={card.subject_id ?? ''} onChange={(e) => updateCard(card.id, { subject_id: e.target.value || null })}>
            <option value="">{t('subject.none')}</option>
            {subjects?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Row>
        <Row label={t('card.due')}>
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-[148px] flex-1">
              <Input type="date" value={due ? toDateInputValue(due) : ''} onChange={(e) => setDate(e.target.value)} aria-label={t('card.due')} />
            </div>
            <div className="w-[120px] shrink-0">
              <Input type="time" value={timeValue} disabled={!due} onChange={(e) => setTime(e.target.value)} aria-label={t('card.time')} />
            </div>
            {due && (
              <button
                type="button"
                onClick={() => setDate('')}
                aria-label={t('card.clearDue')}
                className="inline-flex size-10 shrink-0 items-center justify-center rounded-control text-text-3 hover:bg-surface-3 hover:text-text"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </Row>
        <Row label={t('card.priority')}>
          <Segmented<Priority>
            label={t('card.priority')}
            value={card.priority}
            onValueChange={(v) => updateCard(card.id, { priority: v })}
            options={[
              { value: 'low', label: t('prio.low') },
              { value: 'med', label: t('prio.med') },
              { value: 'high', label: t('prio.high') },
            ]}
            className="w-full"
          />
        </Row>
        <Row label={t('card.exam')}>
          <Switch checked={card.is_exam} onCheckedChange={(v) => updateCard(card.id, { is_exam: v })} label={<span className="text-sm text-text-2">{t('card.examHint')}</span>} />
        </Row>
        <Row label={t('card.estimate')}>
          <div className="flex items-center gap-2">
            <div className="relative w-28">
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                max={1440}
                value={card.estimate_min ?? ''}
                onChange={(e) => {
                  const n = Math.round(Number(e.target.value));
                  void updateCard(card.id, { estimate_min: n > 0 ? Math.min(1440, n) : null });
                }}
                aria-label={t('card.estimate')}
                className="pe-12 tabular"
              />
              <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-sm text-text-3">{t('card.minutesUnit')}</span>
            </div>
            {[25, 50].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => updateCard(card.id, { estimate_min: n })}
                aria-pressed={card.estimate_min === n}
                className={cn(
                  'h-8 rounded-control border px-2.5 text-sm tabular transition-colors',
                  card.estimate_min === n ? 'border-accent bg-accent-soft text-text' : 'border-border text-text-2 hover:border-border-strong',
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </Row>
        <Row label={t('card.repeat')} align="start">
          <RepeatField rule={card.repeat_rule} due={due} onChange={(r) => updateCard(card.id, { repeat_rule: r })} />
        </Row>
        <Row label={t('rem.card.label')} align="start">
          <CardReminders card={card} />
        </Row>
        <Row label={t('card.labels')} align="start">
          <LabelsInput value={card.labels} onChange={(labels) => updateCard(card.id, { labels })} />
        </Row>
      </div>

      <Section title={t('card.checklist')}>
        <ChecklistEditor cardId={card.id} />
      </Section>

      <Section title={t('card.description')}>
        <Tabs value={descTab} onValueChange={setDescTab}>
          <TabsList label={t('card.description')} className="mb-3">
            <TabsTrigger value="write">{t('card.write')}</TabsTrigger>
            <TabsTrigger value="preview">{t('card.preview')}</TabsTrigger>
          </TabsList>
          <TabsContent value="write">
            <Textarea
              rows={6}
              value={description.value}
              onChange={(e) => description.onChange(e.target.value)}
              onBlur={description.onBlur}
              placeholder={t('card.descPlaceholder')}
              dir="auto"
              aria-label={t('card.description')}
            />
          </TabsContent>
          <TabsContent value="preview">
            {description.value.trim() ? (
              <Markdown>{description.value}</Markdown>
            ) : (
              <button type="button" onClick={() => setDescTab('write')} className="text-base text-text-3 hover:text-text-2">
                {t('card.descEmpty')}
              </button>
            )}
          </TabsContent>
        </Tabs>
      </Section>

      <Section title={t('card.attachments')}>
        <AttachmentsField cardId={card.id} />
      </Section>

      <Section title={t('card.notes')}>
        <Textarea
          rows={3}
          value={notes.value}
          onChange={(e) => notes.onChange(e.target.value)}
          onBlur={notes.onBlur}
          placeholder={t('card.notesPlaceholder')}
          dir="auto"
          aria-label={t('card.notes')}
        />
      </Section>

      <p className="border-t border-border pt-4 text-xs text-text-3">{t('card.created', { date: formatDateLong(new Date(card.created_at), lang) })}</p>
    </div>
  );
}

function CardReminders({ card }: { card: Card }) {
  const t = useT();
  const settings = useSettings();
  const mode = card.reminder_offsets === null ? 'default' : card.reminder_offsets.length === 0 ? 'off' : 'custom';
  if (!card.due_at) return <p className="flex h-10 items-center text-sm text-text-3">{t('repeat.needsDue')}</p>;
  return (
    <div className="flex flex-col gap-2">
      <Segmented<'default' | 'custom' | 'off'>
        label={t('rem.card.label')}
        value={mode}
        onValueChange={(v) =>
          updateCard(card.id, { reminder_offsets: v === 'default' ? null : v === 'off' ? [] : [...settings.notifications.offsets_min] })
        }
        options={[
          { value: 'default', label: t('rem.card.default') },
          { value: 'custom', label: t('rem.card.custom') },
          { value: 'off', label: t('rem.card.off') },
        ]}
        className="w-full"
      />
      {mode === 'default' && (
        <p className="text-xs text-text-3">{settings.notifications.offsets_min.map((o) => t(`rem.offset.${o}` as 'rem.offset.0')).join(' · ') || t('rem.card.off')}</p>
      )}
      {mode === 'custom' && (
        <OffsetChips
          value={card.reminder_offsets ?? []}
          onChange={(v) => updateCard(card.id, { reminder_offsets: v.length ? v : [] })}
          label={t('rem.card.label')}
        />
      )}
      {mode !== 'off' && !card.due_has_time && <p className="text-xs text-text-3">{t('rem.card.dateOnlyHint')}</p>}
    </div>
  );
}
