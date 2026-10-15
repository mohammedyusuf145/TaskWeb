import { useRef, type MutableRefObject } from 'react';
import {
  KeyboardCode,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type KeyboardCoordinateGetter,
  type Modifier,
} from '@dnd-kit/core';

export interface Step {
  x: number;
  y: number;
}

/**
 * Sensors for calendar events. Keyboard: Space to pick up, arrows move by one slot
 * (15 min vertically / one day horizontally in the time grid, one cell in the month grid).
 */
export function useCalendarSensors(step: MutableRefObject<Step>) {
  const getter: KeyboardCoordinateGetter = (event, { currentCoordinates }) => {
    const { x, y } = step.current;
    switch (event.code) {
      case KeyboardCode.Up:
        event.preventDefault();
        return { ...currentCoordinates, y: currentCoordinates.y - y };
      case KeyboardCode.Down:
        event.preventDefault();
        return { ...currentCoordinates, y: currentCoordinates.y + y };
      case KeyboardCode.Left:
        event.preventDefault();
        return { ...currentCoordinates, x: currentCoordinates.x - x };
      case KeyboardCode.Right:
        event.preventDefault();
        return { ...currentCoordinates, x: currentCoordinates.x + x };
    }
    return undefined;
  };
  return useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: getter, keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space'] } }),
  );
}

export function useStep(initial: Step) {
  return useRef<Step>(initial);
}

/** Snap vertical movement to a grid (e.g. 15 minutes). */
export function snapY(px: number): Modifier {
  return ({ transform }) => ({ ...transform, y: Math.round(transform.y / px) * px });
}
