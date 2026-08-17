import assert from "node:assert";
import test from "node:test";
import {
  InMemorySurveyAttemptRepository,
  InMemorySurveyRepository,
} from "@/lib/repositories";
import { FILLING_DETAIL_MINIMUM } from "@/lib/analytics/filling-duration";
import { RoundFillingService } from "@/lib/services";
import { MINIMUM_PRIVACY_THRESHOLD } from "@/lib/survey-definition";
import type {
  SurveyAttemptRecord,
  SurveyDefinition,
  SurveyDefinitionQuestion,
  SurveyResponseRecord,
  SurveyRound,
} from "@/lib/types/backend";

/**
 * The report exists because a manager asked to see suspiciously filled
 * questionnaires, and it is allowed to describe the collection but never to
 * name the people in it. So these tests pin three things: that a response with
 * no timing is never counted as a fast one, that the round's privacy gate holds
 * before anything is computed, and that a round with no questionnaire of its
 * own is told apart from a round measured against the wrong one.
 */

const ROUND = "round-filling";
const OPENED = new Date("2026-08-17T08:00:00.000Z");

/**
 * Twenty-four colour questions, each its own step at ten seconds — the default
 * template's four minutes, which the tests below take as their estimate.
 */
function questions(): SurveyDefinitionQuestion[] {
  return Array.from({ length: 24 }, (_unused, index) => ({
    id: `q${index + 1}`,
    kind: "analytic" as const,
    text: `שאלה ${index + 1}`,
    required: true,
    enabled: true,
    dimensionId: "balance" as const,
    scaleId: "wellbeing-colour" as const,
    polarity: "positive" as const,
  }));
}

function definition(
  overrides: Partial<SurveyDefinition> = {},
): SurveyDefinition {
  return {
    title: "שאלון",
    audience: "צוות",
    estimatedMinutes: 4,
    minimumResponses: MINIMUM_PRIVACY_THRESHOLD,
    introText: "",
    anonymityText: "",
    questions: questions(),
    ...overrides,
  };
}

function round(
  overrides: Partial<SurveyRound> = {},
): Pick<SurveyRound, "id" | "privacyThreshold" | "surveyDefinition"> {
  return {
    id: ROUND,
    privacyThreshold: MINIMUM_PRIVACY_THRESHOLD,
    surveyDefinition: definition(),
    ...overrides,
  };
}

function token(index: number): string {
  return String(index).padStart(64, "0");
}

function attempt(index: number): SurveyAttemptRecord {
  return {
    id: `attempt-${index}`,
    roundId: ROUND,
    anonymousTokenHash: token(index),
    openedAt: OPENED,
  };
}

function response(
  index: number,
  options: { minutes?: number; withoutToken?: boolean } = {},
): SurveyResponseRecord {
  return {
    id: `response-${index}`,
    roundId: ROUND,
    anonymousTokenHash: options.withoutToken ? undefined : token(index),
    answers: [],
    submittedAt: new Date(OPENED.getTime() + (options.minutes ?? 10) * 60_000),
  };
}

/**
 * One session per duration, each with its attempt row — the ordinary case the
 * report is computed over.
 */
function sessions(minutes: readonly number[]) {
  return {
    attemptRepo: new InMemorySurveyAttemptRepository(
      minutes.map((_unused, index) => attempt(index)),
    ),
    surveyRepo: new InMemorySurveyRepository(
      minutes.map((value, index) => response(index, { minutes: value })),
    ),
  };
}

/** Ten unremarkable sessions, to carry a round over its privacy threshold. */
const ORDINARY = Array.from({ length: 10 }, () => 10);

test("a round with no questionnaire is not measured against the canonical one", async () => {
  const { attemptRepo, surveyRepo } = sessions(ORDINARY);

  const report = await RoundFillingService.getRoundFilling(
    round({ surveyDefinition: undefined }),
    attemptRepo,
    surveyRepo,
  );

  assert.deepStrictEqual(report, { status: "no-questionnaire" });
});

