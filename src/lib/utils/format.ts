/**
 * Formats a score value as a percentage string (e.g. "85%").
 */
export function formatScorePercent(score: number): string {
  return `${Math.round(score)}%`;
}

/**
 * Formats a counts ratio string e.g. "12/20".
 */
export function formatRatio(current: number, total: number): string {
  return `${current}/${total}`;
}
