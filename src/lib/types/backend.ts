import { WellbeingDimensionId, WellbeingStatus } from '../shalomut-source';
import type { AnswerPolarity, AnswerScaleId } from '../survey/answer-scales';

export type { WellbeingDimensionId, WellbeingStatus };
export type RoundStatus = 'draft' | 'active' | 'closed' | 'archived';

/**
 * The three values of the colour scale.
 *
 * This used to be the type of every answer in the system. It is now the value
 * set of one scale among several — `wellbeing-colour` — and it survives under
 * its old name because the legacy `2.0` contract and every round persisted
 * before the research instrument speak exactly these three strings.
 */
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

/**
 * Whether a question produces a score for a wellbeing dimension, or describes
 * the respondent instead.
 *
 * Until the research instrument every question was analytic and the field
 * would have been a constant. The instrument asks sixteen background questions
 * — age band, role, tenure, commute — plus two allocation grids, and none of
 * them belongs on a stone. They are not "questions with no dimension yet":
 * scoring them would be a category error, so the kind decides what may be read
 * from the question rather than merely what is filled in.
 */
export type SurveyQuestionKind = 'analytic' | 'background';

/**
 * How a background question is answered. Analytic questions carry a `scaleId`
 * instead, because for them the scale *is* the answer mode.
 *
 * `allocation-100` questions come in groups: each is one row of a grid whose
 * entries must total 100. The grid is not one question with thirteen answers —
 * it is thirteen questions that share a constraint, which keeps one stored
 * answer per question and lets the existing uniqueness key stay as it is.
 */
export type BackgroundAnswerMode = 'single-choice' | 'number' | 'allocation-100';

export interface SurveyQuestionOption {
  value: string;
  label: string;
}

interface SurveyQuestionCommon {
  id: string;
  text: string;
  required: boolean;
  enabled: boolean;
  /**
   * The block a respondent reads this question in. Presentation only: nothing
   * is scored or aggregated by section.
   */
  sectionId?: string;
}

export interface AnalyticSurveyQuestion extends SurveyQuestionCommon {
  kind: 'analytic';
  dimensionId: WellbeingDimensionId;
  scaleId: AnswerScaleId;
  polarity: AnswerPolarity;
}

export interface BackgroundSurveyQuestion extends SurveyQuestionCommon {
  kind: 'background';
  answerMode: BackgroundAnswerMode;
  /** Required for `single-choice`; the labelled values a respondent picks from. */
  options?: SurveyQuestionOption[];
  /** Questions sharing this id are one grid and must total 100. */
  allocationGroupId?: string;
}

/**
 * A union rather than one shape with optional fields, so that reading
 * `dimensionId` off a question the compiler has not narrowed is an error. The
 * alternative — an optional dimension on every question — would have let every
 * existing aggregate keep compiling while silently dropping background answers
 * into whichever dimension `undefined` sorted into.
 */
export type SurveyDefinitionQuestion =
  | AnalyticSurveyQuestion
  | BackgroundSurveyQuestion;

export function isAnalyticQuestion(
  question: SurveyDefinitionQuestion,
): question is AnalyticSurveyQuestion {
  return question.kind === 'analytic';
}

export function isBackgroundQuestion(
  question: SurveyDefinitionQuestion,
): question is BackgroundSurveyQuestion {
  return question.kind === 'background';
}

