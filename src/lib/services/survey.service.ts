import { DuplicateResponseError } from '../repositories/errors';
import { ISurveyRepository } from '../repositories/interfaces';
import { responseScale } from '../shalomut-source';
import { isValueOnScale, scoreForAnswer } from '../survey/answer-scales';
import {
  isAnswerValueValid,
  parseAllocationEntry,
} from '../survey/answer-validity';
import { canonicalSurveyQuestions } from '../survey-definition';
import {
  AnalyticSurveyQuestion,
  AnswerValue,
  BackgroundSurveyQuestion,
  QuestionAnswerInput,
  QuestionAnswerRecord,
  SubmitSurveyResult,
  SurveyResponseInput,
  SurveyResponseRecord,
  SurveySubmissionErrorCode,
} from '../types/backend';
import { recordDuplicateSubmissionConflict } from '../server/ai-operational-metrics';

/**
 * One answer for both ways a duplicate is found — the pre-check and the unique
 * index — so a respondent cannot tell a race from an ordinary second attempt.
 */
export const ALREADY_SUBMITTED_ERROR =
  'You have already submitted a response for this survey round.';

export const ATTEMPT_TOKEN_REQUIRED_ERROR =
  'A submission must carry the attempt token hash of the session that made it.';

/**
 * The shape `hashAnonymousToken` produces: a SHA-256 digest in lowercase hex.
 *
 * The token hash used to be optional, and omitting it skipped the duplicate
 * guard entirely — so the one defence against a round being stuffed was a field
 * the caller could simply leave out. Requiring it is not a claim that the value
 * is trustworthy; anybody can produce sixty-four hex characters. It is a claim
 * that the guard runs, and that this endpoint and the attempt endpoint agree on
 * what a token hash is, so a value one of them stores is one the other can find.
 */
const ATTEMPT_TOKEN_HASH = /^[0-9a-f]{64}$/;

function isAttemptTokenHash(value: string | undefined): value is string {
  return typeof value === 'string' && ATTEMPT_TOKEN_HASH.test(value);
}

/**
 * The HTTP status each refusal maps to, kept next to the codes rather than
 * inside the route so the contract has one home and `docs/openapi.yaml` has
 * one thing to agree with.
 *
 * A duplicate is `409`, not `400`: the request is well formed, and it conflicts
 * with a response the round already holds. That distinction is what lets a
 * restored attempt recognise its own earlier success instead of asking the
 * respondent to answer everything again.
 */
export const SURVEY_SUBMISSION_ERROR_STATUS: Record<
  SurveySubmissionErrorCode,
  number
> = {
  ROUND_NOT_FOUND: 404,
  ROUND_NOT_ACTIVE: 400,
  DEFINITION_INVALID: 409,
  INVALID_ANSWERS: 400,
  ALREADY_SUBMITTED: 409,
  ATTEMPT_TOKEN_REQUIRED: 400,
  // A conflict rather than a rate limit: nothing about waiting changes it, and
  // `429` would invite a client to retry a request that will never be accepted.
  ROUND_FULL: 409,
};

/**
 * What the service needs to know about a question to check an answer against
 * it. A `Pick` over the union rather than the whole question, so a caller can
 * pass the round's snapshot without the surrounding copy.
 */
export type ExpectedQuestion =
  | Pick<AnalyticSurveyQuestion, 'id' | 'kind' | 'dimensionId' | 'required' | 'scaleId' | 'polarity'>
  | Pick<BackgroundSurveyQuestion, 'id' | 'kind' | 'required' | 'answerMode' | 'options' | 'allocationGroupId'>;

/**
 * The default a submission is checked against when the caller brings no
 * questionnaire — a legacy round with no persisted snapshot.
 *
 * Delegated rather than re-derived: this used to map `surveyInstrument` itself
 * and retype the scale and polarity, which made it a second opinion about what
 * the default asks. An `ExpectedQuestion` is a `Pick` of the persisted shape,
 * so the full question satisfies it and the extra fields are simply unread.
 */
function canonicalExpectedQuestions(): ExpectedQuestion[] {
  return canonicalSurveyQuestions();
}

/**
 * Refuse an answer the question cannot hold, and say which one.
 *
 * The rule itself lives in `../survey/answer-validity` because the browser
 * enforces it too — on the draft it restores and on the widget it draws. This
 * wrapper is only the message.
 */
