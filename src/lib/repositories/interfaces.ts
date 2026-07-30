import {
  Organization,
  QuestionAnswerRecord,
  RoundStatus,
  SurveyResponseRecord,
  SurveyRound,
  UpdateOrganizationInput,
  UpdateRoundInput,
} from '../types/backend';
import type {
  AiAnalysisRun,
  AiAnalysisRunLease,
  EnqueueAiAnalysisRunResult,
  FinishAiAnalysisRunResult,
} from '../types/ai-analysis-run';

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
   * Drops a persisted legacy AI result. The run repository separately deletes
   * durable jobs when a round is reset.
   */
  clearAiInsights(id: string): Promise<void>;
}

export interface IAiAnalysisRunRepository {
  enqueue(
    roundId: string,
    input: {
      requestKey: string;
      trigger: AiAnalysisRun['trigger'];
    },
  ): Promise<EnqueueAiAnalysisRunResult>;
  claimNext(input: {
    leaseMs: number;
    maxAttempts?: number;
    workerId: string;
  }): Promise<AiAnalysisRunLease | null>;
  heartbeat(
    runId: string,
    leaseToken: string,
    input: { leaseMs: number },
  ): Promise<boolean>;
  finish(
    runId: string,
    input:
      | {
          state: 'succeeded';
          leaseToken: string;
          result: Record<string, unknown>;
          callbackReceivedAt?: Date;
        }
      | {
          state: 'failed';
          leaseToken: string;
          failureCode: string;
          result?: Record<string, unknown>;
          callbackReceivedAt?: Date;
        },
  ): Promise<FinishAiAnalysisRunResult>;
  findById(runId: string): Promise<AiAnalysisRun | null>;
  findLatestByRoundId(roundId: string): Promise<AiAnalysisRun | null>;
  deleteByRoundId(roundId: string): Promise<void>;
}

export interface ISurveyRepository {
  saveResponse(response: SurveyResponseRecord): Promise<SurveyResponseRecord>;
  findResponsesByRoundId(roundId: string): Promise<SurveyResponseRecord[]>;
  hasTokenSubmitted(roundId: string, tokenHash: string): Promise<boolean>;
  getResponseCount(roundId: string): Promise<number>;
  deleteByRoundId(roundId: string): Promise<void>;
}
