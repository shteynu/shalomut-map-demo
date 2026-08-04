import { WellbeingDimensionId, WellbeingStatus } from '../shalomut-source';

export type { WellbeingDimensionId, WellbeingStatus };
export type RoundStatus = 'draft' | 'active' | 'closed' | 'archived';
export type AnswerValue = 'green' | 'yellow' | 'red';

export interface Organization {
  id: string;
  name: string;
  city: string;
  schoolType: string;
  totalStaffCount: number;
  createdAt: Date;
}

export interface RoundBackgroundContext {
  notes: string;
  audience: string;
  sicknessDaysThisQuarter: number;
  newStaffMembers: number;
  studentCount: number;
  socioEconomicIndex: number;
  classesPerGrade: Record<string, number>;
}

export interface SurveyDefinitionQuestion {
  id: string;
  dimensionId: WellbeingDimensionId;
  text: string;
  required: boolean;
  enabled: boolean;
  answerMode: string;
}

export interface SurveyDefinition {
  title: string;
  audience: string;
  estimatedMinutes: number;
  minimumResponses: number;
  introText: string;
  anonymityText: string;
  questions: SurveyDefinitionQuestion[];
}

export interface SurveyRound {
  id: string;
  organizationId: string;
  title: string;
  status: RoundStatus;
  shareCode: string;
  privacyThreshold: number; // MINIMUM_PRIVACY_THRESHOLD (10) or more
  startDate: Date;
  endDate?: Date;
  backgroundContext?: RoundBackgroundContext;
  surveyDefinition?: SurveyDefinition;
  createdAt: Date;
  /**
   * When the round last reached the database, or undefined for a round last
   * written before the column existed. The manager screens report it as their
   * save time, so an absent value must stay absent rather than fall back to
   * `createdAt`, which answers a different question.
   */
  updatedAt?: Date;
}

export interface QuestionAnswerInput {
  questionId: string;
  dimensionId: WellbeingDimensionId;
  value: AnswerValue;
}

export interface QuestionAnswerRecord extends QuestionAnswerInput {
  score: 100 | 60 | 0;
}

export interface SurveyResponseInput {
  roundId: string;
  answers: QuestionAnswerInput[];
  anonymousTokenHash?: string;
}

export interface SurveyResponseRecord {
  id: string;
  roundId: string;
  anonymousTokenHash?: string;
  answers: QuestionAnswerRecord[];
  submittedAt: Date;
}

export interface RoundDimensionScore {
  dimensionId: WellbeingDimensionId;
  averageScore: number;
  computedStatus: WellbeingStatus;
  totalResponses: number;
  isLocked: boolean;
  calculatedAt: Date;
}

export interface QuestionAggregate {
  questionId: string;
  dimensionId: WellbeingDimensionId;
  questionTextHebrew: string;
  averageScore: number;
  responseCount: number;
}

export type SurveyDefinitionHash = `sha256:${string}`;

export interface DynamicQuestionAggregate {
  questionId: string;
  dimensionId: WellbeingDimensionId;
  questionText: string;
  averageScore: number;
  responseCount: number;
  scoreDistribution?: {
    green: number;
    yellow: number;
    red: number;
  };
}

export interface RoundAnalyticsV2Result {
  contractVersion: '2.0';
  roundId: string;
  totalResponses: number;
  privacyThreshold: number;
  isLocked: boolean; // True if totalResponses < privacyThreshold
  dimensionScores: Record<WellbeingDimensionId, RoundDimensionScore>;
  questionAggregates: Record<string, QuestionAggregate>;
  calculatedAt: Date;
}

export interface RoundAnalyticsV3Result {
  // Later contracts keep this Core-owned aggregate shape while changing AI copy.
  contractVersion: '3.0' | '4.0' | '5.0' | '6.0';
  roundId: string;
  organizationId: string;
  surveyDefinitionHash: SurveyDefinitionHash;
  totalResponses: number;
  privacyThreshold: number;
  isLocked: boolean;
  dimensionScores: Record<WellbeingDimensionId, RoundDimensionScore>;
  questionAggregates: Record<string, DynamicQuestionAggregate>;
  calculatedAt: Date;
}

export type RoundAnalyticsResult =
  | RoundAnalyticsV2Result
  | RoundAnalyticsV3Result;

/**
 * Why a submission was refused, as a value the client can branch on.
 *
 * The respondent has to be told "your answer is already saved" differently
 * from "something went wrong, try again", and a restored attempt hits the
 * first case routinely: the server stored the response, the connection died
 * before the `200`, and the retry carries the same token hash. Deciding that
 * by comparing the English `error` text would tie respondent-facing behaviour
 * to server copy, so the reason travels separately from the message.
 *
 * A refusal without a code is an unexpected failure. Clients must treat it as
 * retryable rather than inventing a meaning for it.
 */
export type SurveySubmissionErrorCode =
  | 'ROUND_NOT_FOUND'
  | 'ROUND_NOT_ACTIVE'
  | 'DEFINITION_INVALID'
  | 'INVALID_ANSWERS'
  | 'ALREADY_SUBMITTED';

export interface SubmitSurveyResult {
  success: boolean;
  responseId?: string;
  error?: string;
  code?: SurveySubmissionErrorCode;
}

export interface CreateRoundInput {
  organizationId: string;
  title: string;
  privacyThreshold?: number; // defaults to DEFAULT_PRIVACY_THRESHOLD (10)
  startDate?: Date;
  endDate?: Date;
  backgroundContext?: RoundBackgroundContext;
  surveyDefinition?: SurveyDefinition;
}

export interface UpdateOrganizationInput {
  name?: string;
  city?: string;
  schoolType?: string;
  totalStaffCount?: number;
}

export interface UpdateRoundInput {
  title?: string;
  privacyThreshold?: number;
  startDate?: Date;
  endDate?: Date;
  backgroundContext?: RoundBackgroundContext;
  surveyDefinition?: SurveyDefinition;
}
