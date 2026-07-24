import {
  Organization,
  QuestionAnswerRecord,
  RoundStatus,
  SurveyResponseRecord,
  SurveyRound,
} from '../types/backend';

export interface IOrganizationRepository {
  create(org: Organization): Promise<Organization>;
  findById(id: string): Promise<Organization | null>;
  findAll(): Promise<Organization[]>;
}

export interface IRoundRepository {
  create(round: SurveyRound): Promise<SurveyRound>;
  findById(id: string): Promise<SurveyRound | null>;
  findByShareCode(shareCode: string): Promise<SurveyRound | null>;
  findByOrganizationId(organizationId: string): Promise<SurveyRound[]>;
  updateStatus(id: string, status: RoundStatus): Promise<SurveyRound | null>;
  saveAiInsights(id: string, insights: Record<string, any>): Promise<boolean>;
  getAiInsights(id: string): Promise<Record<string, any> | null>;
}

export interface ISurveyRepository {
  saveResponse(response: SurveyResponseRecord): Promise<SurveyResponseRecord>;
  findResponsesByRoundId(roundId: string): Promise<SurveyResponseRecord[]>;
  hasTokenSubmitted(roundId: string, tokenHash: string): Promise<boolean>;
  getResponseCount(roundId: string): Promise<number>;
}
