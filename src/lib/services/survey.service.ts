import { ISurveyRepository } from '../repositories/interfaces';
import { responseScale, surveyInstrument } from '../shalomut-source';
import {
  AnswerValue,
  QuestionAnswerRecord,
  SubmitSurveyResult,
  SurveyResponseInput,
  SurveyResponseRecord,
  SurveyDefinitionQuestion,
} from '../types/backend';

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
      'id' | 'dimensionId'
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

    const requiredQuestionCount = expectedQuestions.length;
    if (input.answers.length !== requiredQuestionCount) {
      return {
        valid: false,
        error: `Survey requires all ${requiredQuestionCount} questions to be answered. Received ${input.answers.length}.`,
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

    return { valid: true };
  }

  /**
   * Process and format a valid survey submission into a persistence record
   */
  public static processSubmission(
    input: SurveyResponseInput,
    expectedQuestions: Pick<
      SurveyDefinitionQuestion,
      'id' | 'dimensionId'
    >[] = surveyInstrument.questions,
  ): { result: SubmitSurveyResult; record?: SurveyResponseRecord } {
    const validation = this.validateInput(input, expectedQuestions);
    if (!validation.valid) {
      return {
        result: {
          success: false,
          error: validation.error,
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
      'id' | 'dimensionId'
    >[] = surveyInstrument.questions,
  ): Promise<SubmitSurveyResult> {
    if (input.anonymousTokenHash) {
      const alreadySubmitted = await surveyRepo.hasTokenSubmitted(
        input.roundId,
        input.anonymousTokenHash
      );
      if (alreadySubmitted) {
        return {
          success: false,
          error: 'You have already submitted a response for this survey round.',
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

    await surveyRepo.saveResponse(record);
    return result;
  }
}
