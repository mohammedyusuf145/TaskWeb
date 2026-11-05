import { useMemo, useRef, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  closestCorners,
  pointerWithin,
  useSensor,
  useSensors,
  defaultDropAnimationSideEffects,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type DropAnimation,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { boardKeyboardCoordinates } from './keyboard';
import { Plus } from 'lucide-react';
import type { Card, Column, Priority, Subject } from '@/types/database';
import { useCardMeta } from '@/lib/db/hooks';
import { useT } from '@/lib/i18n';
import { motion as m, subjectColor } from '@/design/tokens';
import { CardTile } from '@/features/cards/CardTile';
import { SubjectIcon } from '@/features/subjects/icons';
import { Button, Dialog, Input, toast } from '@/components/ui';
import { ColumnView, type Group } from './ColumnView';
import { createColumn, deleteColumn, moveCard, moveColumn, restore, updateCard } from './ops';
import { byPosition } from './position';
import { dueBucket, type DueBucket, type GroupBy } from './view';

type Containers = Record<string, string[]>;

const DUE_ORDER: DueBucket[] = ['overdue', 'today', 'tomorrow', 'week', 'later', 'none', 'done'];
const PRIORITIES: Priority[] = ['high', 'med', 'low'];

const byDueThenPosition = (a: Card, b: Card) => {
  const da = a.due_at ? Date.parse(a.due_at) : Infinity;
  const db = b.due_at ? Date.parse(b.due_at) : Infinity;
  return da - db || byPosition(a, b);
};

/** Prefer card targets under the pointer; fall back to columns; keyboard uses corners. */
const collision: CollisionDetection = (args) => {
  if (args.active.data.current?.type === 'column') {
    return closestCenter({ ...args, droppableContainers: args.droppableContainers.filter((c) => c.data.current?.type === 'column') });
  }
  const notColumns = args.droppableContainers.filter((c) => c.data.current?.type !== 'column');
  const hits = pointerWithin({ ...args, droppableContainers: notColumns });
  const cardHits = hits.filter((h) => notColumns.find((c) => c.id === h.id)?.data.current?.type === 'card');
  if (cardHits.length) return cardHits;
  if (hits.length) return hits;
  return closestCorners({ ...args, droppableContainers: notColumns });
};

const dropAnimation: DropAnimation = {
  duration: 200,
  easing: `cubic-bezier(${m.ease.join(',')})`,
  sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.4' } } }),
};

export function BoardCanvas({
  boardId,
  columns,
  cards,
  subjects,
  groupBy,
  onOpenCard,
}: {
  boardId: string;
  columns: Column[];
  cards: Card[];
  subjects: Subject[];
  groupBy: GroupBy;
  onOpenCard: (id: string) => void;
}) {
  const t = useT();
  const subjectById = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);
  const cardById = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);
  const meta = useCardMeta(useMemo(() => cards.map((c) => c.id), [cards]));

  const groups = useMemo<Group[]>(() => {
    if (groupBy === 'column')
      return columns.map((col) => ({
        id: col.id,
        title: col.name,
        color: col.color,
        column: col,
        droppable: true,
        doneGroup: col.kind === 'done',
        cards: cards.filter((c) => c.column_id === col.id).sort(byPosition),
      }));
    if (groupBy === 'subject')
      return [
        ...subjects.map((s) => ({
          id: s.id,
          title: s.name,
          color: null,
          icon: (
            <span className="inline-flex shrink-0" style={{ color: subjectColor(s.color) }}>
              <SubjectIcon name={s.icon} size={14} />
            </span>
          ),
          droppable: true,
          doneGroup: false,
          cards: cards.filter((c) => c.subject_id === s.id).sort(byDueThenPosition),
        })),
        {
          id: 'none',
          title: t('subject.none'),
          color: null,
          droppable: true,
          doneGroup: false,
          cards: cards.filter((c) => !c.subject_id || !subjectById.has(c.subject_id)).sort(byDueThenPosition),
        },
      ];
    if (groupBy === 'priority')
      return PRIORITIES.map((p) => ({
        id: p,
        title: t(`prio.${p}`),
        color: null,
        droppable: true,
        doneGroup: false,
        cards: cards.filter((c) => c.priority === p).sort(byDueThenPosition),
      }));
    const now = new Date();
    return DUE_ORDER.map((b) => ({
      id: b,
      title: t(`bucket.${b}`),
      color: null,
      droppable: false,
      doneGroup: b === 'done',
      cards: cards.filter((c) => dueBucket(c, now) === b).sort(byDueThenPosition),
    })).filter((g) => g.cards.length > 0);
  }, [groupBy, columns, cards, subjects, subjectById, t]);

  const base = useMemo<Containers>(() => Object.fromEntries(groups.map((g) => [g.id, g.cards.map((c) => c.id)])), [groups]);
  const [dragItems, setDragItems] = useState<Containers | null>(null);
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const items = dragItems ?? base;
  const startContainer = useRef<string | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: boardKeyboardCoordinates,
      keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space'] },
    }),
  );

  const findContainer = (id: UniqueIdentifier, from: Containers): string | undefined => {
    const s = String(id);
    if (s.startsWith('container:')) return s.slice('container:'.length);
    if (s in from) return s;
    return Object.keys(from).find((k) => from[k]!.includes(s));
  };

  const groupTitle = (id: string | undefined) => groups.find((g) => g.id === id)?.title ?? '';
  const titleOf = (id: UniqueIdentifier) => {
    const s = String(id);
    if (s.startsWith('column:')) return groupTitle(s.slice(7));
    return cardById.get(s)?.title ?? '';
  };

  const announcements: Announcements = {
    onDragStart: ({ active }) => t('dnd.pickedUp', { title: titleOf(active.id) }),
    onDragOver: ({ active, over }) =>
      over && over.id !== active.id ? t('dnd.over', { title: titleOf(active.id), target: groupTitle(findContainer(over.id, items)) || titleOf(over.id) }) : undefined,
    onDragEnd: ({ active, over }) =>
      over ? t('dnd.dropped', { title: titleOf(active.id), target: groupTitle(findContainer(over.id, items)) || titleOf(over.id) }) : t('dnd.cancelled'),
    onDragCancel: () => t('dnd.cancelled'),
  };

  function onDragStart(e: DragStartEvent) {
    setActiveId(e.active.id);
    if (e.active.data.current?.type === 'card') {
      setDragItems(structuredClone(base));
      startContainer.current = findContainer(e.active.id, base) ?? null;
    }
  }

  function onDragOver({ active, over }: DragOverEvent) {
    if (!over || active.data.current?.type !== 'card') return;
    setDragItems((prev) => {
      const cur = prev ?? base;
      const from = findContainer(active.id, cur);
      const to = findContainer(over.id, cur);
      if (!from || !to || from === to) return prev;
      if (!groups.find((g) => g.id === to)?.droppable) return prev;
      const fromList = cur[from]!.filter((id) => id !== active.id);
      const toList = [...cur[to]!];
      const overIndex = toList.indexOf(String(over.id));
      const below =
        over.rect && active.rect.current.translated ? active.rect.current.translated.top > over.rect.top + over.rect.height / 2 : false;
      const insertAt = overIndex >= 0 ? overIndex + (below ? 1 : 0) : toList.length;
      toList.splice(insertAt, 0, String(active.id));
      return { ...cur, [from]: fromList, [to]: toList };
    });
  }

  const justDragged = useRef(0);

  async function onDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    justDragged.current = Date.now();
    const type = active.data.current?.type;

    if (type === 'column') {
      setDragItems(null);
      if (!over || active.id === over.id) return;
      const ids = groups.map((g) => `column:${g.id}`);
      const from = ids.indexOf(String(active.id));
      const to = ids.indexOf(String(over.id));
      if (from < 0 || to < 0) return;
      await moveColumn(boardId, String(active.id).slice(7), to);
      return;
    }

    const cur = dragItems ?? base;
    if (!over) return setDragItems(null);
    const container = findContainer(active.id, cur);
    const overContainer = findContainer(over.id, cur);
    if (!container || container !== overContainer) return setDragItems(null);

    let list = cur[container]!;
    const oldIndex = list.indexOf(String(active.id));
    const newIndex = list.indexOf(String(over.id));
    if (newIndex >= 0 && oldIndex !== newIndex) list = arrayMove(list, oldIndex, newIndex);
    const idx = list.indexOf(String(active.id));
    const id = String(active.id);
    const card = cardById.get(id);
    // Keep the dropped order on screen until the live query catches up.
    setDragItems({ ...cur, [container]: list });

    try {
      if (groupBy === 'column') {
        const unchanged = container === startContainer.current && list.join() === base[container]!.join();
        if (!unchanged) await moveCard(id, container, list[idx - 1] ?? null, list[idx + 1] ?? null);
      } else if (groupBy === 'subject' && card) {
        const subject_id = container === 'none' ? null : container;
        if (card.subject_id !== subject_id) await updateCard(id, { subject_id });
      } else if (groupBy === 'priority' && card) {
        if (card.priority !== container) await updateCard(id, { priority: container as Priority });
      }
    } finally {
      setDragItems(null);
    }
  }

  const openCard = (id: string) => {
    if (Date.now() - justDragged.current < 250) return;
    onOpenCard(id);
  };

  const activeCard = activeId && !String(activeId).startsWith('column:') ? cardById.get(String(activeId)) : undefined;
  const activeGroup = activeId && String(activeId).startsWith('column:') ? groups.find((g) => `column:${g.id}` === activeId) : undefined;

  // Column management
  const [newColumn, setNewColumn] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Column | null>(null);

  async function doDeleteColumn(col: Column) {
    setConfirmDelete(null);
    const removed = await deleteColumn(col.id);
    toast(t('col.deleted'), {
      action: {
        label: t('c.undo'),
        onClick: async () => {
          await restore('columns', [removed.column]);
          await restore('cards', removed.cards);
        },
      },
    });
  }

  const columnDeleteCount = confirmDelete ? cards.filter((c) => c.column_id === confirmDelete.id).length : 0;

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={collision}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={() => {
          setActiveId(null);
          setDragItems(null);
        }}
        accessibility={{ announcements, screenReaderInstructions: { draggable: t('dnd.instructions') } }}
      >
        <div className="min-h-0 flex-1 overflow-x-auto overscroll-x-contain">
          <div className="flex h-full snap-x snap-mandatory items-start gap-4 px-4 py-5 max-md:scroll-px-4 md:snap-none md:px-8">
            <SortableContext items={groups.map((g) => `column:${g.id}`)} strategy={horizontalListSortingStrategy} disabled={groupBy !== 'column'}>
              {groups.map((g, i) => (
                <ColumnView
                  key={g.id}
                  group={g}
                  ids={items[g.id] ?? []}
                  cardById={cardById}
                  subjectById={subjectById}
                  meta={meta}
                  boardId={boardId}
                  sortableColumns={groupBy === 'column'}
                  index={i}
                  count={groups.length}
                  onOpenCard={openCard}
                  onMoveColumn={(id, to) => {
                    if (to >= 0 && to < groups.length) void moveColumn(boardId, id, to);
                  }}
                  onDeleteColumn={(col) => {
                    if (cards.some((c) => c.column_id === col.id)) setConfirmDelete(col);
                    else void doDeleteColumn(col);
                  }}
                />
              ))}
            </SortableContext>

            {groupBy === 'column' && (
              <div className="w-[85vw] max-w-[340px] shrink-0 snap-start md:w-[300px]">
                {newColumn === null ? (
                  <button
                    type="button"
                    onClick={() => setNewColumn('')}
                    className="flex h-9 w-full items-center gap-2 rounded-card border border-dashed border-border px-3 text-sm text-text-3 transition-colors hover:border-border-strong hover:text-text-2"
                  >
                    <Plus size={15} aria-hidden />
                    {t('col.add')}
                  </button>
                ) : (
                  <form
                    className="flex flex-col gap-2 rounded-card border border-border-strong bg-surface-2 p-2"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!newColumn.trim()) return;
                      await createColumn(boardId, newColumn.trim().slice(0, 60));
                      setNewColumn('');
                    }}
                  >
                    <Input
                      autoFocus
                      value={newColumn}
                      maxLength={60}
                      aria-label={t('col.name')}
                      placeholder={t('col.name')}
                      onChange={(e) => setNewColumn(e.target.value)}
                      onKeyDown={(e) => e.key === 'Escape' && setNewColumn(null)}
                      onBlur={() => !newColumn.trim() && setNewColumn(null)}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" variant="primary" type="submit" onMouseDown={(e) => e.preventDefault()} disabled={!newColumn.trim()}>
                        {t('c.add')}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setNewColumn(null)}>
                        {t('c.cancel')}
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            )}
            {/* Trailing spacer so the last column isn't flush with the edge when scrolled. */}
            <div aria-hidden className="w-px shrink-0" />
          </div>
        </div>

        <DragOverlay dropAnimation={dropAnimation}>
          {activeCard ? (
            <CardTile
              card={activeCard}
              subject={activeCard.subject_id ? subjectById.get(activeCard.subject_id) : undefined}
              done={Boolean(activeCard.completed_at)}
              meta={meta.get(activeCard.id)}
              lifted
              className="cursor-grabbing"
            />
          ) : activeGroup ? (
            <div className="w-[300px] rounded-card border border-border-strong bg-surface-2 p-3 shadow-pop">
              <p className="text-sm font-medium text-text">{activeGroup.title}</p>
              <p className="mt-1 text-xs text-text-3">{t('board.cards', { n: activeGroup.cards.length })}</p>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <Dialog
        open={confirmDelete !== null}
        onOpenChange={(v) => !v && setConfirmDelete(null)}
        title={t('col.delete')}
        description={t('col.deleteConfirm', { n: columnDeleteCount })}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>
              {t('c.cancel')}
            </Button>
            <Button variant="danger" onClick={() => confirmDelete && doDeleteColumn(confirmDelete)}>
              {t('c.delete')}
            </Button>
          </>
        }
      />
    </>
  );
}
