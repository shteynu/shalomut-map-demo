import assert from 'node:assert/strict';
import test from 'node:test';
import {
  encodeAnalyticsInput,
  encodeRoundAnalytics,
} from '../analytics-encoder';
import type { WellbeingDimensionId } from '../shalomut-source';
import type { RoundDimensionScore } from '../types/backend';
import type { CanonicalRoundAnalytics } from '../types/canonical-analytics';

const CALCULATED_AT = new Date('2026-08-02T09:00:00.000Z');

function canonical(
  overrides: Partial<CanonicalRoundAnalytics> = {},
): CanonicalRoundAnalytics {
  return {
    roundId: 'round_encoder_1',
    organizationId: 'org_encoder_1',
    surveyDefinitionHash: `sha256:${'a'.repeat(64)}`,
    totalResponses: 10,
    privacyThreshold: 10,
    isLocked: false,
    dimensionScores: {} as Record<WellbeingDimensionId, RoundDimensionScore>,
    questionAggregates: {
      'q-1': {
        questionId: 'q-1',
        dimensionId: 'self-expression',
        questionText: 'שאלה ראשונה',
        averageScore: 80,
        responseCount: 10,
        scoreDistribution: { green: 5, yellow: 3, red: 2 },
      },
    },
    backgroundContext: {
      notes: 'הערות',
      audience: 'all-staff',
      sicknessDaysThisQuarter: 3,
      newStaffMembers: 1,
      studentCount: 400,
      socioEconomicIndex: 5,
      classesPerGrade: { '7': 4 },
    },
    calculatedAt: CALCULATED_AT,
    ...overrides,
  };
}

test('a version without distributions drops them and keeps every other number', () => {
  const source = canonical();

  const withDistribution = encodeRoundAnalytics(source, '5.0');
  const withoutDistribution = encodeRoundAnalytics(source, '3.0');

  assert.deepEqual(withDistribution.questionAggregates['q-1'].scoreDistribution, {
    green: 5,
    yellow: 3,
    red: 2,
  });
  assert.equal(
    withoutDistribution.questionAggregates['q-1'].scoreDistribution,
    undefined,
  );
  assert.equal(withoutDistribution.questionAggregates['q-1'].averageScore, 80);
  assert.equal(withoutDistribution.questionAggregates['q-1'].responseCount, 10);
});

test('the encoded distribution cannot be edited through the canonical analytics', () => {
  const source = canonical();
  const encoded = encodeRoundAnalytics(source, '5.0');

  encoded.questionAggregates['q-1'].scoreDistribution!.green = 99;

  assert.equal(source.questionAggregates['q-1'].scoreDistribution.green, 5);
});

test('the school background context crosses only on a version that carries it', () => {
  const source = canonical();

  assert.ok(encodeAnalyticsInput(source, '4.0').backgroundContext);
  assert.equal(encodeAnalyticsInput(source, '3.0').backgroundContext, undefined);
});

test('a locked round never carries the school background context', () => {
  const locked = canonical({ isLocked: true, questionAggregates: {} });

  const payload = encodeAnalyticsInput(locked, '4.0');

  assert.equal(payload.backgroundContext, undefined);
  assert.equal(payload.isLocked, true);
});

test('the analytics input carries the timestamp as a string', () => {
  const payload = encodeAnalyticsInput(canonical(), '5.0');

  assert.equal(payload.calculatedAt, CALCULATED_AT.toISOString());
});
