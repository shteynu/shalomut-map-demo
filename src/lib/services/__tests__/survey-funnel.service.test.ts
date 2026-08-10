import assert from "node:assert";
import test from "node:test";
import {
  InMemorySurveyAttemptRepository,
  InMemorySurveyRepository,
} from "@/lib/repositories";
import { ABANDON_DETAIL_MINIMUM, SurveyFunnelService } from "@/lib/services";
import { surveyInstrument } from "@/lib/shalomut-source";
import type { SurveyResponseRecord } from "@/lib/types/backend";

/**
 * Response rate is the number that decides whether a school ever sees anything
 * at all, and until this service existed the product could not tell a teacher
 * who never received the link from one who opened it and left.
 *
 * The rules worth pinning are the ones that make the number honest: the funnel
 * never runs backwards under out-of-order beacons, completions are counted from
 * responses rather than from a client's claim, and the one detail that could
 * describe an individual is suppressed until it describes a pattern.
 */

const ROUND = "round-funnel";

function repositories(responses: SurveyResponseRecord[] = []) {
  return {
    attemptRepo: new InMemorySurveyAttemptRepository(),
    surveyRepo: new InMemorySurveyRepository(responses),
  };
}

function response(id: string, anonymousTokenHash?: string): SurveyResponseRecord {
  return {
    id,
    roundId: ROUND,
    anonymousTokenHash,
    answers: surveyInstrument.questions.slice(0, 1).map((question) => ({
      questionId: question.id,
      dimensionId: question.dimensionId,
      value: "green" as const,
      score: 100 as const,
    })),
    submittedAt: new Date(),
  };
}

test("an opened session that never consents is counted, and is not a response", async () => {
  const { attemptRepo, surveyRepo } = repositories();

  await SurveyFunnelService.record(
    { roundId: ROUND, anonymousTokenHash: "a".repeat(64), stage: "opened" },
    attemptRepo,
  );

  const funnel = await SurveyFunnelService.getRoundFunnel(
    ROUND,
    attemptRepo,
    surveyRepo,
  );

  assert.strictEqual(funnel.opened, 1);
  assert.strictEqual(funnel.consented, 0);
  assert.strictEqual(funnel.completed, 0);
  assert.strictEqual(funnel.abandoned, 0);
});

test("one session reloading twice is one opening, not three teachers", async () => {
  const { attemptRepo, surveyRepo } = repositories();
  const hash = "b".repeat(64);

  for (let i = 0; i < 3; i += 1) {
    await SurveyFunnelService.record(
      { roundId: ROUND, anonymousTokenHash: hash, stage: "opened" },
      attemptRepo,
    );
  }

  const funnel = await SurveyFunnelService.getRoundFunnel(
    ROUND,
    attemptRepo,
    surveyRepo,
  );
  assert.strictEqual(funnel.opened, 1);
});

test("a late 'opened' beacon does not un-consent a session", async () => {
  const { attemptRepo, surveyRepo } = repositories();
  const hash = "c".repeat(64);

  await SurveyFunnelService.record(
    { roundId: ROUND, anonymousTokenHash: hash, stage: "consented" },
    attemptRepo,
  );
  // The reload's beacon arrives after the consent's, which is ordinary: the
  // client fires these without waiting for a reply.
  await SurveyFunnelService.record(
    { roundId: ROUND, anonymousTokenHash: hash, stage: "opened" },
    attemptRepo,
  );

  const funnel = await SurveyFunnelService.getRoundFunnel(
    ROUND,
    attemptRepo,
    surveyRepo,
  );
  assert.strictEqual(funnel.consented, 1);
});

test("a stale progress beacon does not walk the respondent backwards", async () => {
  const { attemptRepo } = repositories();
  const hash = "d".repeat(64);

  await SurveyFunnelService.record(
    {
      roundId: ROUND,
      anonymousTokenHash: hash,
      stage: "progress",
      lastQuestionReached: 7,
    },
    attemptRepo,
  );
  await SurveyFunnelService.record(
    {
      roundId: ROUND,
      anonymousTokenHash: hash,
      stage: "progress",
      lastQuestionReached: 3,
    },
    attemptRepo,
  );

  const [attempt] = await attemptRepo.findByRoundId(ROUND);
  assert.strictEqual(attempt.lastQuestionReached, 7);
});

