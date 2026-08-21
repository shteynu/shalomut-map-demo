/**
 * A round publishes its numbers on exactly one basis (ADR-030).
 *
 * ADR-022 settled that rule against a manager choosing a second basis by
 * excluding responses, and measured what a second basis costs: two publications
 * differing by one respondent move exactly one bucket by exactly one on every
 * question, which is that person's answer sheet read directly rather than
 * estimated. What it did not close is the axis this file is about. Nobody has
 * to choose anything to get a second basis out of a round that recomputes on
 * every read — they only have to read it twice, either side of one submission.
 *
 * The last test here is the one that keeps the others honest: it shows the
 * subtraction actually working on a closed round, so the assertions above it
 * are refusing to publish something that really is a leak, rather than
 * asserting the absence of numbers that were never interesting.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { AnalyticsService } from '../../services/analytics.service';
import { encodeAnalyticsInput } from '../../analytics-encoder';
import { surveyInstrument } from '../../shalomut-source';
import {
  MINIMUM_PRIVACY_THRESHOLD,
  createCanonicalSurveyDefinition,
} from '../../survey-definition';
import type {
  AnswerValue,
  RoundStatus,
  SurveyResponseRecord,
  SurveyRound,
} from '../../types/backend';

const ROUND_ID = 'round_one_basis';

function roundWith(status: RoundStatus): SurveyRound {
  return {
    id: ROUND_ID,
    organizationId: 'org_one_basis',
    title: 'סבב בדיקת בסיס',
    status,
    shareCode: 'SHALOM-BASIS',
    privacyThreshold: MINIMUM_PRIVACY_THRESHOLD,
    startDate: new Date('2026-08-01T00:00:00.000Z'),
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    surveyDefinition: createCanonicalSurveyDefinition(
      'סבב בדיקת בסיס',
      MINIMUM_PRIVACY_THRESHOLD,
    ),
  };
}

/**
 * `count` respondents who all answered green, and — when `withOneRed` is set —
 * one final respondent who answered red to every question.
 *
 * The last respondent is deliberately the only one of their kind, because that
 * is what makes the subtraction legible: every bucket they move, they move
 * alone.
 */
function responses(
  count: number,
  withOneRed = false,
): SurveyResponseRecord[] {
  const rows = Array.from({ length: count }, (_, index) => row(index, 'green'));
  return withOneRed ? [...rows, row(count, 'red')] : rows;
}

function row(index: number, value: AnswerValue): SurveyResponseRecord {
  return {
    id: `${ROUND_ID}_response_${index}`,
    roundId: ROUND_ID,
    submittedAt: new Date('2026-08-02T00:00:00.000Z'),
    answers: surveyInstrument.questions.map((question) => ({
      questionId: question.id,
      dimensionId: question.dimensionId,
      value,
      score: value === 'green' ? 100 : value === 'yellow' ? 60 : 0,
    })),
  };
}

test('a round still collecting publishes no numbers, however many answers it holds', () => {
  const analytics = AnalyticsService.calculateDynamicRoundAnalytics(
    roundWith('active'),
    responses(MINIMUM_PRIVACY_THRESHOLD + 7),
  );

  // Past the threshold on every question, and withheld anyway. Before ADR-030
  // this round published its full per-question distributions on every read.
  assert.equal(analytics.totalResponses, MINIMUM_PRIVACY_THRESHOLD + 7);
  assert.equal(analytics.isLocked, true);
  assert.equal(analytics.lockReason, 'still-collecting');
  assert.deepEqual(analytics.dimensionScores, {});
  assert.deepEqual(analytics.questionAggregates, {});
});

test('a draft round is withheld for the same reason as an active one', () => {
  const analytics = AnalyticsService.calculateDynamicRoundAnalytics(
    roundWith('draft'),
    responses(MINIMUM_PRIVACY_THRESHOLD + 2),
  );

  assert.equal(analytics.isLocked, true);
  assert.equal(analytics.lockReason, 'still-collecting');
});

