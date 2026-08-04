import { dimensionPresentations } from "@/lib/dashboard/dimension-presentation";
import type { BuilderQuestion } from "./types";

/**
 * Working a 24-question instrument through one dimension tab at a time is fine
 * for reading and slow for editing. These are the operations the list needs on
 * top of that: find a question by what it says, act on a whole view at once, and
 * change the order respondents will see.
 *
 * They are here rather than in the component because each one is a statement
 * about the questionnaire, and the questionnaire is what the round freezes.
 */

function dimensionLabel(dimensionId: string): string {
  return (
    dimensionPresentations.find((dimension) => dimension.id === dimensionId)
      ?.conceptLabel ?? dimensionId
  );
}

/**
 * Whether a question answers a search. Text and dimension label both count: a
 * manager looking for "איזון" is as likely to mean the dimension as the word.
 */
export function matchesSearch(question: BuilderQuestion, term: string): boolean {
  const needle = term.trim().toLocaleLowerCase("he");
  if (!needle) return true;

  return (
    question.text.toLocaleLowerCase("he").includes(needle) ||
    dimensionLabel(question.dimensionId).toLocaleLowerCase("he").includes(needle) ||
    question.id.toLocaleLowerCase("he").includes(needle)
  );
}

/** The questions on screen: the dimension tab, then the search box. */
export function visibleQuestionsFor(
  questions: BuilderQuestion[],
  dimensionId: string,
  searchTerm: string,
): BuilderQuestion[] {
  return questions.filter(
    (question) =>
      (dimensionId === "all" || question.dimensionId === dimensionId) &&
      matchesSearch(question, searchTerm),
  );
}

/**
 * Enable or hide every question in the current view.
 *
 * Scoped to the keys on screen rather than to a dimension, so what the button
 * changes is exactly what the manager can see — including when a search has
 * narrowed the list further than the tab did.
 */
export function setEnabledForKeys(
  questions: BuilderQuestion[],
  draftKeys: string[],
  enabled: boolean,
): BuilderQuestion[] {
  const keys = new Set(draftKeys);

  return questions.map((question) =>
    keys.has(question.draftKey) ? { ...question, enabled } : question,
  );
}

/**
 * Move a question one place up or down the list respondents will see.
 *
 * The step is measured in the current view, not the underlying array: a
 * question moved while one dimension is on screen swaps with the question above
 * it *on screen*, which is the one the manager is looking at. The two questions
 * exchange their positions in the full list, so nothing outside the view moves.
 */
export function moveQuestionWithinView(
  questions: BuilderQuestion[],
  visibleKeys: string[],
  draftKey: string,
  direction: -1 | 1,
): BuilderQuestion[] {
  const visibleIndex = visibleKeys.indexOf(draftKey);
  const neighbourKey = visibleKeys[visibleIndex + direction];

  if (visibleIndex === -1 || neighbourKey === undefined) return questions;

  const from = questions.findIndex((question) => question.draftKey === draftKey);
  const to = questions.findIndex(
    (question) => question.draftKey === neighbourKey,
  );

  if (from === -1 || to === -1) return questions;

  const reordered = [...questions];
  [reordered[from], reordered[to]] = [reordered[to], reordered[from]];

  return reordered;
}
