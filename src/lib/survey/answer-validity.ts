import { isValueOnScale } from './answer-scales';
import type {
  AnalyticSurveyQuestion,
  BackgroundSurveyQuestion,
} from '../types/backend';

/**
 * What has to be known about a question to judge one answer to it.
 *
 * A `Pick` over the union rather than the whole question, so a caller holding
 * the round's snapshot can pass it straight in without the surrounding copy,
 * and a caller holding less than a whole question can still ask.
 */
export type AnswerableQuestion =
  | Pick<AnalyticSurveyQuestion, 'id' | 'kind' | 'scaleId'>
  | Pick<BackgroundSurveyQuestion, 'id' | 'kind' | 'answerMode' | 'options'>;

/**
 * One whole percent, which is what a row of an allocation grid may hold.
 *
 * Exported because the grid's own widget needs the same bound: a screen that
 * accepts `12.5` and a route that refuses it is a respondent losing their work
 * at the last step.
 */
export function parseAllocationEntry(value: string): number | undefined {
  if (!/^\d{1,3}$/.test(value)) return undefined;
  const parsed = Number(value);
  return parsed <= 100 ? parsed : undefined;
}

/**
 * Whether a value is one this question can hold.
 *
 * There is one copy of this because there are two enforcers. The submit route
 * refuses an answer the question cannot take, and the browser has to refuse the
 * same ones — the draft it restores, and the widget it draws. Two readings of
 * "valid" would show up as a questionnaire that accepts an answer and then
 * loses it at the last step, which is the worst moment to find out.
 *
 * `number` is bounded only by being a non-negative number. The one question
 * that uses it — average daily hours — has no ceiling this layer could defend
 * without inventing one.
 */
export function isAnswerValueValid(
  question: AnswerableQuestion,
  value: string,
): boolean {
  if (question.kind === 'analytic') {
    return isValueOnScale(question.scaleId, value);
  }

  if (question.answerMode === 'single-choice') {
    return (question.options ?? []).some((option) => option.value === value);
  }

  if (question.answerMode === 'allocation-100') {
    return parseAllocationEntry(value) !== undefined;
  }

  return /^\d+(\.\d+)?$/.test(value);
}
