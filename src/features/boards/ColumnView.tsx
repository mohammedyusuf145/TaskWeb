import { useState, type ReactNode } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowLeft, ArrowRight, Check, GripVertical, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import type { Card, Column, Subject } from '@/types/database';
import type { CardMeta } from '@/lib/db/hooks';
import { SUBJECT_COLORS, subjectColor } from '@/design/tokens';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/cn';
import { Menu, MenuCheckboxItem, MenuContent, MenuGroup, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from '@/components/ui';
import { SortableCard } from './SortableCard';
import { InlineAddCard } from './InlineAddCard';
import { updateColumn } from './ops';

export interface Group {
  id: string;
  title: string;
  color: string | null;
  /** Present when grouping by column. */
  column?: Column;
  icon?: ReactNode;
  droppable: boolean;
  doneGroup: boolean;
  cards: Card[];
}

interface Props {
  group: Group;
  ids: string[];
  cardById: Map<string, Card>;
  subjectById: Map<string, Subject>;
  meta: Map<string, CardMeta>;
  boardId: string;
  sortableColumns: boolean;
  index: number;
  count: number;
  onOpenCard: (id: string) => void;
  onMoveColumn?: (id: string, toIndex: number) => void;
  onDeleteColumn?: (column: Column) => void;
}

export function ColumnView(props: Props) {
  const { group, sortableColumns } = props;
  const sortable = useSortable({
    id: `column:${group.id}`,
    data: { type: 'column', columnId: group.id },
    disabled: !sortableColumns,
  });
  const style = sortableColumns ? { transform: CSS.Translate.toString(sortable.transform), transition: sortable.transition } : undefined;

  return (
    <section
      ref={sortable.setNodeRef}
      style={style}
      aria-labelledby={`grp-${group.id}`}
      className={cn(
        'flex max-h-full w-[85vw] max-w-[340px] shrink-0 snap-start flex-col rounded-[18px] border border-border bg-surface-1 p-2 md:w-[300px] xl:w-[320px]',
        sortable.isDragging && 'opacity-40',
      )}
    >
      <ColumnHeader {...props} handle={sortableColumns ? { ...sortable.attributes, ...sortable.listeners } : undefined} />
      <ColumnBody {...props} />
    </section>
  );
}

function ColumnHeader({
  group,
  ids,
  index,
  count,
  onMoveColumn,
  onDeleteColumn,
  handle,
}: Props & { handle?: Record<string, unknown> }) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(group.title);
  const column = group.column;

  const save = async () => {
    setEditing(false);
    const v = name.trim();
    if (column && v && v !== column.name) await updateColumn(column.id, { name: v.slice(0, 60) });
    else setName(group.title);
  };

  return (
    <header className="group/head mb-1 flex h-10 items-center gap-1.5 ps-2">
      {handle && (
        <button
          type="button"
          {...handle}
          aria-label={t('col.dragHandle', { name: group.title })}
          className="-ms-1 inline-flex h-7 w-5 cursor-grab touch-none items-center justify-center rounded-chip text-text-3 opacity-0 transition-opacity group-hover/head:opacity-100 focus-visible:opacity-100 active:cursor-grabbing max-md:hidden"
        >
          <GripVertical size={14} />
        </button>
      )}
      {group.icon}
      {group.color && <span className="size-2 shrink-0 rounded-full" style={{ background: subjectColor(group.color) }} aria-hidden />}
      {editing ? (
        <input
          autoFocus
          value={name}
          aria-label={t('col.name')}
          maxLength={60}
          onChange={(e) => setName(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void save();
            if (e.key === 'Escape') {
              setName(group.title);
              setEditing(false);
            }
          }}
          className="h-7 min-w-0 flex-1 rounded-chip border border-accent bg-surface-2 px-1.5 text-sm font-medium text-text focus:outline-none"
        />
      ) : (
        <h2
          id={`grp-${group.id}`}
          className="min-w-0 truncate text-base font-semibold text-text"
          onDoubleClick={() => column && setEditing(true)}
        >
          {group.title}
        </h2>
      )}
      {!editing && <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-surface-3 px-1.5 text-[11px] font-medium text-text-2 tabular">{ids.length}</span>}
      <span className="flex-1" />
      {column && !editing && (
        <Menu>
          <MenuTrigger asChild>
            <button
              type="button"
              aria-label={`${t('col.menu')}: ${group.title}`}
              className="inline-flex size-7 items-center justify-center rounded-control text-text-3 hover:bg-surface-3 hover:text-text data-[state=open]:bg-surface-3"
            >
              <MoreHorizontal size={16} />
            </button>
          </MenuTrigger>
          <MenuContent>
            <MenuItem icon={<Pencil size={15} />} onSelect={() => setEditing(true)}>
              {t('col.rename')}
            </MenuItem>
            <MenuLabel>{t('col.color')}</MenuLabel>
            <MenuGroup className="flex flex-wrap gap-1.5 px-2.5 pb-2">
              <ColorSwatch label={t('col.noColor')} selected={!column.color} onPick={() => updateColumn(column.id, { color: null })} />
              {SUBJECT_COLORS.map((c) => (
                <ColorSwatch
                  key={c.id}
                  label={t(`color.${c.id}`)}
                  color={c.hex}
                  selected={column.color === c.hex}
                  onPick={() => updateColumn(column.id, { color: c.hex })}
                />
              ))}
            </MenuGroup>
            <MenuSeparator />
            <MenuCheckboxItem checked={column.kind === 'done'} onCheckedChange={(v) => updateColumn(column.id, { kind: v ? 'done' : null })}>
              {t('col.markDone')}
            </MenuCheckboxItem>
            <MenuSeparator />
            <MenuItem icon={<ArrowLeft size={15} className="flip-rtl" />} disabled={index === 0} onSelect={() => onMoveColumn?.(column.id, index - 1)}>
              {t('col.moveBack')}
            </MenuItem>
            <MenuItem
              icon={<ArrowRight size={15} className="flip-rtl" />}
              disabled={index >= count - 1}
              onSelect={() => onMoveColumn?.(column.id, index + 1)}
            >
              {t('col.moveForward')}
            </MenuItem>
            <MenuSeparator />
            <MenuItem icon={<Trash2 size={15} />} danger onSelect={() => onDeleteColumn?.(column)}>
              {t('col.delete')}
            </MenuItem>
          </MenuContent>
        </Menu>
      )}
    </header>
  );
}

function ColorSwatch({ color, label, selected, onPick }: { color?: string; label: string; selected: boolean; onPick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={selected}
      title={label}
      onClick={onPick}
      className={cn(
        'inline-flex size-6 items-center justify-center rounded-full border transition-shadow',
        color ? 'border-transparent' : 'border-border-strong bg-surface-2',
        selected && 'ring-2 ring-[var(--text)] ring-offset-2 ring-offset-[var(--surface-3)]',
      )}
      style={color ? { background: subjectColor(color) } : undefined}
    >
      {selected && <Check size={12} strokeWidth={3} className={color ? 'text-[#0B0C0F]' : 'text-text-2'} />}
    </button>
  );
}

function ColumnBody({ group, ids, cardById, subjectById, meta, boardId, onOpenCard }: Props) {
  const t = useT();
  const { setNodeRef, isOver } = useDroppable({ id: `container:${group.id}`, data: { type: 'container', containerId: group.id }, disabled: !group.droppable });

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 md:-mx-1 md:overflow-y-auto md:px-1 md:pb-2">
      <SortableContext id={group.id} items={ids} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className={cn(
            'flex min-h-[72px] flex-col gap-2 rounded-card p-0.5 transition-colors duration-[var(--dur-fast)]',
            isOver && ids.length === 0 && 'bg-accent-soft',
          )}
        >
          {ids.length === 0 ? (
            <p className="flex h-[68px] items-center rounded-card border border-dashed border-border-strong px-4 text-sm text-text-3">
              {group.droppable ? t('col.dropHere') : t('board.emptyColumn')}
            </p>
          ) : (
            ids.map((id) => {
              const card = cardById.get(id);
              if (!card) return null;
              return (
                <SortableCard
                  key={id}
                  card={card}
                  containerId={group.id}
                  subject={card.subject_id ? subjectById.get(card.subject_id) : undefined}
                  done={Boolean(card.completed_at)}
                  meta={meta.get(id)}
                  disabled={!group.droppable}
                  onOpen={onOpenCard}
                />
              );
            })
          )}
        </div>
      </SortableContext>
      {group.column && <InlineAddCard boardId={boardId} columnId={group.column.id} />}
    </div>
  );
}
