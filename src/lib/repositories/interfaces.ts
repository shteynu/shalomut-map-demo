import {
  Organization,
  SurveyDefinition,
  QuestionAnswerRecord,
  RoundStatus,
  SurveyAttemptClientStage,
  SurveyAttemptRecord,
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
import type { SurveyDefinitionVersion } from '../types/survey-definition-version';
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
      /** Omitted or empty means the whole round. */
      regenerateDimensionIds?: readonly string[];
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
   * The most recent result this round actually has, whatever has happened
   * since. Deliberately not `findLatestByRoundId().result`: the run being
   * claimed is the latest one and has no result yet, and a partial re-run
   * needs the map it is amending, not the empty row that is amending it.
   */
  findLatestResultByRoundId(
    roundId: string,
  ): Promise<Record<string, unknown> | null>;
  /**
   * Every run the round has had, oldest first. The dispatch policy needs the
   * history rather than the latest row: the request key of the run a closing
   * is about to queue counts the closings before it, so that two requests
   * racing on one close compute the same key and collapse on the unique
   * constraint. The newest run cannot answer that on its own.
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
  /**
   * Every goal of the named rounds, for the one screen that reads a school's
   * work rather than one round's.
   *
   * It takes round ids rather than an organization id on purpose: the caller
   * has already resolved which rounds belong to the manager's school, and this
   * keeps the rule above — a goal is never reachable without naming its round.
   */
  findByRoundIds(roundIds: string[]): Promise<RoundGoal[]>;
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

/**
 * How many versions of one round's questionnaire are kept.
 *
 * Twenty is a working session's worth of saves, which is the span a manager can
 * still recognise entries in. The limit exists because the history is a safety
 * net rather than an archive: an unbounded log of a document that is rewritten
 * on every save grows without anyone ever reading the far end of it.
 */
export const DEFINITION_VERSION_RETENTION = 20;

/**
 * The questionnaire's history for one round. Round-scoped throughout, for the
 * same reason the goal repository is: authorization happens per round, so a
 * version reachable by id alone would cross a school boundary the route
 * already checked.
 */
export interface ISurveyDefinitionVersionRepository {
  /**
   * Write one version. The caller decides whether the definition changed —
   * a repository that silently skipped an unchanged save would hide a defect
   * in the caller rather than fix one.
   */
  record(
    roundId: string,
    definition: SurveyDefinition,
    savedAt?: Date,
  ): Promise<SurveyDefinitionVersion>;
  /** Newest first. The first entry is the questionnaire as it stands now. */
  findByRoundId(roundId: string): Promise<SurveyDefinitionVersion[]>;
  findById(
    roundId: string,
    versionId: string,
  ): Promise<SurveyDefinitionVersion | null>;
}

/*
 * There is no delete here. A round's history dies with the round, through the
 * migration's cascade, and round reset deliberately keeps it: reset returns the
 * round to draft for re-editing, which is exactly when a manager is most likely
 * to want the questionnaire they had an hour ago.
 */

/**
 * Filling sessions, including the ones that never became a response.
 *
 * Round-scoped like the goal and version repositories: authorization happens
 * per round, and a row reachable by token hash alone would cross a school
 * boundary the caller already checked.
 */
export interface ISurveyAttemptRepository {
  /**
   * Record progress for one filling session, creating the row on first sight.
   *
   * Monotonic by contract: a stage that arrives out of order — a reload
   * reporting `opened` after the session already consented, a stale beacon
   * carrying an earlier question index — must never move a row backwards. The
   * respondent client is unauthenticated and fires these without waiting for a
   * reply, so out-of-order delivery is the normal case rather than the odd one.
   */
  record(input: {
    roundId: string;
    anonymousTokenHash: string;
    stage: SurveyAttemptClientStage;
    lastQuestionReached?: number;
    at?: Date;
  }): Promise<SurveyAttemptRecord>;
  /**
   * Mark a session finished. Called by the submit route from a stored response,
   * never by the respondent's client. Returns null when no attempt row exists —
   * a submission from a session that opened before this table did, which is
   * counted from the responses rather than invented here.
   */
  markCompleted(
    roundId: string,
    anonymousTokenHash: string,
    at?: Date,
  ): Promise<SurveyAttemptRecord | null>;
  findByRoundId(roundId: string): Promise<SurveyAttemptRecord[]>;
  deleteByRoundId(roundId: string): Promise<void>;
}

export interface ISurveyRepository {
  saveResponse(response: SurveyResponseRecord): Promise<SurveyResponseRecord>;
  findResponsesByRoundId(roundId: string): Promise<SurveyResponseRecord[]>;
  hasTokenSubmitted(roundId: string, tokenHash: string): Promise<boolean>;
  getResponseCount(roundId: string): Promise<number>;
  deleteByRoundId(roundId: string): Promise<void>;
}