function validateAnswerValue(
  question: ExpectedQuestion,
  value: string,
): string | undefined {
  return isAnswerValueValid(question, value)
    ? undefined
    : `Invalid answer value '${value}' for question ${question.id}`;
}

/**
 * Each allocation grid the submission touched must total exactly 100.
 *
 * Checked here rather than only in the browser because the endpoint is public:
 * the respondent screen refuses a total that is not 100, and nothing stops a
 * request that skipped that screen. A grid nobody answered is not checked —
 * skipping an optional grid is allowed, answering half of it is not.
 */
function validateAllocationTotals(
  expectedQuestions: ExpectedQuestion[],
  answers: QuestionAnswerInput[],
): string | undefined {
  const groups = new Map<string, { expected: Set<string>; total: number; answered: number }>();

  for (const question of expectedQuestions) {
    if (question.kind !== 'background') continue;
    if (question.answerMode !== 'allocation-100') continue;
    const groupId = question.allocationGroupId!;
    const group = groups.get(groupId) ?? {
      expected: new Set<string>(),
      total: 0,
      answered: 0,
    };
    group.expected.add(question.id);
    groups.set(groupId, group);
  }

  if (groups.size === 0) return undefined;

  for (const answer of answers) {
    for (const group of groups.values()) {
      if (!group.expected.has(answer.questionId)) continue;
      const entry = parseAllocationEntry(answer.value);
      if (entry === undefined) continue;
      group.total += entry;
      group.answered += 1;
    }
  }

  for (const [groupId, group] of groups) {
    if (group.answered === 0) continue;
    if (group.answered !== group.expected.size) {
      return `Allocation grid '${groupId}' must be answered in full.`;
    }
    if (group.total !== 100) {
      return `Allocation grid '${groupId}' must total 100, not ${group.total}.`;
    }
  }

  return undefined;
}

/**
 * The score one answer contributes, or `undefined` when the question is
 * background and contributes to no dimension.
 */
export function scoreForQuestionAnswer(
  question: ExpectedQuestion,
  value: string,
): number | undefined {
  if (question.kind !== 'analytic') return undefined;
  return scoreForAnswer(question.scaleId, value, question.polarity);
}

export class SurveyService {
  /**
   * Convert a colour answer to its score.
   *
   * Kept because the legacy `2.0` exchange and every round persisted before
   * the research instrument speak these three values, and because a caller
   * holding only a colour has no question to ask about a scale. New code
   * scores through `scoreForQuestionAnswer`, which knows the scale and the
   * polarity of the question being answered.
   */
  public static valueToScore(value: AnswerValue): 100 | 60 | 0 {
    const scale = responseScale.find((s) => s.value === value);
    if (!scale) return 60; // fallback to yellow
    return scale.score as 100 | 60 | 0;
  }

  /**
   * Validate a submission against the exact questions the round asks.
   *
   * The default is the canonical template, which is what a round with no
   * persisted snapshot is still read against.
   */
  public static validateInput(
    input: SurveyResponseInput,
    expectedQuestions: ExpectedQuestion[] = canonicalExpectedQuestions(),
  ): {
    valid: boolean;
    error?: string;
  } {
    if (!input.roundId) {
      return { valid: false, error: 'Round ID is required' };
    }

    if (!input.answers || !Array.isArray(input.answers)) {
      return { valid: false, error: 'Answers array is required' };
    }

    const requiredQuestions = expectedQuestions.filter(
      (question) => question.required !== false,
    );
    if (
      input.answers.length < requiredQuestions.length ||
      input.answers.length > expectedQuestions.length
    ) {
      const requirement =
        requiredQuestions.length === expectedQuestions.length
          ? `${requiredQuestions.length} questions`
          : `${requiredQuestions.length} required questions`;
      return {
        valid: false,
        error: `Survey requires all ${requirement} to be answered. Received ${input.answers.length}.`,
      };
    }

    const expectedById = new Map(
      expectedQuestions.map((question) => [question.id, question]),
    );
    const seenQuestionIds = new Set<string>();

    for (const answer of input.answers) {
      const question = expectedById.get(answer.questionId);
      if (!question || seenQuestionIds.has(answer.questionId)) {
        return {
          valid: false,
          error: `Question '${answer.questionId}' is missing, duplicated, or assigned to the wrong dimension.`,
        };
      }

      // The dimension travels with the answer and is checked against the
      // round's own question rather than trusted, so a client cannot move an
      // answer onto a different stone. A background question has none, and
      // claiming one is the same kind of lie.
      const expectedDimensionId =
        question.kind === 'analytic' ? question.dimensionId : undefined;
      if (expectedDimensionId !== answer.dimensionId) {
        return {
          valid: false,
          error: `Question '${answer.questionId}' is missing, duplicated, or assigned to the wrong dimension.`,
        };
      }

      const valueError = validateAnswerValue(question, answer.value);
      if (valueError) {
        return { valid: false, error: valueError };
      }

      seenQuestionIds.add(answer.questionId);
    }

    const allocationError = validateAllocationTotals(
      expectedQuestions,
      input.answers,
    );
    if (allocationError) {
      return { valid: false, error: allocationError };
    }

    const missingRequiredQuestion = requiredQuestions.find(
      (question) => !seenQuestionIds.has(question.id),
    );
    if (missingRequiredQuestion) {
      return {
        valid: false,
        error: `Required question '${missingRequiredQuestion.id}' is missing.`,
      };
    }

    return { valid: true };
  }

