/**
 * Restricts a given number to stay within a specified range [min, max].
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Calculates a rounded percentage value given a count and total.
 * Returns 0 if total is zero or invalid.
 */
export function calculatePercentage(value: number, total: number): number {
  if (!total || total <= 0) {
    return 0;
  }
  return Math.round((value / total) * 100);
}