test('two reads either side of one submission give an open round nothing to subtract', () => {
  // The attack, run against the product as it stands: read, wait for one
  // teacher to press send, read again, subtract.
  const before = AnalyticsService.calculateDynamicRoundAnalytics(
    roundWith('active'),
    responses(MINIMUM_PRIVACY_THRESHOLD + 2),
  );
  const after = AnalyticsService.calculateDynamicRoundAnalytics(
    roundWith('active'),
    responses(MINIMUM_PRIVACY_THRESHOLD + 2, true),
  );

  // The count is allowed to move — it is one number about the round, and the
  // manager needs it to chase responses. Everything a person could be read out
  // of stays empty on both sides, so there is no pair of figures to difference.
  assert.equal(after.totalResponses, before.totalResponses + 1);
  assert.deepEqual(before.questionAggregates, {});
  assert.deepEqual(after.questionAggregates, {});
  assert.deepEqual(before.dimensionScores, {});
  assert.deepEqual(after.dimensionScores, {});
});

test('closing the round is what publishes it, and archiving keeps it published', () => {
  const collected = responses(MINIMUM_PRIVACY_THRESHOLD + 2);

  const closed = AnalyticsService.calculateDynamicRoundAnalytics(
    roundWith('closed'),
    collected,
  );
  assert.equal(closed.isLocked, false);
  assert.equal(closed.lockReason, null);
  assert.equal(
    Object.keys(closed.questionAggregates).length,
    surveyInstrument.questions.length,
  );

  // Archiving takes a round out of the list and changes nothing else
  // (ADR-018). It also must not withhold: the AI callback verifier recomputes
  // the round it is checking, and a verifier that read an archived round as
  // locked would reject Core's own correct analysis.
  const archived = AnalyticsService.calculateDynamicRoundAnalytics(
    roundWith('archived'),
    collected,
  );
  assert.equal(archived.isLocked, false);
  // The scores themselves, not the whole records: each carries its own
  // `calculatedAt`, and the two calls happen a millisecond apart.
  for (const dimension of surveyInstrument.dimensions) {
    assert.equal(
      archived.dimensionScores[dimension.id].averageScore,
      closed.dimensionScores[dimension.id].averageScore,
    );
  }
});

test('nothing about an open round crosses the boundary to the AI service', () => {
  const payload = encodeAnalyticsInput(
    AnalyticsService.calculateDynamicRoundAnalytics(
      roundWith('active'),
      responses(MINIMUM_PRIVACY_THRESHOLD + 5),
    ),
  );

  assert.equal(payload.isLocked, true);
  assert.deepEqual(payload.questionAggregates, {});
  assert.deepEqual(payload.dimensionScores, {});
  // The school's own context is withheld with the numbers, exactly as it is
  // for a round under the threshold: a round nobody may read is a round the
  // provider is not called about.
  assert.equal(payload.backgroundContext, undefined);
});

test('the withheld numbers are the leak: on a closed round the same two bases name one respondent', () => {
  // Nothing here is a claim about current behaviour — it is the demonstration
  // that the assertions above are withholding something worth withholding. Two
  // publication bases one respondent apart, on a round that is allowed to
  // publish, and the difference is that respondent's answer sheet.
  const smaller = AnalyticsService.calculateDynamicRoundAnalytics(
    roundWith('closed'),
    responses(MINIMUM_PRIVACY_THRESHOLD + 2),
  );
  const larger = AnalyticsService.calculateDynamicRoundAnalytics(
    roundWith('closed'),
    responses(MINIMUM_PRIVACY_THRESHOLD + 2, true),
  );

  for (const question of surveyInstrument.questions) {
    const before = smaller.questionAggregates[question.id].scoreDistribution;
    const after = larger.questionAggregates[question.id].scoreDistribution;

    // One bucket, by one, on every single question — which is a direct read of
    // what that person answered, not an estimate of it.
    assert.equal(after.red - before.red, 1);
    assert.equal(after.green - before.green, 0);
    assert.equal(after.yellow - before.yellow, 0);
  }
});