test("a round below its privacy threshold reports nothing about how it was filled", async () => {
  const { attemptRepo, surveyRepo } = sessions([1, 1, 1, 1, 1]);

  const report = await RoundFillingService.getRoundFilling(
    round(),
    attemptRepo,
    surveyRepo,
  );

  assert.deepStrictEqual(report, {
    status: "below-privacy-threshold",
    responses: 5,
    threshold: MINIMUM_PRIVACY_THRESHOLD,
  });
});

test("a raised threshold raises the gate with it", async () => {
  const { attemptRepo, surveyRepo } = sessions(ORDINARY);

  const report = await RoundFillingService.getRoundFilling(
    round({ privacyThreshold: 15 }),
    attemptRepo,
    surveyRepo,
  );

  assert.strictEqual(report.status, "below-privacy-threshold");
});

test("the estimate is computed from the questions the round asks", async () => {
  const { attemptRepo, surveyRepo } = sessions(ORDINARY);

  const report = await RoundFillingService.getRoundFilling(
    round(),
    attemptRepo,
    surveyRepo,
  );

  assert.strictEqual(report.status, "ready");
  if (report.status !== "ready") return;
  assert.strictEqual(report.summary.estimatedMinutes, 4);
});

test("a disabled question does not lengthen the estimate a respondent was shown", async () => {
  const { attemptRepo, surveyRepo } = sessions(ORDINARY);
  const trimmed = questions().map((question, index) => ({
    ...question,
    enabled: index < 12,
  }));

  const report = await RoundFillingService.getRoundFilling(
    round({
      // The stored field still claims the full questionnaire's four minutes;
      // half the questions are switched off, and the respondent was shown two.
      surveyDefinition: definition({ questions: trimmed, estimatedMinutes: 4 }),
    }),
    attemptRepo,
    surveyRepo,
  );

  assert.strictEqual(report.status, "ready");
  if (report.status !== "ready") return;
  assert.strictEqual(report.summary.estimatedMinutes, 2);
});

test("fast sessions are counted against the questionnaire's own estimate", async () => {
  // Four minutes estimated, so far below is under eighty seconds.
  const { attemptRepo, surveyRepo } = sessions([
    0.5, 0.8, 1.2, 5, 6, 7, 8, 9, 10, 11,
  ]);

  const report = await RoundFillingService.getRoundFilling(
    round(),
    attemptRepo,
    surveyRepo,
  );

  assert.strictEqual(report.status, "ready");
  if (report.status !== "ready") return;
  assert.deepStrictEqual(report.summary.durations.farBelowEstimate, {
    known: true,
    count: 3,
  });
  assert.strictEqual(report.summary.durations.measured, 10);
});

test("a round nobody rushed says so rather than saying nothing", async () => {
  const { attemptRepo, surveyRepo } = sessions(ORDINARY);

  const report = await RoundFillingService.getRoundFilling(
    round(),
    attemptRepo,
    surveyRepo,
  );

  assert.strictEqual(report.status, "ready");
  if (report.status !== "ready") return;
  assert.deepStrictEqual(report.summary.durations.farBelowEstimate, {
    known: true,
    count: 0,
  });
});

test("one fast session is bounded rather than counted", async () => {
  const { attemptRepo, surveyRepo } = sessions([
    0.5, 5, 6, 7, 8, 9, 10, 11, 12, 13,
  ]);

  const report = await RoundFillingService.getRoundFilling(
    round(),
    attemptRepo,
    surveyRepo,
  );

  assert.strictEqual(report.status, "ready");
  if (report.status !== "ready") return;
  assert.deepStrictEqual(report.summary.durations.farBelowEstimate, {
    known: false,
    fewerThan: FILLING_DETAIL_MINIMUM,
  });
});

