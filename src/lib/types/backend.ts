import { WellbeingDimensionId, WellbeingStatus } from '../shalomut-source';

export type { WellbeingStatus };
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
  // `4.0` and `5.0` keep the dynamic analytics shape, adding context / distributions.
  contractVersion: '3.0' | '4.0' | '5.0';
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

export interface SubmitSurveyResult {
  success: boolean;
  responseId?: string;
  error?: string;
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
