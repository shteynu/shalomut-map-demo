import assert from "node:assert";
import { test } from "node:test";
import {
  comparableRoundsBefore,
  deltaDirection,
  describeDelta,
  formatDelta,
  toRoundComparison,
} from "@/lib/dashboard/round-comparison";
import { surveyInstrument } from "@/lib/shalomut-source";
import type { RoundDimensionScore, SurveyRound } from "@/lib/types/backend";
import type { CanonicalRoundAnalytics } from "@/lib/types/canonical-analytics";

function round(
  id: string,
  status: SurveyRound["status"],
  startDate: string,
): SurveyRound {
  return {
    id,
    organizationId: "org-1",
    title: id,
    status,
    shareCode: `SHALOM-${id.toUpperCase()}`,
    privacyThreshold: 10,
    startDate: new Date(startDate),
    createdAt: new Date(startDate),
  };
}

function analytics(
  roundId: string,
  score: number,
  overrides: Partial<CanonicalRoundAnalytics> = {},
): CanonicalRoundAnalytics {
  const dimensionScores = surveyInstrument.dimensions.reduce(
    (scores, dimension) => {
      const dimensionScore: RoundDimensionScore = {
        dimensionId: dimension.id,
        averageScore: score,
        computedStatus: "green",
        totalResponses: 12,
        isLocked: false,
        calculatedAt: new Date("2026-08-01T00:00:00.000Z"),
      };
      scores[dimension.id] = dimensionScore;
      return scores;
    },
    {} as CanonicalRoundAnalytics["dimensionScores"],
  );

  return {
    roundId,
    organizationId: "org-1",
    surveyDefinitionHash: "hash",
    totalResponses: 12,
    privacyThreshold: 10,
    isLocked: false,
    dimensionScores,
    questionAggregates: {},
    calculatedAt: new Date("2026-08-01T00:00:00.000Z"),
    ...overrides,
  } as CanonicalRoundAnalytics;
}

test("earlier rounds are offered nearest first", () => {
  const rounds = [
    round("spring", "closed", "2026-02-01"),
    round("autumn", "closed", "2025-09-01"),
    round("winter", "active", "2026-07-01"),
  ];

  assert.deepStrictEqual(
    comparableRoundsBefore(rounds[2], rounds).map((entry) => entry.id),
    ["spring", "autumn"],
  );
});

test("a draft is not a measurement and is never a candidate", () => {
  const rounds = [
    round("prepared-early", "draft", "2026-06-01"),
    round("spring", "closed", "2026-02-01"),
    round("winter", "active", "2026-07-01"),
  ];

  assert.deepStrictEqual(
    comparableRoundsBefore(rounds[2], rounds).map((entry) => entry.id),
    ["spring"],
  );
});

test("the school's first round has nothing to compare against", () => {
  const first = round("first", "active", "2026-07-01");

  assert.deepStrictEqual(comparableRoundsBefore(first, [first]), []);
});

test("deltas are current minus previous, per dimension and overall", () => {
  const previous = round("spring", "closed", "2026-02-01");

  const comparison = toRoundComparison(
    analytics("winter", 72),
    previous,
    analytics("spring", 64),
  );

  assert.strictEqual(comparison?.overallDelta, 8);
  assert.strictEqual(comparison?.previousRoundTitle, "spring");
  for (const dimension of surveyInstrument.dimensions) {
    assert.strictEqual(comparison?.dimensionDeltas[dimension.id], 8);
  }
});

test("a locked previous round yields no comparison", () => {
  const previous = round("spring", "closed", "2026-02-01");
  const locked = analytics("spring", 0, {
    isLocked: true,
    totalResponses: 4,
    dimensionScores: {} as CanonicalRoundAnalytics["dimensionScores"],
  });

  assert.strictEqual(
    toRoundComparison(analytics("winter", 72), previous, locked),
    null,
  );
});

test("a locked current round yields no comparison", () => {
  const previous = round("spring", "closed", "2026-02-01");
  const locked = analytics("winter", 0, {
    isLocked: true,
    totalResponses: 3,
    dimensionScores: {} as CanonicalRoundAnalytics["dimensionScores"],
  });

  assert.strictEqual(
    toRoundComparison(locked, previous, analytics("spring", 64)),
    null,
  );
});

test("a delta reads as a direction in words, not only a sign", () => {
  assert.strictEqual(describeDelta(4), "עלייה של 4 נקודות");
  assert.strictEqual(describeDelta(-3), "ירידה של 3 נקודות");
  assert.strictEqual(describeDelta(0), "ללא שינוי");
});

test("the printed delta keeps its sign", () => {
  assert.strictEqual(formatDelta(4), "+4");
  assert.strictEqual(formatDelta(-3), "-3");
  assert.strictEqual(deltaDirection(4), "up");
  assert.strictEqual(deltaDirection(-3), "down");
  assert.strictEqual(deltaDirection(0), "flat");
});

test("a dimension that did not move still reads as a change of nothing", () => {
  // On the map this sits beside a large percentage. A bare `0` there is part of
  // a number rather than a change, which is what `±` fixes: every delta on the
  // screen now carries a sign.
  assert.strictEqual(formatDelta(0), "±0");
  assert.match(formatDelta(0), /^[+\-±]/u);
  assert.match(formatDelta(4), /^[+\-±]/u);
  assert.match(formatDelta(-3), /^[+\-±]/u);
});
