import assert from "node:assert";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { BreakdownBoard } from "../breakdown-board";
import type { BackgroundBreakdown } from "@/lib/analytics/background-breakdown";
import { WELLBEING_DIMENSION_TEXTS } from "@/lib/wellbeing-dimensions";

/**
 * The breakdown table is the one screen that named a dimension differently from
 * every other screen. It read `DimensionPresentation.label`, a second
 * hand-written copy of the eight names, and one of the eight had drifted:
 * `management-support` was `עוגן` here and `עורף מקצועי` everywhere else. The
 * copy is gone and the names come from `contracts/wellbeing-dimensions.json`.
 *
 * Rendering the table is what pins that. The parity test in
 * `src/lib/__tests__/wellbeing-dimensions.test.ts` compares the two lists;
 * this one asserts the string a manager actually reads, because the drift was
 * never in the lists disagreeing — it was in which list this screen used.
 */

const GROUPS = [
  { categoryId: "veteran", label: "ותק מעל עשר שנים", size: 14 },
  { categoryId: "new", label: "ותק עד שלוש שנים", size: 11 },
];

function breakdown(): BackgroundBreakdown {
  return {
    questionId: "tenure",
    questionText: "כמה שנים את/ה מלמד/ת?",
    totalResponses: 25,
    privacyThreshold: 10,
    isFullySuppressed: false,
    groups: GROUPS.map((group) => ({
      categoryId: group.categoryId,
      label: group.label,
      size: { suppressed: false as const, count: group.size },
      dimensionScores: Object.fromEntries(
        WELLBEING_DIMENSION_TEXTS.map((texts) => [
          texts.id,
          {
            dimensionId: texts.id,
            averageScore: 78,
            computedStatus: "green" as const,
            answerCount: group.size * 3,
          },
        ]),
      ),
    })),
  };
}

function render() {
  return renderToStaticMarkup(
    <BreakdownBoard
      breakdown={breakdown()}
      choices={[
        {
          questionId: "tenure",
          questionText: "כמה שנים את/ה מלמד/ת?",
          categoryCount: GROUPS.length,
        },
      ]}
      selectedQuestionId="tenure"
      roundId="round-1"
      isRoundLocked={false}
      isCollecting={false}
      privacyThreshold={10}
      totalResponses={25}
    />,
  );
}

test("a breakdown locked by an open round explains the round, not the threshold", () => {
  // The two screens have to give one account of one lock. This round holds 25
  // answers against a threshold of 10, so the threshold sentence — "at least 10
  // are needed, and meanwhile there are 25" — reads as nonsense, and the table
  // is withheld for a reason that has nothing to do with the count (ADR-030).
  const html = renderToStaticMarkup(
    <BreakdownBoard
      breakdown={breakdown()}
      choices={[
        {
          questionId: "tenure",
          questionText: "כמה שנים את/ה מלמד/ת?",
          categoryCount: GROUPS.length,
        },
      ]}
      selectedQuestionId="tenure"
      roundId="round-1"
      isRoundLocked
      isCollecting
      privacyThreshold={10}
      totalResponses={25}
    />,
  );

  assert.ok(html.includes("ייפתחו כשהוא ייסגר"));
  assert.ok(
    !html.includes("נדרשות לפחות"),
    "a round past its threshold must not be told it needs more answers",
  );
  // And the table itself is gone, not merely explained away.
  assert.ok(!html.includes("עורף מקצועי"));
});

test("the table names management-support the way the methodology does", () => {
  const html = render();

  assert.ok(
    html.includes("עורף מקצועי"),
    "the breakdown table should use the methodology's name",
  );
  assert.ok(
    !html.includes("עוגן"),
    "the map's old second name should not be back",
  );
});

test("every dimension gets a row, named from the manifest", () => {
  const html = render();

  for (const texts of WELLBEING_DIMENSION_TEXTS) {
    assert.ok(
      html.includes(`<th scope="row">${texts.conceptLabel}</th>`),
      texts.id,
    );
  }
});