  /**
   * Process and format a valid survey submission into a persistence record
   */
  public static processSubmission(
    input: SurveyResponseInput,
    expectedQuestions: ExpectedQuestion[] = canonicalExpectedQuestions(),
  ): { result: SubmitSurveyResult; record?: SurveyResponseRecord } {
    const validation = this.validateInput(input, expectedQuestions);
    if (!validation.valid) {
      return {
        result: {
          success: false,
          error: validation.error,
          code: 'INVALID_ANSWERS',
        },
      };
    }

    const responseId = crypto.randomUUID();

    const questionById = new Map(
      expectedQuestions.map((question) => [question.id, question]),
    );
    const answerRecords: QuestionAnswerRecord[] = input.answers.map(
      (answer) => {
        const question = questionById.get(answer.questionId)!;
        const score = scoreForQuestionAnswer(question, answer.value);

        return score === undefined ? { ...answer } : { ...answer, score };
      },
    );

    const record: SurveyResponseRecord = {
      id: responseId,
      roundId: input.roundId,
      anonymousTokenHash: input.anonymousTokenHash,
      answers: answerRecords,
      submittedAt: new Date(),
      // Carried through rather than validated here. The route owns the refusal,
      // because this figure arrives from an unauthenticated body and a service
      // that quietly repaired it would leave the route with nothing to refuse.
      visibleSeconds: input.visibleSeconds,
    };

    return {
      result: {
        success: true,
        responseId,
      },
      record,
    };
  }

  /**
   * Submit and persist a survey response using ISurveyRepository with double-submission check
   */
  public static async submitAndSaveResponse(
    input: SurveyResponseInput,
    surveyRepo: ISurveyRepository,
    expectedQuestions: ExpectedQuestion[] = canonicalExpectedQuestions(),
  ): Promise<SubmitSurveyResult> {
    if (!isAttemptTokenHash(input.anonymousTokenHash)) {
      return {
        success: false,
        error: ATTEMPT_TOKEN_REQUIRED_ERROR,
        code: 'ATTEMPT_TOKEN_REQUIRED',
      };
    }

    {
      const alreadySubmitted = await surveyRepo.hasTokenSubmitted(
        input.roundId,
        input.anonymousTokenHash
      );
      if (alreadySubmitted) {
        recordDuplicateSubmissionConflict(input.roundId);
        return {
          success: false,
          error: ALREADY_SUBMITTED_ERROR,
          code: 'ALREADY_SUBMITTED',
        };
      }
    }

    const { result, record } = this.processSubmission(
      input,
      expectedQuestions,
    );
    if (!result.success || !record) {
      return result;
    }

    // The check above loses to a request that ran alongside it: both read
    // "not submitted" before either wrote. The unique index is what actually
    // refuses the second write, and the loser gets the same answer as if it
    // had simply arrived later — not a 500, and no database detail.
    try {
      await surveyRepo.saveResponse(record);
    } catch (error) {
      if (error instanceof DuplicateResponseError) {
        recordDuplicateSubmissionConflict(input.roundId);
        return {
          success: false,
          error: ALREADY_SUBMITTED_ERROR,
          code: 'ALREADY_SUBMITTED',
        };
      }
      throw error;
    }

    return result;
  }
}
