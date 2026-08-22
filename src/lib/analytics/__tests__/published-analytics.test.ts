/**
 * What survives the trip through a JSON column, and what is refused on the way
 * back.
 *
 * A round that has stopped collecting is read far more often than it is
 * calculated, so the stored copy is what most readers actually get. Two rules
 * make that safe: everything the calculation produced comes back unchanged —
 * including the `Date`s, which JSON does not have — and anything that does not
 * decode cleanly comes back as `null`, which costs one recalculation rather
 * than serving a school a payload with holes in it.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  PUBLISHED_ANALYTICS_FORMAT,
  decodePublishedAnalytics,
  encodePublishedAnalytics,
} from '../published-analytics';
import type { CanonicalRoundAnalytics } from '../../types/canonical-analytics';

const ANALYTICS: CanonicalRoundAnalytics = {
  roundId: 'round-1',
  organizationId: 'org-1',
  surveyDefinitionHash: 'definition-hash' as never,
  measurementSnapshotHash: 'measurement-hash' as never,
  totalResponses: 12,
  privacyThreshold: 10,
  isLocked: false,
  dimensionScores: {
    balance: {
      dimensionId: 'balance',
      averageScore: 82,
      computedStatus: 'green',
      totalResponses: 12,
      isLocked: false,
      calculatedAt: new Date('2026-08-02T10:00:00.000Z'),
    },
  } as CanonicalRoundAnalytics['dimensionScores'],
  questionAggregates: {
    'balance-1': {
      questionId: 'balance-1',
      dimensionId: 'balance',
      questionText: 'שאלה',
      averageScore: 82,
      responseCount: 12,
      scoreDistribution: { green: 9, yellow: 2, red: 1 },
    },
  },
  calculatedAt: new Date('2026-08-02T10:00:00.000Z'),
};

/** The column holds JSON, so nothing may survive that JSON cannot carry. */
function throughTheColumn(stored: Record<string, unknown>): unknown {
  return JSON.parse(JSON.stringify(stored));
}

test('everything the calculation produced comes back, dates included', () => {
  const decoded = decodePublishedAnalytics(
    throughTheColumn(encodePublishedAnalytics(ANALYTICS)),
  );

  assert.deepEqual(decoded, ANALYTICS);
  assert.ok(decoded?.calculatedAt instanceof Date);
  assert.ok(decoded?.dimensionScores.balance.calculatedAt instanceof Date);
});

test('the school context is deliberately not stored', () => {
  // It is the round's, not the analysis's, and it stays editable after the
  // round has closed. Two homes for one fact is how a copy goes stale.
  const encoded = encodePublishedAnalytics({
    ...ANALYTICS,
    backgroundContext: {
      notes: 'שנה קשה',
      audience: 'צוות',
      sicknessDaysThisQuarter: 1,
      newStaffMembers: 2,
      studentCount: 3,
      socioEconomicIndex: 4,
      classesPerGrade: { a: 1 },
    },
  });

  assert.equal('backgroundContext' in encoded, false);
  assert.equal(
    decodePublishedAnalytics(throughTheColumn(encoded))?.backgroundContext,
    undefined,
  );
});

test('a blob that does not say what it is, is not read', () => {
  const encoded = encodePublishedAnalytics(ANALYTICS);

  assert.equal(decodePublishedAnalytics(null), null);
  assert.equal(decodePublishedAnalytics('{}'), null);
  assert.equal(decodePublishedAnalytics({ ...encoded, format: undefined }), null);
  assert.equal(
    decodePublishedAnalytics({
      ...encoded,
      format: `${PUBLISHED_ANALYTICS_FORMAT}-next`,
    }),
    null,
  );
});

test('a blob missing any part of the payload is refused whole', () => {
  const encoded = encodePublishedAnalytics(ANALYTICS);

  for (const field of [
    'roundId',
    'organizationId',
    'surveyDefinitionHash',
    'measurementSnapshotHash',
    'totalResponses',
    'privacyThreshold',
    'isLocked',
    'dimensionScores',
    'questionAggregates',
    'calculatedAt',
  ]) {
    const truncated = { ...encoded };
    delete truncated[field];
    assert.equal(
      decodePublishedAnalytics(truncated),
      null,
      `a blob without ${field} was read as analytics`,
    );
  }
});

test('a broken date inside a dimension is not quietly dropped', () => {
  // The alternative — a `null` where a `Date` belongs — would reach a screen
  // as an empty timestamp on numbers that otherwise look fine.
  const encoded = encodePublishedAnalytics(ANALYTICS) as Record<string, any>;
  encoded.dimensionScores.balance.calculatedAt = 'yesterday';

  assert.equal(decodePublishedAnalytics(encoded), null);
});

test('a question aggregate without its distribution is refused', () => {
  const encoded = encodePublishedAnalytics(ANALYTICS) as Record<string, any>;
  delete encoded.questionAggregates['balance-1'].scoreDistribution.red;

  assert.equal(decodePublishedAnalytics(encoded), null);
});
