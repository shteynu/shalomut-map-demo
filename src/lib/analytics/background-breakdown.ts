import { suppressFrequency, type SuppressedEntry } from '../privacy/cell-suppression';
import { WellbeingDimensionId, surveyInstrument } from '../shalomut-source';
import { statusForScore } from '../scoring-bands';
import {
  AnalyticSurveyQuestion,
  BackgroundSurveyQuestion,
  SurveyDefinition,
  SurveyResponseRecord,
  WellbeingStatus,
  isAnalyticQuestion,
  isBackgroundQuestion,
} from '../types/backend';
import { averageScore, readAnalyticAnswers } from './analytic-answers';

/**
 * Dimension scores broken down by the categories of one background question.
 *
 * The question this answers is the one a school actually asks — "do our newest
 * teachers score lower on belonging?" — and it is the first thing in the
 * product that publishes a number about a *subset* of the staff room. Every
 * number the round publishes today is about everyone in it, and the privacy
 * threshold was built for exactly that: it protects a total. A group is not a
 * total, so this module gets its rule from `../privacy/cell-suppression`
 * instead, and adds one of its own on top.
 *
 * ## Two gates, not one
 *
 * 1. **The round's own lock.** If the round is locked — too few responses, or
 *    an analysed question below the threshold — there is no breakdown at all.
 *    Splitting a result that may not be shown whole would be a way of reading
 *    it in pieces, which is what ADR-004's all-or-nothing rule exists to stop.
 * 2. **Each group's size.** A group below the threshold publishes neither its
 *    size nor any score, and `suppressFrequency` guarantees a suppressed group
 *    cannot be recovered by subtracting the published ones from the total.
 *
 * ## Why the unanswered are a category
 *
 * Background questions are optional, so some respondents answer none of them.
 * Dropping those responses would make the published groups sum to less than the
 * round total with nothing to say where the rest went — and a reader who knows
 * the total, which every manager screen shows, would recover the difference.
 * They are a named category, they are suppressed by the same rule as any other,
 * and they carry scores like any other: "the people who did not tell us their
 * tenure" is a real group with a real average.
 */

/** The category holding respondents who skipped the background question. */
export const UNANSWERED_CATEGORY_ID = 'unanswered';

export type BreakdownDimensionScore = {
  readonly dimensionId: WellbeingDimensionId;
  readonly averageScore: number;
  readonly computedStatus: WellbeingStatus;
  /** How many answers the average is over — never respondents, always answers. */
  readonly answerCount: number;
};

export type BreakdownGroup = {
  readonly categoryId: string;
  /** What a manager reads. The option's own label, or a stated fallback. */
  readonly label: string;
  /** The group's size, or the reason it may not be published. */
  readonly size: SuppressedEntry;
  /**
   * Present only for a published group, and only for the dimensions that group
   * actually answered. A suppressed group has no scores at all — that is the
   * whole point of suppressing it.
   */
  readonly dimensionScores?: Readonly<
    Partial<Record<WellbeingDimensionId, BreakdownDimensionScore>>
  >;
};

export type BackgroundBreakdown = {
  readonly questionId: string;
  readonly questionText: string;
  readonly groups: readonly BreakdownGroup[];
  readonly totalResponses: number;
  readonly privacyThreshold: number;
  /** True when nothing may be published — see gate 1 and gate 2 above. */
  readonly isFullySuppressed: boolean;
};

/** A background question a manager may break the results down by. */
export type BreakdownQuestionChoice = {
  readonly questionId: string;
  readonly questionText: string;
  readonly categoryCount: number;
};

/**
 * The questions this screen can offer.
 *
 * Single-choice only. A `number` question — average daily hours — has as many
 * categories as there are distinct answers, so grouping by it would produce
 * groups of one and suppress all of them; banding it into ranges is a
 * methodology decision nobody has made. An `allocation-100` row is a percentage
 * rather than a category at all.
 */
export function breakdownQuestionChoices(
  definition: SurveyDefinition | undefined,
): BreakdownQuestionChoice[] {
  if (!definition) return [];

  return definition.questions
    .filter((question) => question.enabled)
    .filter(isBackgroundQuestion)
    .filter((question) => question.answerMode === 'single-choice')
    .filter((question) => (question.options?.length ?? 0) > 0)
    .map((question) => ({
      questionId: question.id,
      questionText: question.text,
      categoryCount: question.options?.length ?? 0,
    }));
}

function findBreakdownQuestion(
  definition: SurveyDefinition | undefined,
  questionId: string,
): BackgroundSurveyQuestion | undefined {
  const question = definition?.questions
    .filter((candidate) => candidate.enabled)
    .filter(isBackgroundQuestion)
    .find((candidate) => candidate.id === questionId);

  if (!question) return undefined;
  if (question.answerMode !== 'single-choice') return undefined;
  if ((question.options?.length ?? 0) === 0) return undefined;

  return question;
}

/**
 * Which category one response falls into.
 *
 * A stored value that is not on the question's option list is its own category
 * rather than an unanswered one. The submit route validates answers against the
 * options, so the only way to store one is to edit the question after answers
 * arrived — and reporting those people as "did not answer" would be a claim
 * about them that is not true. The raw value is the label because it is a
 * builder-authored option id, never respondent text.
 */
