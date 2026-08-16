import assert from "node:assert";
import { test } from "node:test";
import {
  comparableRoundsBefore,
  deltaDirection,
  describeDelta,
  formatDelta,
  isDeltaReadable,
  isNearBandEdge,
  minimumReadableDelta,
  toRoundComparison,
} from "@/lib/dashboard/round-comparison";
import {
  createMeasurementSnapshotHash,
  createSurveyDefinitionHash,
} from "@/lib/survey-definition-hash";
import { createCanonicalSurveyDefinition } from "@/lib/survey-definition";
import { surveyInstrument } from "@/lib/shalomut-source";
import type {
  AnalyticSurveyQuestion,
  RoundDimensionScore,
  SurveyDefinition,
  SurveyRound,
} from "@/lib/types/backend";
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
    measurementSnapshotHash: "measurement",
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
  // A resolution of 1 point: a hundred respondents, where three points really
  // is three points.
  assert.strictEqual(describeDelta(4, 1), "עלייה של 4 נקודות");
  assert.strictEqual(describeDelta(-3, 1), "ירידה של 3 נקודות");
  // Zero is not its own case: at any real sample size "it did not move" and
  // "it moved less than we can see" are the same statement.
  assert.strictEqual(describeDelta(0, 1), "שינוי קטן מכדי לקרוא בגודל המדגם הזה");
});

test("the printed delta keeps its sign", () => {
  assert.strictEqual(formatDelta(4, 1), "+4");
  assert.strictEqual(formatDelta(-3, 1), "-3");
  assert.strictEqual(deltaDirection(4, 1), "up");
  assert.strictEqual(deltaDirection(-3, 1), "down");
  assert.strictEqual(deltaDirection(0, 1), "flat");
});

test("a dimension that did not move is never printed as a bare number", () => {
  // On the map this sits beside a large percentage, where a bare `0` reads as
  // part of the number rather than as a change. Every value that reaches the
  // screen therefore carries a sign or the approximation mark.
  assert.strictEqual(formatDelta(0, 1), "≈");
  assert.match(formatDelta(4, 1), /^[+\-≈]/u);
  assert.match(formatDelta(-3, 1), /^[+\-≈]/u);
});

test("one respondent's width is the resolution of the comparison", () => {
  // Ten teachers: one of them answering at the other end of the scale moves the
  // mean by ten points, so nothing under ten is about the school.
  assert.strictEqual(minimumReadableDelta(10, 10), 10);
  assert.strictEqual(minimumReadableDelta(100, 100), 1);
  // The weaker half governs: a hundred answers this round cannot sharpen the
  // twelve that were collected last time.
  assert.strictEqual(minimumReadableDelta(100, 12), 9);
  assert.strictEqual(minimumReadableDelta(12, 100), 9);
});

test("a round nobody answered has no resolution at all", () => {
  assert.strictEqual(minimumReadableDelta(10, 0), Number.POSITIVE_INFINITY);
  assert.strictEqual(
    describeDelta(40, minimumReadableDelta(10, 0)),
    "שינוי קטן מכדי לקרוא בגודל המדגם הזה",
  );
});

test("a delta one respondent could have produced is not stated as a change", () => {
  const minimum = minimumReadableDelta(10, 10);

  // The three-point rise this product used to print as a fact.
  assert.strictEqual(isDeltaReadable(3, minimum), false);
  assert.strictEqual(describeDelta(3, minimum), "שינוי קטן מכדי לקרוא בגודל המדגם הזה");
  assert.strictEqual(formatDelta(3, minimum), "≈");
  // And no colour either: the styling must not say "up" where the words say
  // "unreadable".
  assert.strictEqual(deltaDirection(3, minimum), "flat");

  // Exactly at the boundary it is readable again.
  assert.strictEqual(isDeltaReadable(10, minimum), true);
  assert.strictEqual(formatDelta(10, minimum), "+10");
});

test("the comparison carries both counts and its own resolution", () => {
  const comparison = toRoundComparison(
    analytics("autumn", 70, { totalResponses: 12 }),
    round("spring", "closed", "2026-02-01"),
    analytics("spring", 64, { totalResponses: 10 }),
  );

  assert.ok(comparison);
  assert.strictEqual(comparison.currentResponseCount, 12);
  assert.strictEqual(comparison.previousResponseCount, 10);
  assert.strictEqual(comparison.minimumReadableDelta, 10);
});

test("two rounds that asked the same questions compare like for like", () => {
  const comparison = toRoundComparison(
    analytics("autumn", 70),
    round("spring", "closed", "2026-02-01"),
    analytics("spring", 64),
  );

  assert.strictEqual(comparison?.questionnaireChanged, false);
});

test("a rewritten questionnaire is carried into the comparison, not hidden", () => {
  // The delta survives — dimensions are the stable taxonomy across rounds —
  // but it stops being indistinguishable from a like-for-like one.
  const comparison = toRoundComparison(
    analytics("autumn", 70, { measurementSnapshotHash: "sha256:rewritten" }),
    round("spring", "closed", "2026-02-01"),
    analytics("spring", 64, { measurementSnapshotHash: "sha256:original" }),
  );

  assert.ok(comparison);
  assert.strictEqual(comparison.questionnaireChanged, true);
  assert.strictEqual(comparison.overallDelta, 6);
});

