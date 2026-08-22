import {
  Organization,
  SurveyDefinition,
  SurveyRoundSummary,
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
import type { CanonicalRoundAnalytics } from '../types/canonical-analytics';
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

/**
 * What a status write did — not merely whether it returned a row.
 *
 * `updateStatus` used to answer `SurveyRound | null`, and `null` stood for
 * every failure at once: the round was gone, the partial unique index refused a
 * second active round, a concurrent request had already moved the status, or
 * the connection dropped. Callers could not tell those apart, so they treated
 * `null` as nothing worth reporting and went on writing audit events and
 * dispatching analysis for writes that never happened. That was the fail-open
 * cluster of the 2026-08-21 audit; naming the outcomes is what closes it.
 */
export type RoundStatusWrite =
  | { outcome: 'written'; round: SurveyRound }
  | { outcome: 'not_found' }
  /** Someone else moved the round first; `current` is what it holds now. */
  | { outcome: 'status_changed'; current: RoundStatus }
  /**
   * One school runs one round at a time (owner decision 2026-08-03). The
   * school's running round is named when it can be read, because a manager
   * whose activation was refused needs to know which round refused it.
   */
  | { outcome: 'another_round_is_active'; activeRound: SurveyRound | null }
  | { outcome: 'write_failed'; reason: string };

export interface IRoundRepository {
  create(round: SurveyRound): Promise<SurveyRound>;
  findById(id: string): Promise<SurveyRound | null>;
  findByShareCode(shareCode: string): Promise<SurveyRound | null>;
  findByOrganizationId(organizationId: string): Promise<SurveyRound[]>;
  /**
   * Every round of many schools, without the questionnaires.
   *
   * A list of schools needs each school's rounds to count them and to name the
   * current one; it needs no `surveyDefinition`, and reading one per round is
   * how a screen that shows six fields pulls megabytes. Named ids rather than
   * "all of them" so a paged console asks about its page.
   */
  findSummariesByOrganizationIds(
    organizationIds: readonly string[],
  ): Promise<SurveyRoundSummary[]>;
  update(id: string, input: UpdateRoundInput): Promise<SurveyRound | null>;
  /**
   * Move a round from `expectedCurrent` to `status`, and only from there.
   *
   * The expected status is the `WHERE` of the write rather than a hint, so a
   * transition validated against a read taken moments earlier cannot be applied
   * on top of whatever happened since. Two concurrent requests that both read
   * `active` therefore produce one write and one `status_changed`, instead of
   * two writes of which the second silently wins.
   *
   * Required rather than optional: an omitted expectation is exactly the
   * unconditional write this replaces, and a parameter that may be left out is
   * one that will be.
   */
  updateStatus(
    id: string,
    status: RoundStatus,
    expectedCurrent: RoundStatus,
  ): Promise<RoundStatusWrite>;
  /**
   * The numbers this round published, or `null` if it has not published any
   * that are still readable.
   *
   * On the round repository rather than in a repository of its own — the way
   * `IAiInsightsRepository` owns the other JSON column of the same table —
   * because this one is read on the way to every manager screen. A separate
   * collaborator would have to be passed to `getAnalyticsForRound` by every
   * caller, and a caller that forgets it gets the slow path with no sign that
   * anything is missing. The same argument ADR-032 made about `expectedCurrent`.
   *
   * Nothing here decides whether the stored copy still applies. That is a
   * question about the round's basis of calculation, and `AnalyticsService`
   * is what holds it.
   */
  findPublishedAnalytics(id: string): Promise<CanonicalRoundAnalytics | null>;
  savePublishedAnalytics(
    id: string,
    analytics: CanonicalRoundAnalytics,
  ): Promise<void>;
  /** Used where a round's basis is destroyed rather than changed — a reset. */
  clearPublishedAnalytics(id: string): Promise<void>;
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
  /**
   * How many responses each of these rounds has, counted in one query.
   *
   * A round with no responses is absent from the result rather than present as
   * zero — the caller is reading counts for rounds it already knows about, and
   * `?? 0` is the honest reading of "not in the group".
   */
  countResponsesByRoundIds(
    roundIds: readonly string[],
  ): Promise<Map<string, number>>;
  deleteByRoundId(roundId: string): Promise<void>;
}