test("a response with no session token is named, not counted as fast", async () => {
  const attemptRepo = new InMemorySurveyAttemptRepository(
    Array.from({ length: 9 }, (_unused, index) => attempt(index)),
  );
  const surveyRepo = new InMemorySurveyRepository([
    ...Array.from({ length: 9 }, (_unused, index) =>
      response(index, { minutes: 10 }),
    ),
    response(99, { withoutToken: true }),
  ]);

  const report = await RoundFillingService.getRoundFilling(
    round(),
    attemptRepo,
    surveyRepo,
  );

  assert.strictEqual(report.status, "ready");
  if (report.status !== "ready") return;
  assert.strictEqual(report.summary.responses, 10);
  assert.strictEqual(report.summary.durations.measured, 9);
  assert.deepStrictEqual(report.summary.unmeasured, {
    withoutToken: 1,
    withoutAttempt: 0,
    unusable: 0,
  });
  assert.deepStrictEqual(report.summary.durations.farBelowEstimate, {
    known: true,
    count: 0,
  });
});

test("a response whose session was never recorded is named separately", async () => {
  // Nine attempts for ten responses: the tenth submitted before the attempts
  // table existed, or its opening beacon was dropped on the way.
  const attemptRepo = new InMemorySurveyAttemptRepository(
    Array.from({ length: 9 }, (_unused, index) => attempt(index)),
  );
  const surveyRepo = new InMemorySurveyRepository(
    Array.from({ length: 10 }, (_unused, index) =>
      response(index, { minutes: 10 }),
    ),
  );

  const report = await RoundFillingService.getRoundFilling(
    round(),
    attemptRepo,
    surveyRepo,
  );

  assert.strictEqual(report.status, "ready");
  if (report.status !== "ready") return;
  assert.deepStrictEqual(report.summary.unmeasured, {
    withoutToken: 0,
    withoutAttempt: 1,
    unusable: 0,
  });
  assert.strictEqual(report.summary.durations.measured, 9);
});

test("a session that ends before it begins is counted, never fed to the median", async () => {
  const attemptRepo = new InMemorySurveyAttemptRepository(
    Array.from({ length: 10 }, (_unused, index) => attempt(index)),
  );
  const surveyRepo = new InMemorySurveyRepository(
    Array.from({ length: 10 }, (_unused, index) =>
      response(index, { minutes: index === 0 ? -5 : 10 }),
    ),
  );

  const report = await RoundFillingService.getRoundFilling(
    round(),
    attemptRepo,
    surveyRepo,
  );

  assert.strictEqual(report.status, "ready");
  if (report.status !== "ready") return;
  assert.deepStrictEqual(report.summary.unmeasured, {
    withoutToken: 0,
    withoutAttempt: 0,
    unusable: 1,
  });
  assert.strictEqual(report.summary.durations.measured, 9);
  assert.deepStrictEqual(report.summary.durations.farBelowEstimate, {
    known: true,
    count: 0,
  });
});

test("the session ends at the response, so a lost completion beacon costs nothing", async () => {
  // Every attempt row here has no `completedAt` at all — the submit route's
  // `markCompleted` never landed. The durations are still measured.
  const { attemptRepo, surveyRepo } = sessions(ORDINARY);
  const attempts = await attemptRepo.findByRoundId(ROUND);

  assert.ok(attempts.every((row) => row.completedAt === undefined));

  const report = await RoundFillingService.getRoundFilling(
    round(),
    attemptRepo,
    surveyRepo,
  );

  assert.strictEqual(report.status, "ready");
  if (report.status !== "ready") return;
  assert.strictEqual(report.summary.durations.measured, 10);
  assert.strictEqual(report.summary.durations.medianMinutes, 10);
});

test("no report names a respondent, a token or one session's length", async () => {
  const { attemptRepo, surveyRepo } = sessions([
    0.5, 0.6, 0.7, 5, 6, 7, 8, 9, 10, 11,
  ]);

  const report = await RoundFillingService.getRoundFilling(
    round(),
    attemptRepo,
    surveyRepo,
  );

  const serialised = JSON.stringify(report);

  assert.ok(!serialised.includes(token(0)), "no session token is published");
  assert.ok(!serialised.includes("response-"), "no response id is published");
  assert.ok(
    !serialised.includes("attempt-"),
    "no attempt id is published either",
  );
});