/**
 * The two identities, on questionnaires rather than on string literals.
 *
 * These build real definitions and run the real projections, because the
 * defect being pinned is precisely that one projection sees a field and the
 * other does not — a test that made up its own hashes would pass against
 * either.
 */
function definitionOnScale(
  scaleId: AnalyticSurveyQuestion["scaleId"],
  polarity: AnalyticSurveyQuestion["polarity"] = "positive",
): SurveyDefinition {
  const definition = createCanonicalSurveyDefinition("סבב", 10);

  return {
    ...definition,
    questions: definition.questions.map((question) =>
      question.kind === "analytic"
        ? { ...question, scaleId, polarity }
        : question,
    ),
  };
}

test("the same questions on a different answer scale are not the same measurement", () => {
  const onColours = definitionOnScale("wellbeing-colour");
  const onSevenPoint = definitionOnScale("likert-7-frequency");

  // Word for word the same questions, in the same order, on the same
  // dimensions — so the snapshot the AI is shown is identical, and is meant
  // to be. Changing that would move every round's identity and break a
  // recomputation the Python service performs from a payload carrying no
  // scale at all.
  assert.strictEqual(
    createSurveyDefinitionHash(onColours.questions),
    createSurveyDefinitionHash(onSevenPoint.questions),
  );

  // What they measure is not the same: three colours score 100/60/0 and seven
  // points score 0/17/33/50/67/83/100, so a delta across the pair subtracts
  // one instrument's mean from another's.
  assert.notStrictEqual(
    createMeasurementSnapshotHash(onColours.questions),
    createMeasurementSnapshotHash(onSevenPoint.questions),
  );

  const comparison = toRoundComparison(
    analytics("autumn", 70, {
      measurementSnapshotHash: createMeasurementSnapshotHash(
        onSevenPoint.questions,
      ),
    }),
    round("spring", "closed", "2026-02-01"),
    analytics("spring", 64, {
      measurementSnapshotHash: createMeasurementSnapshotHash(
        onColours.questions,
      ),
    }),
  );

  assert.ok(comparison);
  assert.strictEqual(comparison.questionnaireChanged, true);
});

test("the same question asked in the opposite direction is not the same measurement", () => {
  // A polarity flip leaves the text alone and inverts what the answer is
  // worth, so the score moves with nothing having happened to the school.
  const asked = definitionOnScale("wellbeing-colour", "positive");
  const askedBackwards = definitionOnScale("wellbeing-colour", "negative");

  assert.strictEqual(
    createSurveyDefinitionHash(asked.questions),
    createSurveyDefinitionHash(askedBackwards.questions),
  );
  assert.notStrictEqual(
    createMeasurementSnapshotHash(asked.questions),
    createMeasurementSnapshotHash(askedBackwards.questions),
  );

  const comparison = toRoundComparison(
    analytics("autumn", 70, {
      measurementSnapshotHash: createMeasurementSnapshotHash(
        askedBackwards.questions,
      ),
    }),
    round("spring", "closed", "2026-02-01"),
    analytics("spring", 64, {
      measurementSnapshotHash: createMeasurementSnapshotHash(asked.questions),
    }),
  );

  assert.strictEqual(comparison?.questionnaireChanged, true);
});

test("the measurement identity still catches everything the AI-visible one did", () => {
  // Strictly harder to collide with, so switching the flag onto it cannot have
  // stopped anything being reported.
  const original = createCanonicalSurveyDefinition("סבב", 10);
  const reworded: SurveyDefinition = {
    ...original,
    questions: original.questions.map((question, index) =>
      index === 0 ? { ...question, text: `${question.text} (נוסח חדש)` } : question,
    ),
  };
  const shortened: SurveyDefinition = {
    ...original,
    questions: original.questions.map((question, index) =>
      index === 0 ? { ...question, enabled: false } : question,
    ),
  };

  for (const changed of [reworded, shortened]) {
    assert.notStrictEqual(
      createSurveyDefinitionHash(original.questions),
      createSurveyDefinitionHash(changed.questions),
    );
    assert.notStrictEqual(
      createMeasurementSnapshotHash(original.questions),
      createMeasurementSnapshotHash(changed.questions),
    );
  }
});

test("a score at the edge of a band is flagged as one", () => {
  const minimum = minimumReadableDelta(10, 10);

  // 74 and 75 hand a principal two different products. At this sample size the
  // colour is not something the data decided.
  assert.strictEqual(isNearBandEdge(74, minimum), true);
  assert.strictEqual(isNearBandEdge(75, minimum), true);
  assert.strictEqual(isNearBandEdge(52, minimum), true);
  // Far from both edges, the colour means what it says.
  assert.strictEqual(isNearBandEdge(92, minimum), false);
  assert.strictEqual(isNearBandEdge(20, minimum), false);
  assert.strictEqual(isNearBandEdge(62, minimum), false);
});
