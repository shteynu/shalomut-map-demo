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
import type {
  CreateRoundGoalInput,
  CreateRoundGoalResult,
  RoundGoal,
  RoundGoalStatus,
} from '../types/round-goal';

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
}

/**
 * The persisted AI result of a round, kept apart from the round itself the way
 * `IAiAnalysisRunRepository` keeps the durable job. The result still lives in
 * the `survey_rounds` columns; only ownership of the read and write moved.
 */
export interface IAiInsightsRepository {
  /**
   * Returns `false` when the round does not exist, which is what turns a
   * callback for an unknown round into a 404 instead of a silent write.
   */
  save(roundId: string, insights: Record<string, any>): Promise<boolean>;
  findByRoundId(roundId: string): Promise<Record<string, any> | null>;
  /**
   * Drops a persisted legacy AI result. The run repository separately deletes
   * durable jobs when a round is reset.
   */
  deleteByRoundId(roundId: string): Promise<void>;
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
  /**
   * Every run the round has had, oldest first. The automatic enqueue policy
   * needs the history rather than the latest row: whether a run already
   * succeeded, whether one is in flight and how many automatic attempts have
   * been spent are three different questions, and the newest run answers none
   * of them on its own.
   */
  findByRoundId(roundId: string): Promise<AiAnalysisRun[]>;
  deleteByRoundId(roundId: string): Promise<void>;
}

/**
 * The goals a round carries. Every method is round-scoped, including the ones
 * that already hold a goal id: authorization happens per round, so a repository
 * that could reach a goal without naming its round would let a guessed id cross
 * a school boundary the route already checked.
 */
export interface IRoundGoalRepository {
  create(
    roundId: string,
    input: CreateRoundGoalInput,
  ): Promise<CreateRoundGoalResult>;
  findByRoundId(roundId: string): Promise<RoundGoal[]>;
  updateStatus(
    roundId: string,
    goalId: string,
    status: RoundGoalStatus,
  ): Promise<RoundGoal | null>;
  /** `false` when the round holds no such goal, which is a 404 and not a retry. */
  delete(roundId: string, goalId: string): Promise<boolean>;
  /** Returns how many were removed, which the reset audit entry records. */
  deleteByRoundId(roundId: string): Promise<number>;
}

export interface ISurveyRepository {
  saveResponse(response: SurveyResponseRecord): Promise<SurveyResponseRecord>;
  findResponsesByRoundId(roundId: string): Promise<SurveyResponseRecord[]>;
  hasTokenSubmitted(roundId: string, tokenHash: string): Promise<boolean>;
  getResponseCount(roundId: string): Promise<number>;
  deleteByRoundId(roundId: string): Promise<void>;
}
