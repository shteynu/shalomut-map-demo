/**
 * The grades a school's classes are counted by, in reading order.
 *
 * Held here rather than in the setup form because the create dialogs send a
 * background context too: a school being opened has no class counts yet and
 * still has to send the shape the API expects. Two lists would let a grade be
 * added in one place and silently dropped from the other.
 */
export const GRADE_LABELS = [
  "א",
  "ב",
  "ג",
  "ד",
  "ה",
  "ו",
  "ז",
  "ח",
  "ט",
  "י",
  "יא",
  "יב",
] as const;

/** Every grade at zero classes — what a school that has not counted them yet has. */
export function emptyClassesPerGrade(): Record<string, number> {
  return Object.fromEntries(GRADE_LABELS.map((grade) => [grade, 0]));
}
