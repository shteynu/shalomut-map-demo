import { DuplicateResponseError } from '../repositories/errors';
import { ISurveyRepository } from '../repositories/interfaces';
import { responseScale, surveyInstrument } from '../shalomut-source';
import {
  AnswerValue,
  QuestionAnswerRecord,
  SubmitSurveyResult,
  SurveyResponseInput,
  SurveyResponseRecord,
  SurveyDefinitionQuestion,
  SurveySubmissionErrorCode,
} from '../types/backend';
import { recordDuplicateSubmissionConflict } from '../server/ai-operational-metrics';

/**
 * One answer for both ways a duplicate is found — the pre-check and the unique
 * index — so a respondent cannot tell a race from an ordinary second attempt.
 */
export const ALREADY_SUBMITTED_ERROR =
  'You have already submitted a response for this survey round.';

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
};

export class SurveyService {
  /**
   * Convert categorical answer ('green' | 'yellow' | 'red') to numerical score (100 | 60 | 0)
   */
  public static valueToScore(value: AnswerValue): 100 | 60 | 0 {
    const scale = responseScale.find((s) => s.value === value);
    if (!scale) return 60; // fallback to yellow
    return scale.score as 100 | 60 | 0;
  }

  /**
   * Validate that all 24 questions of the canonical questionnaire are answered
   */
  public static validateInput(
    input: SurveyResponseInput,
    expectedQuestions: Pick<
      SurveyDefinitionQuestion,
      'id' | 'dimensionId' | 'required'
    >[] = surveyInstrument.questions,
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

    const validValues: AnswerValue[] = ['green', 'yellow', 'red'];
    const expectedById = new Map(
      expectedQuestions.map((question) => [question.id, question.dimensionId]),
    );
    const seenQuestionIds = new Set<string>();

    for (const answer of input.answers) {
      if (!validValues.includes(answer.value)) {
        return {
          valid: false,
          error: `Invalid answer value '${answer.value}' for question ${answer.questionId}`,
        };
      }

      const expectedDimensionId = expectedById.get(answer.questionId);
      if (
        !expectedDimensionId ||
        expectedDimensionId !== answer.dimensionId ||
        seenQuestionIds.has(answer.questionId)
      ) {
        return {
          valid: false,
          error: `Question '${answer.questionId}' is missing, duplicated, or assigned to the wrong dimension.`,
        };
      }

      seenQuestionIds.add(answer.questionId);
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
    expectedQuestions: Pick<
      SurveyDefinitionQuestion,
      'id' | 'dimensionId' | 'required'
    >[] = surveyInstrument.questions,
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

    const answerRecords: QuestionAnswerRecord[] = input.answers.map(
      (answer) => ({
        ...answer,
        score: this.valueToScore(answer.value),
      })
    );

    const record: SurveyResponseRecord = {
      id: responseId,
      roundId: input.roundId,
      anonymousTokenHash: input.anonymousTokenHash,
      answers: answerRecords,
      submittedAt: new Date(),
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
    expectedQuestions: Pick<
      SurveyDefinitionQuestion,
      'id' | 'dimensionId' | 'required'
    >[] = surveyInstrument.questions,
  ): Promise<SubmitSurveyResult> {
    if (input.anonymousTokenHash) {
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
