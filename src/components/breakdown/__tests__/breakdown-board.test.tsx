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
      privacyThreshold={10}
      totalResponses={25}
    />,
  );
}

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