export interface SurveyDefinition {
  title: string;
  audience: string;
  estimatedMinutes: number;
  minimumResponses: number;
  introText: string;
  anonymityText: string;
  questions: SurveyDefinitionQuestion[];
  /**
   * Which instrument this questionnaire was started from —
   * `surveyInstrument.id` for one built by the canonical factory.
   *
   * Absent means the provenance is unknown, and that is a real answer rather
   * than a gap to fill in: a round that stored a questionnaire before this
   * field existed has no record of what it was built from, and stamping it
   * retroactively would be inventing evidence. A round the manager started from
   * an empty draft has none either, because it came from no instrument at all.
   *
   * One case is not that, and is deliberately allowed to acquire a stamp: a
   * round that never stored a questionnaire at all. Every read path has been
   * serving it the canonical one through the same fallback, so recording that
   * on its first save states what it has in fact been running rather than
   * guessing at its past. Both paths that do this build the fallback from
   * `createCanonicalSurveyDefinition` — the save route and the manager-setup
   * legacy branch.
   *
   * A plain `string`, not a union of the ids the code currently knows: a round
   * may outlive the instrument it was built from, and refusing to parse an
   * unrecognised id would take that round off every manager screen to punish it
   * for a fact about the past. Nothing branches on this value; it is a record.
   *
   * Not editable by a client. The one write path that accepts a definition from
   * the browser carries the stored value forward — see
   * `carryInstrumentProvenance`.
   *
   * A stored value the parser cannot use is read as absent rather than
   * refused. This annotation must never be able to take a round's answer page
   * down, and "unknown" is a state it already holds.
   */
  instrumentId?: string;
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

/**
 * One answer as a respondent sends it.
 *
 * `value` is a string rather than the three colours, because it now carries a
 * Likert step (`"4"`), a chosen option (`"high-school"`) or a number typed into
 * an allocation grid (`"25"`) as well. What a given string is allowed to be is
 * decided by the question's own scale or option set, not by this type — the
 * alternative, a union of every shape any question could take, would let a
 * Likert answer typecheck against a demographic question.
 *
 * `dimensionId` is absent for a background answer and required for an analytic
 * one, mirroring the question it answers.
 */
export interface QuestionAnswerInput {
  questionId: string;
  dimensionId?: WellbeingDimensionId;
  value: string;
}

/**
 * An answer after scoring. `score` is absent exactly when the question was
 * background — those answers are stored and counted, and contribute to no
 * dimension average.
 */
export interface QuestionAnswerRecord extends QuestionAnswerInput {
  score?: number;
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

/**
 * The stages one filling session can report, in the order they can happen.
 *
 * `completed` is deliberately absent from what a client may send: it is written
 * by the submit route from a stored response, so an attempt cannot claim to
 * have finished without answers behind it.
 */
export const SURVEY_ATTEMPT_CLIENT_STAGES = ["opened", "consented", "progress"] as const;
export type SurveyAttemptClientStage =
  (typeof SURVEY_ATTEMPT_CLIENT_STAGES)[number];

export interface SurveyAttemptRecord {
  id: string;
  roundId: string;
  anonymousTokenHash: string;
  openedAt: Date;
  consentAcceptedAt?: Date;
  /**
   * Zero-based index of the furthest question reached.
   *
   * Still a question index, and still a lower bound: it names the first
   * question of the screen the attempt got to. What changed with the research
   * instrument is the resolution, not the meaning — a screen used to hold one
   * question and can now hold a whole block, so an attempt abandoned at the
   * twentieth statement of a block reports the block's first statement. Making
   * it a screen index instead would have rescaled every number already stored,
   * and a round from last month and a round from today would be counted on
   * different scales with nothing on screen to say so.
   */
  lastQuestionReached?: number;
  completedAt?: Date;
}

/**
 * What happened to the people who received the link.
 *
 * Counts of filling sessions, never of people and never of answers: a teacher
 * who opens the link on a phone and again on a laptop is two sessions, and the
 * product cannot tell — which is why every number here is described to the
 * manager as a session rather than as a colleague.
 */
export interface RoundResponseFunnel {
  /** Sessions that loaded the questionnaire at all. */
  opened: number;
  /** Sessions that read the consent screen and accepted it. */
  consented: number;
  /** Sessions that submitted. Counted from responses, not from a client claim. */
  completed: number;
  /** Accepted consent and never submitted. */
  abandoned: number;
  /**
   * Zero-based question index where abandoned sessions stopped, at the median.
   * Undefined when nothing has been abandoned past the consent screen — the
   * honest answer to "where do we lose them" is then "we do not know yet".
   */
  medianAbandonedAtQuestion?: number;
  /**
   * Responses with no session behind them — submitted before this instrument
   * existed, or from a session whose opening beacon never arrived. The screen
   * says so rather than quietly showing a funnel that does not add up.
   */
  completedWithoutAttempt: number;
  lastOpenedAt?: Date;
  lastCompletedAt?: Date;
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
