import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { KeyboardEvent } from 'react';
import type { Card, Subject } from '@/types/database';
import type { CardMeta } from '@/lib/db/hooks';
import { cn } from '@/lib/cn';
import { CardTile } from '@/features/cards/CardTile';

/**
 * Draggable card. Mouse: drag after 5px. Touch: long-press. Keyboard: Space to pick up,
 * arrows to move, Space to drop. Click or Enter opens the card.
 */
export function SortableCard({
  card,
  containerId,
  subject,
  done,
  meta,
  disabled,
  onOpen,
}: {
  card: Card;
  containerId: string;
  subject?: Subject;
  done: boolean;
  meta?: CardMeta;
  disabled?: boolean;
  onOpen: (id: string) => void;
}) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { type: 'card', containerId },
    disabled,
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      aria-roledescription={undefined}
      data-card-id={card.id}
      onClick={() => onOpen(card.id)}
      onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
        listeners?.onKeyDown?.(e);
        if (e.key === 'Enter' && !e.defaultPrevented) {
          e.preventDefault();
          onOpen(card.id);
        }
      }}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        'group/card relative cursor-pointer touch-manipulation rounded-card select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        isDragging && 'z-10',
      )}
    >
      <CardTile
        card={card}
        subject={subject}
        done={done}
        meta={meta}
        className={cn(isDragging && 'border-dashed border-border-strong bg-transparent opacity-40 shadow-none [&>*]:invisible')}
      />
    </div>
  );
}
