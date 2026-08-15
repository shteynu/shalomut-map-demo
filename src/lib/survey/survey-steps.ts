import {
  AnalyticSurveyQuestion,
  BackgroundSurveyQuestion,
  SurveyDefinitionQuestion,
  isAnalyticQuestion,
  isBackgroundQuestion,
} from "../types/backend";
import type { AnswerScaleId } from "./answer-scales";

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
    }
  | {
      readonly kind: "block";
      readonly sectionId: string;
      readonly scaleId: AnswerScaleId;
      readonly questions: readonly AnalyticSurveyQuestion[];
    };

/** Every question a step asks about, whichever shape the step is. */
export function questionsInStep(step: SurveyStep): readonly SurveyDefinitionQuestion[] {
  return step.kind === "question" ? [step.question] : step.questions;
}

/**
 * Which multi-question step, if any, a question belongs to.
 *
 * Two of them, keyed the same way so the grouping loop below stays one loop.
 * An allocation grid is a constraint — its rows must total 100 — and a block is
 * a reading unit: statements that share a section and a scale, so their anchors
 * can be stated once above them instead of repeated under each.
 *
 * `wellbeing-colour` is deliberately not blockable. Its stones *are* its
 * anchors — three faces with a sentence each — so there is nothing to hoist
 * above them, and twenty-four of them in a column is not a shorter screen than
 * twenty-four screens. It also keeps every questionnaire persisted before this
 * module rendering exactly as it did.
 */
type GroupedQuestion =
  | {
      readonly key: string;
      readonly step: Extract<SurveyStep, { kind: "allocation" }>;
      readonly question: BackgroundSurveyQuestion;
    }
  | {
      readonly key: string;
      readonly step: Extract<SurveyStep, { kind: "block" }>;
      readonly question: AnalyticSurveyQuestion;
    };

function groupFor(
  question: SurveyDefinitionQuestion,
): GroupedQuestion | undefined {
  if (isBackgroundQuestion(question)) {
    const groupId = question.allocationGroupId;
    if (question.answerMode !== "allocation-100" || !groupId) return undefined;

    return {
      key: `allocation:${groupId}`,
      step: { kind: "allocation", groupId, questions: [question] },
      question,
    };
  }

  const sectionId = question.sectionId?.trim();
  if (!sectionId || question.scaleId === "wellbeing-colour") return undefined;

  return {
    // The scale is part of the key, not only the section: a block states one
    // set of anchors, so a section mixing a 1–5 and a 1–7 scale is two blocks.
    key: `block:${sectionId}:${question.scaleId}`,
    step: {
      kind: "block",
      sectionId,
      scaleId: question.scaleId,
      questions: [question],
    },
    question,
  };
}

/**
 * Group the questionnaire into the steps a respondent walks.
 *
 * Order is the questionnaire's own, and a multi-question step takes the
 * position of its first member. Members separated in the questionnaire are
 * still gathered — a manager who moved one row of a grid reordered a list
 * rather than split a constraint, and the builder already shows a section as
 * one group whatever the order, so gathering is what a manager was looking at
 * when they arranged it.
 */
export function buildSurveySteps(
  questions: readonly SurveyDefinitionQuestion[],
): SurveyStep[] {
  const steps: SurveyStep[] = [];
  const groupPosition = new Map<string, number>();

  for (const question of questions) {
    const group = groupFor(question);

    if (!group) {
      steps.push({ kind: "question", question });
      continue;
    }

    const existing = groupPosition.get(group.key);
    if (existing === undefined) {
      groupPosition.set(group.key, steps.length);
      steps.push(group.step);
      continue;
    }

    const step = steps[existing];
    if (step.kind === "allocation" && isBackgroundQuestion(question)) {
      steps[existing] = { ...step, questions: [...step.questions, question] };
    } else if (step.kind === "block" && isAnalyticQuestion(question)) {
      steps[existing] = { ...step, questions: [...step.questions, question] };
    }
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
 * A block is per question after all: its statements share a screen and a scale
 * but not a constraint, so each one is required or not on its own.
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

  if (step.kind === "block") {
    return step.questions.every(
      (question) => !question.required || hasAnswer(answers, question.id),
    );
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
