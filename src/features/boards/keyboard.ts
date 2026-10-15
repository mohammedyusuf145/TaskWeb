import { KeyboardCode, type KeyboardCoordinateGetter } from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';

const ARROWS: string[] = [KeyboardCode.Up, KeyboardCode.Down, KeyboardCode.Left, KeyboardCode.Right];

/**
 * Keyboard movement for cards across columns, using on-screen geometry (so it also works in RTL):
 * ↑/↓ move to the neighbouring card in the same column, ←/→ jump to the nearest card or empty
 * column in that direction. Columns themselves use dnd-kit's default sortable behaviour.
 */
export const boardKeyboardCoordinates: KeyboardCoordinateGetter = (event, args) => {
  const { context } = args;
  const { active, collisionRect, droppableRects, droppableContainers } = context;
  if (!active || !collisionRect) return undefined;
  if (active.data.current?.type === 'column') return sortableKeyboardCoordinates(event, args);
  if (!ARROWS.includes(event.code)) return undefined;
  event.preventDefault();

  const cx = collisionRect.left + collisionRect.width / 2;
  const cy = collisionRect.top + collisionRect.height / 2;
  const vertical = event.code === KeyboardCode.Up || event.code === KeyboardCode.Down;

  let best: { left: number; top: number; score: number } | null = null;
  for (const entry of droppableContainers.getEnabled()) {
    const type = entry.data.current?.type;
    if (entry.id === active.id || type === 'column') continue;
    if (vertical && type !== 'card') continue;
    const rect = droppableRects.get(entry.id);
    if (!rect) continue;
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const sameColumn = Math.abs(x - cx) < collisionRect.width / 2;

    let ok = false;
    let score = 0;
    switch (event.code) {
      case KeyboardCode.Up:
        ok = sameColumn && y < cy - 1;
        score = cy - y;
        break;
      case KeyboardCode.Down:
        ok = sameColumn && y > cy + 1;
        score = y - cy;
        break;
      case KeyboardCode.Left:
        ok = x < cx - collisionRect.width / 2;
        score = (cx - x) * 4 + Math.abs(rect.top - collisionRect.top);
        break;
      case KeyboardCode.Right:
        ok = x > cx + collisionRect.width / 2;
        score = (x - cx) * 4 + Math.abs(rect.top - collisionRect.top);
        break;
    }
    if (ok && (!best || score < best.score)) best = { left: rect.left, top: rect.top, score };
  }
  if (!best) return undefined;
  // Moving down lands just below the target so the card takes its place, not the one above it.
  const offsetY = event.code === KeyboardCode.Down ? 1 : 0;
  return { x: best.left, y: best.top + offsetY };
};
