import {
  Organization,
  QuestionAnswerRecord,
  RoundStatus,
  SurveyResponseRecord,
  SurveyRound,
  UpdateOrganizationInput,
  UpdateRoundInput,
} from '../types/backend';

export interface IOrganizationRepository {
  create(org: Organization): Promise<Organization>;
  findById(id: string): Promise<Organization | null>;
  findAll(): Promise<Organization[]>;
  update(id: string, input: UpdateOrganizationInput): Promise<Organization | null>;
}

export interface IRoundRepository {
  create(round: SurveyRound): Promise<SurveyRound>;
  findById(id: string): Promise<SurveyRound | null>;
  findByShareCode(shareCode: string): Promise<SurveyRound | null>;
  findByOrganizationId(organizationId: string): Promise<SurveyRound[]>;
  update(id: string, input: UpdateRoundInput): Promise<SurveyRound | null>;
  updateStatus(id: string, status: RoundStatus): Promise<SurveyRound | null>;
  saveAiInsights(id: string, insights: Record<string, any>): Promise<boolean>;
  getAiInsights(id: string): Promise<Record<string, any> | null>;
  /**
   * Atomically claims the right to dispatch one AI analytics run for a round.
   *
   * Returns `true` only for the caller that won the claim, so concurrent
   * respondent submissions cannot fan out into several provider webhooks.
   * The claim is a lease: it expires after `leaseMs` so a failed dispatch does
   * not block the round forever. With `requireNoInsights` the claim is refused
   * once a result has been persisted, which is what the automatic path wants;
   * the manual manager rerun passes `false`.
   */
  claimAiAnalysisRun(
    id: string,
    options?: { leaseMs?: number; requireNoInsights?: boolean },
  ): Promise<boolean>;
  /**
   * Releases a claim whose dispatch failed, so the round can be retried right
   * away instead of waiting out the lease. A round that already has a persisted
   * result is left untouched: there the timestamp belongs to the result.
   */
  releaseAiAnalysisClaim(id: string): Promise<void>;
  /**
   * Drops a persisted AI result and any dispatch claim. Used when a round is
   * reset: an analysis of deleted responses must not stay on the dashboard.
   */
  clearAiInsights(id: string): Promise<void>;
}

export interface ISurveyRepository {
  saveResponse(response: SurveyResponseRecord): Promise<SurveyResponseRecord>;
  findResponsesByRoundId(roundId: string): Promise<SurveyResponseRecord[]>;
  hasTokenSubmitted(roundId: string, tokenHash: string): Promise<boolean>;
  getResponseCount(roundId: string): Promise<number>;
  deleteByRoundId(roundId: string): Promise<void>;
}
