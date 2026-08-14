import { dimensionPresentations } from "@/lib/dashboard/dimension-presentation";
import { BACKGROUND_FILTER_ID, type BuilderQuestion } from "./types";

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
 * What a question can be found by, beyond its own wording and id.
 *
 * An analytic question answers to its dimension label — a manager looking for
 * "איזון" is as likely to mean the dimension as the word. A background question
 * has no dimension, so it answers to the section it was put in instead, which
 * is the only grouping it has.
 */
function extraSearchTerms(question: BuilderQuestion): string[] {
  return [
    question.kind === "analytic" ? dimensionLabel(question.dimensionId) : "רקע",
    question.sectionId ?? "",
  ];
}

export function matchesSearch(question: BuilderQuestion, term: string): boolean {
  const needle = term.trim().toLocaleLowerCase("he");
  if (!needle) return true;

  return [question.text, question.id, ...extraSearchTerms(question)].some(
    (candidate) => candidate.toLocaleLowerCase("he").includes(needle),
  );
}

/**
 * The questions on screen: the tab, then the search box.
 *
 * `BACKGROUND_FILTER_ID` is a tab and not a dimension. Without it a demographic
 * question would appear under no tab at all, since every other tab asks which
 * of the eight dimensions a question belongs to and a background question
 * belongs to none — it would be reachable only by clearing the filter, which is
 * how a manager loses one without noticing.
 */
export function visibleQuestionsFor(
  questions: BuilderQuestion[],
  dimensionId: string,
  searchTerm: string,
): BuilderQuestion[] {
  return questions.filter((question) => {
    if (!matchesSearch(question, searchTerm)) return false;
    if (dimensionId === "all") return true;
    if (dimensionId === BACKGROUND_FILTER_ID) return question.kind === "background";
    return question.kind === "analytic" && question.dimensionId === dimensionId;
  });
}

/**
 * The key React needs for the block of questions belonging to no section. A
 * constant rather than `undefined`, and one no manager can type as a section
 * name, so it cannot collide with a real one.
 */
export const UNSECTIONED_KEY = "__unsectioned__";

export type QuestionSection = {
  /** Undefined for the block of questions nobody assigned to a section. */
  sectionId: string | undefined;
  questions: BuilderQuestion[];
};

/**
 * Split the visible list into the blocks a respondent will read it in.
 *
 * Order is first appearance, not alphabetical: the questionnaire's own order is
 * what a respondent gets, and sorting the blocks here would show the manager a
 * different questionnaire from the one they are building. A section that a
 * filter has emptied does not appear at all — an empty block is a claim that
 * the section has no questions, which is a different thing from a filter
 * hiding them.
 */
export function groupBySection(
  questions: BuilderQuestion[],
): QuestionSection[] {
  const sections: QuestionSection[] = [];
  const byId = new Map<string | undefined, QuestionSection>();

  for (const question of questions) {
    const sectionId = question.sectionId?.trim() || undefined;
    let section = byId.get(sectionId);

    if (!section) {
      section = { sectionId, questions: [] };
      byId.set(sectionId, section);
      sections.push(section);
    }

    section.questions.push(question);
  }

  return sections;
}

/**
 * Every section name already in use, for the datalist the edit dialog offers.
 * Typing a name that differs by a space would otherwise create a second block
 * that looks identical to the first.
 */
export function sectionNamesIn(questions: BuilderQuestion[]): string[] {
  return [
    ...new Set(
      questions
        .map((question) => question.sectionId?.trim())
        .filter((sectionId): sectionId is string => Boolean(sectionId)),
    ),
  ].sort((left, right) => left.localeCompare(right, "he"));
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
