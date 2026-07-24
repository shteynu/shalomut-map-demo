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
  privacyThreshold: number; // default 10
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

export interface RoundAnalyticsResult {
  roundId: string;
  totalResponses: number;
  privacyThreshold: number;
  isLocked: boolean; // True if totalResponses < privacyThreshold
  dimensionScores: Record<WellbeingDimensionId, RoundDimensionScore>;
  calculatedAt: Date;
}

export interface SubmitSurveyResult {
  success: boolean;
  responseId?: string;
  error?: string;
}

export interface CreateRoundInput {
  organizationId: string;
  title: string;
  privacyThreshold?: number; // defaults to 10
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
