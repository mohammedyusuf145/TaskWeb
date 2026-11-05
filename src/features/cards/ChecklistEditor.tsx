import { useState } from 'react';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus, X } from 'lucide-react';
import type { ChecklistItem } from '@/types/database';
import { useChecklist } from '@/lib/db/hooks';
import { useT } from '@/lib/i18n';
import { useAutosave } from '@/lib/useAutosave';
import { cn } from '@/lib/cn';
import { Checkbox as RCheckbox } from 'radix-ui';
import { Check } from 'lucide-react';
import { ProgressBar } from '@/components/ui';
import { addChecklistItem, deleteChecklistItem, moveChecklistItem, updateChecklistItem } from '@/features/boards/ops';

export function ChecklistEditor({ cardId }: { cardId: string }) {
  const t = useT();
  const items = useChecklist(cardId) ?? [];
  const [draft, setDraft] = useState('');
  const done = items.filter((i) => i.done).length;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  async function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const to = items.findIndex((i) => i.id === over.id);
    await moveChecklistItem(cardId, String(active.id), to);
  }

  return (
    <div className="flex flex-col gap-2">
      {items.length > 0 && (
        <div className="flex items-center gap-3">
          <ProgressBar value={done / items.length} label={t('card.checklistProgress', { done, total: items.length })} />
          <span className="shrink-0 text-xs text-text-3 tabular">{t('card.checklistProgress', { done, total: items.length })}</span>
        </div>
      )}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          <ul className="-mx-2 flex flex-col">
            {items.map((item) => (
              <ChecklistRow key={item.id} item={item} />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      <form
        className="flex items-center gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          const text = draft.trim();
          if (!text) return;
          setDraft('');
          await addChecklistItem(cardId, text.slice(0, 500));
        }}
      >
        <Plus size={16} className="shrink-0 text-text-3" aria-hidden />
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t('card.addItem')}
          aria-label={t('card.addItem')}
          dir="auto"
          maxLength={500}
          className="h-9 min-w-0 flex-1 rounded-control bg-transparent px-1 text-base text-text placeholder:text-text-3 focus:bg-surface-1 focus:outline-none"
        />
      </form>
    </div>
  );
}

function ChecklistRow({ item }: { item: ChecklistItem }) {
  const t = useT();
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id: item.id });
  const text = useAutosave(item.text, (v) => (v.trim() ? updateChecklistItem(item.id, { text: v.trim().slice(0, 500) }) : undefined));

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn('group/item flex min-h-10 items-center gap-2 rounded-control px-2 hover:bg-surface-1', isDragging && 'relative z-10 bg-surface-3 shadow-pop')}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={t('card.itemDrag')}
        className="-ms-1 inline-flex h-7 w-4 shrink-0 cursor-grab touch-none items-center justify-center text-text-3 opacity-0 group-hover/item:opacity-100 focus-visible:opacity-100"
      >
        <GripVertical size={14} />
      </button>
      <RCheckbox.Root
        checked={item.done}
        onCheckedChange={(v) => updateChecklistItem(item.id, { done: v === true })}
        aria-label={item.text}
        className="inline-flex size-[18px] shrink-0 items-center justify-center rounded-chip border border-border-strong bg-surface-2 transition-colors data-[state=checked]:border-accent data-[state=checked]:bg-accent"
      >
        <RCheckbox.Indicator>
          <Check size={12} strokeWidth={3} className="text-accent-ink" />
        </RCheckbox.Indicator>
      </RCheckbox.Root>
      <input
        value={text.value}
        onChange={(e) => text.onChange(e.target.value)}
        onBlur={text.onBlur}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        aria-label={t('card.checklist')}
        dir="auto"
        maxLength={500}
        className={cn('h-8 min-w-0 flex-1 bg-transparent text-base focus:outline-none', item.done ? 'text-text-3 line-through decoration-text-3/60' : 'text-text')}
      />
      <button
        type="button"
        onClick={() => deleteChecklistItem(item.id)}
        aria-label={t('card.removeItem')}
        className="inline-flex size-7 shrink-0 items-center justify-center rounded-control text-text-3 opacity-0 hover:bg-surface-3 hover:text-text group-hover/item:opacity-100 focus-visible:opacity-100 max-md:opacity-100"
      >
        <X size={14} />
      </button>
    </li>
  );
}
