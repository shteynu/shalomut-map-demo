import { clamp } from "@/lib/utils/math";

/** One arrow press, and one press with Shift held for crossing the stage. */
export const NUDGE_STEP = 16;
export const NUDGE_STEP_LARGE = 64;

export interface StoneOffset {
  x: number;
  y: number;
}

export interface StoneBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/**
 * Which way an arrow key moves a stone. The map is laid out right-to-left, but
 * these are screen directions: a person pressing the left arrow expects the
 * stone to go left whatever the writing direction.
 */
const nudgeDirections: Record<string, StoneOffset> = {
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
};

/** Whether this key is one the map moves a stone with. */
export function isNudgeKey(key: string): boolean {
  return key in nudgeDirections;
}

/**
 * Where an arrow key puts a stone, or nothing when the key is not one of the
 * four arrows. The stage is the same fence the pointer drag respects, so a
 * stone cannot be walked off the map.
 */
export function nextNudgeOffset(
  key: string,
  current: StoneOffset,
  bounds: StoneBounds,
  large = false,
): StoneOffset | null {
  const direction = nudgeDirections[key];
  if (!direction) return null;

  const step = large ? NUDGE_STEP_LARGE : NUDGE_STEP;

  return {
    x: clamp(current.x + direction.x * step, bounds.minX, bounds.maxX),
    y: clamp(current.y + direction.y * step, bounds.minY, bounds.maxY),
  };
}
