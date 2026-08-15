import type { SurveyDefinitionQuestion } from "../types/backend";
import { buildSurveySteps, type SurveyStep } from "./survey-steps";

/**
 * How long the questionnaire takes.
 *
 * This is the last thing a respondent reads before deciding whether to start,
 * and a teacher glancing at the link between lessons decides on that one
 * integer. It used to be ten seconds an item, and the reason it was ten was
 * written down: the three anchors are the same three sentences on every
 * question, so they are read once and recognised thereafter, and the answer is
 * a single tap that advances by itself.
 *
 * Every clause of that reason is false for the research instrument. A block of
 * twenty-two statements costs a paragraph of anchors once and then a scan per
 * row; an allocation grid of thirteen entries is arithmetic, not tapping; a
 * number field is typing. So the estimate is now per step rather than per
 * question, and the twenty-four-item default still comes out at the four
 * minutes it has been quoting, because a colour question still costs ten
 * seconds and there are still twenty-four of them.
 *
 * The numbers below are judgement, not measurement, and they are stated as
 * constants so that a real sitting can replace them. What they are checked
 * against is the owner's own reading of the source document: 126 items in
 * 20–30 minutes. These give 23.
 */
const SECONDS = {
  /** One statement, its own screen, its anchors above it. */
  standaloneQuestion: 10,
  /** Reading a block's heading and its anchor list, once. */
  blockPreamble: 20,
  /** One row of a block, where the anchors are already read. */
  blockRow: 6,
  /** A background choice: read the options, pick one. */
  choice: 10,
  /** A number to recall and type. */
  numberField: 15,
  /** Understanding that a grid must total 100, once. */
  allocationPreamble: 30,
  /** One row of it, where the total has to keep working out. */
  allocationRow: 8,
} as const;

function secondsForStep(step: SurveyStep): number {
  if (step.kind === "block") {
    return SECONDS.blockPreamble + step.questions.length * SECONDS.blockRow;
  }

  if (step.kind === "allocation") {
    return (
      SECONDS.allocationPreamble + step.questions.length * SECONDS.allocationRow
    );
  }

  const question = step.question;
  if (question.kind === "analytic") return SECONDS.standaloneQuestion;

  return question.answerMode === "number"
    ? SECONDS.numberField
    : SECONDS.choice;
}

export function estimateMinutesForSteps(steps: readonly SurveyStep[]): number {
  const seconds = steps.reduce((total, step) => total + secondsForStep(step), 0);

  return Math.max(1, Math.ceil(seconds / 60));
}

/**
 * The estimate from the questions themselves, for the two callers that hold a
 * question list rather than the steps built from it.
 */
export function estimateMinutesForQuestionnaire(
  questions: readonly SurveyDefinitionQuestion[],
): number {
  return estimateMinutesForSteps(buildSurveySteps(questions));
}