function categoryForResponse(
  response: SurveyResponseRecord,
  question: BackgroundSurveyQuestion,
): string {
  const answer = response.answers.find(
    (candidate) => candidate.questionId === question.id,
  );
  const value = answer?.value?.trim();

  return value ? value : UNANSWERED_CATEGORY_ID;
}

/**
 * Break a round's dimension scores down by one background question.
 *
 * `isRoundLocked` is passed in rather than recomputed. The lock is the round
 * aggregate's own decision, made in `AnalyticsService` from the same responses
 * and the same threshold; recomputing it here would be a second implementation
 * of the privacy rule that could disagree with the first, and the disagreement
 * would show up as a breakdown published for a round whose map says it may not
 * be read.
 *
 * Returns `null` when the question is not one this screen can break down by.
 * That is a caller error — a stale link, a question deleted from the
 * questionnaire — rather than a privacy state, and the screen says so
 * differently.
 */
export function buildBackgroundBreakdown(options: {
  definition: SurveyDefinition | undefined;
  responses: readonly SurveyResponseRecord[];
  questionId: string;
  privacyThreshold: number;
  isRoundLocked: boolean;
}): BackgroundBreakdown | null {
  const { definition, responses, questionId, privacyThreshold, isRoundLocked } =
    options;
  const question = findBreakdownQuestion(definition, questionId);
  if (!question) return null;

  const labels = new Map<string, string>(
    (question.options ?? []).map((option) => [option.value, option.label]),
  );

  const responsesByCategory = new Map<string, SurveyResponseRecord[]>(
    // Every declared option is present even when nobody chose it, so an empty
    // category is suppressed as a zero rather than vanishing from the table.
    // A missing row and a suppressed row say different things to a reader.
    (question.options ?? []).map((option) => [option.value, []]),
  );
  const remember = (categoryId: string, response: SurveyResponseRecord) => {
    const bucket = responsesByCategory.get(categoryId) ?? [];
    bucket.push(response);
    responsesByCategory.set(categoryId, bucket);
  };

  for (const response of responses) {
    remember(categoryForResponse(response, question), response);
  }

  const totalResponses = responses.length;
  const counts = Object.fromEntries(
    [...responsesByCategory].map(([categoryId, bucket]) => [
      categoryId,
      bucket.length,
    ]),
  );

  // A locked round publishes nothing, and it must not publish the group sizes
  // either: the sizes alone would say how many people are in each category of a
  // round whose total is already too small to report.
  const suppressed = isRoundLocked
    ? null
    : suppressFrequency(counts, privacyThreshold);

  const analyticQuestions = new Map<string, AnalyticSurveyQuestion>(
    (definition?.questions ?? [])
      .filter((candidate) => candidate.enabled)
      .filter(isAnalyticQuestion)
      .map((candidate) => [candidate.id, candidate]),
  );

  const groups = [...responsesByCategory.keys()].map<BreakdownGroup>(
    (categoryId) => {
      const size: SuppressedEntry =
        suppressed?.categories[categoryId] ??
        ({ suppressed: true, reason: 'below-threshold' } as const);

      if (size.suppressed) {
        return { categoryId, label: labelFor(categoryId, labels), size };
      }

      return {
        categoryId,
        label: labelFor(categoryId, labels),
        size,
        dimensionScores: dimensionScoresFor(
          responsesByCategory.get(categoryId) ?? [],
          analyticQuestions,
        ),
      };
    },
  );

  return {
    questionId: question.id,
    questionText: question.text,
    groups,
    totalResponses,
    privacyThreshold,
    isFullySuppressed:
      isRoundLocked ||
      suppressed === null ||
      suppressed.isFullySuppressed ||
      groups.every((group) => group.size.suppressed),
  };
}

function labelFor(categoryId: string, labels: ReadonlyMap<string, string>) {
  if (categoryId === UNANSWERED_CATEGORY_ID) return 'לא ענו על השאלה';

  return labels.get(categoryId) ?? categoryId;
}

function dimensionScoresFor(
  responses: readonly SurveyResponseRecord[],
  analyticQuestions: ReadonlyMap<string, AnalyticSurveyQuestion>,
): Readonly<Partial<Record<WellbeingDimensionId, BreakdownDimensionScore>>> {
  const scores = new Map<WellbeingDimensionId, number[]>();

  for (const response of responses) {
    for (const { question, score } of readAnalyticAnswers(
      response,
      analyticQuestions,
    )) {
      const bucket = scores.get(question.dimensionId) ?? [];
      bucket.push(score);
      scores.set(question.dimensionId, bucket);
    }
  }

  const result: Partial<Record<WellbeingDimensionId, BreakdownDimensionScore>> =
    {};

  // Iterated over the canonical dimensions rather than over the map, so the
  // eight always come out in the taxonomy's own order and a group missing one
  // is missing it in place rather than shifting the others up.
  for (const dimension of surveyInstrument.dimensions) {
    const average = averageScore(scores.get(dimension.id) ?? []);
    if (average === undefined) continue;

    result[dimension.id] = {
      dimensionId: dimension.id,
      averageScore: average,
      computedStatus: statusForScore(average),
      answerCount: (scores.get(dimension.id) ?? []).length,
    };
  }

  return result;
}