test("completions are counted from responses, not from a client's claim", async () => {
  // A round that collected answers before this table existed has responses with
  // no session behind them. Counting attempts would show the school fewer
  // submissions than it has.
  const { attemptRepo, surveyRepo } = repositories([
    response("r1"),
    response("r2"),
  ]);

  const funnel = await SurveyFunnelService.getRoundFunnel(
    ROUND,
    attemptRepo,
    surveyRepo,
  );

  assert.strictEqual(funnel.completed, 2);
  assert.strictEqual(funnel.completedWithoutAttempt, 2);
  assert.strictEqual(funnel.opened, 0);
});

test("a submitted session leaves the abandoned count alone", async () => {
  const hash = "e".repeat(64);
  const { attemptRepo, surveyRepo } = repositories([response("r1", hash)]);

  await SurveyFunnelService.record(
    { roundId: ROUND, anonymousTokenHash: hash, stage: "consented" },
    attemptRepo,
  );
  await attemptRepo.markCompleted(ROUND, hash);

  const funnel = await SurveyFunnelService.getRoundFunnel(
    ROUND,
    attemptRepo,
    surveyRepo,
  );

  assert.strictEqual(funnel.consented, 1);
  assert.strictEqual(funnel.completed, 1);
  assert.strictEqual(funnel.abandoned, 0);
  assert.strictEqual(funnel.completedWithoutAttempt, 0);
});

test("where people stop is withheld until it describes more than one of them", async () => {
  const { attemptRepo, surveyRepo } = repositories();

  for (let i = 0; i < ABANDON_DETAIL_MINIMUM - 1; i += 1) {
    const hash = String(i).repeat(64).slice(0, 64);
    await SurveyFunnelService.record(
      {
        roundId: ROUND,
        anonymousTokenHash: hash,
        stage: "progress",
        lastQuestionReached: 4,
      },
      attemptRepo,
    );
  }

  const withheld = await SurveyFunnelService.getRoundFunnel(
    ROUND,
    attemptRepo,
    surveyRepo,
  );
  assert.strictEqual(withheld.abandoned, ABANDON_DETAIL_MINIMUM - 1);
  assert.strictEqual(withheld.medianAbandonedAtQuestion, undefined);

  await SurveyFunnelService.record(
    {
      roundId: ROUND,
      anonymousTokenHash: "f".repeat(64),
      stage: "progress",
      lastQuestionReached: 10,
    },
    attemptRepo,
  );

  const shown = await SurveyFunnelService.getRoundFunnel(
    ROUND,
    attemptRepo,
    surveyRepo,
  );
  assert.strictEqual(shown.abandoned, ABANDON_DETAIL_MINIMUM);
  // Indices 4, 4, 10 — the median is the middle one.
  assert.strictEqual(shown.medianAbandonedAtQuestion, 4);
});

test("the endpoint's guards refuse what would corrupt the median", () => {
  assert.ok(SurveyFunnelService.isClientStage("opened"));
  assert.ok(SurveyFunnelService.isClientStage("consented"));
  assert.ok(SurveyFunnelService.isClientStage("progress"));
  // `completed` is written by the submit route from a stored response. A client
  // that could claim it could report a completion with no answers behind it.
  assert.ok(!SurveyFunnelService.isClientStage("completed"));
  assert.ok(!SurveyFunnelService.isClientStage("finished"));

  assert.ok(SurveyFunnelService.isQuestionIndex(0));
  assert.ok(!SurveyFunnelService.isQuestionIndex(-1));
  assert.ok(!SurveyFunnelService.isQuestionIndex(2.5));
  assert.ok(!SurveyFunnelService.isQuestionIndex("3"));
  assert.ok(!SurveyFunnelService.isQuestionIndex(Number.MAX_SAFE_INTEGER));
});
