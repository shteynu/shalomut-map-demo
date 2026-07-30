function canonicalizeJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalizeJson);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalizeJson(entry)]),
    );
  }
  return value;
}

/**
 * PostgreSQL JSONB does not preserve object-key order. Compare the semantic
 * JSON value so the same callback remains idempotent after a database round
 * trip, while a different payload cannot reuse a completed lease token.
 */
export function areAiAnalysisResultsEqual(
  left: Record<string, unknown> | undefined,
  right: Record<string, unknown> | undefined,
): boolean {
  if (left === undefined || right === undefined) return left === right;
  return JSON.stringify(canonicalizeJson(left)) === JSON.stringify(canonicalizeJson(right));
}
