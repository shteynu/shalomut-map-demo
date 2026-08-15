import {
  BackgroundSurveyQuestion,
  SurveyDefinitionQuestion,
  isBackgroundQuestion,
} from "../types/backend";

/**
 * What a respondent is shown at one position in the questionnaire.
 *
 * Until the research instrument, a position was a question: the screen showed
 * question `n` of `total` and advanced by one. An allocation grid breaks that.
 * It is stored as thirteen questions — one per activity, so the uniqueness key
 * and the one-answer-per-question shape stay as they are — but it is answered
 * as a single thing, because its rows must total 100 and a respondent cannot
 * hold a running total across thirteen screens.
 *
 * So the screen walks steps and the storage keeps questions, and this module is
 * the one place that knows the difference.
 */
export type SurveyStep =
  | { readonly kind: "question"; readonly question: SurveyDefinitionQuestion }
  | {
      readonly kind: "allocation";
      readonly groupId: string;
      readonly questions: readonly BackgroundSurveyQuestion[];
    };

/** Every question a step asks about, whichever shape the step is. */
export function questionsInStep(step: SurveyStep): readonly SurveyDefinitionQuestion[] {
  return step.kind === "question" ? [step.question] : step.questions;
}

/**
 * Group the questionnaire into the steps a respondent walks.
 *
 * Order is the questionnaire's own, and an allocation group takes the position
 * of its first row. Rows of the same group that were separated in the
 * questionnaire are still gathered into one step — a manager who moves one row
 * of a grid has reordered a list, not split a constraint, and thirteen entries
 * that must total 100 cannot be answered in two places.
 */
export function buildSurveySteps(
  questions: readonly SurveyDefinitionQuestion[],
): SurveyStep[] {
  const steps: SurveyStep[] = [];
  const groupPosition = new Map<string, number>();

  for (const question of questions) {
    const groupId =
      isBackgroundQuestion(question) && question.answerMode === "allocation-100"
        ? question.allocationGroupId
        : undefined;

    if (!groupId) {
      steps.push({ kind: "question", question });
      continue;
    }

    const existing = groupPosition.get(groupId);
    if (existing === undefined) {
      groupPosition.set(groupId, steps.length);
      steps.push({
        kind: "allocation",
        groupId,
        questions: [question as BackgroundSurveyQuestion],
      });
      continue;
    }

    const step = steps[existing];
    if (step.kind !== "allocation") continue;
    steps[existing] = {
      ...step,
      questions: [...step.questions, question as BackgroundSurveyQuestion],
    };
  }

  return steps;
}

/**
 * The index of the furthest *question* a step index corresponds to.
 *
 * The funnel stores `lastQuestionReached` as a question index and has done
 * since before steps existed, so reporting a step index would silently change
 * what every stored number means — a round from last month and a round from
 * today would be counted on different scales with nothing on screen to say so.
 * A step reports the position of its first question, which is what the number
 * has always meant: how far into the questionnaire the session got.
 */
export function questionIndexForStep(
  steps: readonly SurveyStep[],
  stepIndex: number,
  questions: readonly SurveyDefinitionQuestion[],
): number {
  const step = steps[stepIndex];
  if (!step) return questions.length;

  const first = questionsInStep(step)[0];
  const index = questions.findIndex((question) => question.id === first?.id);

  return index === -1 ? 0 : index;
}

/**
 * Whether a step has been answered enough to move past it without leaving a
 * required question behind.
 *
 * An optional question is complete the moment it is reached: skipping it is an
 * answer the instrument allows, and the screen must not hold a respondent on a
 * demographic question they would rather not answer.
 *
 * An allocation grid is the one place where "answered" is not per question. A
 * grid is either untouched or filled in whole — half a grid does not total 100
 * and the submit route refuses it — so a required grid needs every row and an
 * optional one needs either every row or none.
 */
export function isStepComplete(
  step: SurveyStep,
  answers: Readonly<Record<string, string>>,
): boolean {
  if (step.kind === "question") {
    return !step.question.required || hasAnswer(answers, step.question.id);
  }

  const answered = step.questions.filter((question) =>
    hasAnswer(answers, question.id),
  ).length;

  if (answered === step.questions.length) return true;
  if (answered === 0) return step.questions.every((question) => !question.required);

  return false;
}

/** The rows of a grid, as numbers, with anything unparseable left out. */
export function allocationTotal(
  questions: readonly SurveyDefinitionQuestion[],
  answers: Readonly<Record<string, string>>,
): number {
  return questions.reduce((sum, question) => {
    const parsed = Number(answers[question.id]);
    return Number.isFinite(parsed) ? sum + parsed : sum;
  }, 0);
}

/**
 * Why the questionnaire may not be sent yet, or `undefined` when it may.
 *
 * Two reasons, kept apart because they need different sentences. "Answer the
 * questions you skipped" is wrong advice for a respondent whose only problem is
 * a grid at 97, and the review screen was saying it: it reported the step count,
 * which is full in that case, next to a heading claiming answers were missing.
 */
export type SubmissionBlocker = "required-question" | "allocation-total";

export function submissionBlocker(
  steps: readonly SurveyStep[],
  answers: Readonly<Record<string, string>>,
): SubmissionBlocker | undefined {
  let allocation: SubmissionBlocker | undefined;

  for (const step of steps) {
    if (step.kind !== "allocation") {
      if (!isStepComplete(step, answers)) return "required-question";
      continue;
    }

    const touched = step.questions.some((question) =>
      hasAnswer(answers, question.id),
    );
    const balanced =
      !touched || allocationTotal(step.questions, answers) === 100;

    // A half-filled grid is a grid problem, not a skipped question: telling the
    // respondent to answer what they skipped would point them at the wrong card.
    if (!isStepComplete(step, answers) || !balanced) {
      allocation ??= "allocation-total";
    }
  }

  return allocation;
}

/**
 * Whether the questionnaire may be submitted: every required question answered,
 * and every touched allocation grid totalling exactly 100.
 *
 * The grid rule is here rather than only in the widget because the submit route
 * enforces it too, and a screen that lets a respondent press send on a grid
 * totalling 97 would spend their goodwill on a refusal it could have prevented.
 */
export function canSubmitSurvey(
  steps: readonly SurveyStep[],
  answers: Readonly<Record<string, string>>,
): boolean {
  return submissionBlocker(steps, answers) === undefined;
}

function hasAnswer(
  answers: Readonly<Record<string, string>>,
  questionId: string,
): boolean {
  return (answers[questionId] ?? "").trim().length > 0;
}
