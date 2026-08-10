import assert from "node:assert";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { RoundComparison } from "@/lib/dashboard/round-comparison";
import { surveyInstrument } from "@/lib/shalomut-source";
import { DashboardRoundComparison } from "../dashboard-round-comparison";

function comparison(
  overrides: Partial<RoundComparison> = {},
): RoundComparison {
  return {
    previousRoundId: "spring",
    previousRoundTitle: "סבב אביב",
    overallDelta: 12,
    dimensionDeltas: surveyInstrument.dimensions.reduce(
      (deltas, dimension) => {
        deltas[dimension.id] = 12;
        return deltas;
      },
      {} as RoundComparison["dimensionDeltas"],
    ),
    currentResponseCount: 12,
    previousResponseCount: 10,
    minimumReadableDelta: 10,
    questionnaireChanged: false,
    ...overrides,
  };
}

function render(overrides: Partial<RoundComparison> = {}) {
  return renderToStaticMarkup(
    <DashboardRoundComparison comparison={comparison(overrides)} />,
  );
}

test("a like-for-like comparison says nothing about the questionnaire", () => {
  const html = render();

  assert.match(html, /עלייה של 12 נקודות/u);
  assert.match(html, /בהשוואה לסבב אביב/u);
  assert.doesNotMatch(html, /השאלון/u);
});

test("a rewritten questionnaire is said on screen, beside the delta", () => {
  const html = render({ questionnaireChanged: true });

  // The delta is still shown — dimensions stay comparable — but it stops
  // reading as a like-for-like measurement of the same school.
  assert.match(html, /עלייה של 12 נקודות/u);
  assert.match(html, /השאלון השתנה בין הסבבים/u);
  assert.match(html, /ברמת הממדים/u);
});

test("both counts stay with the sentence they qualify", () => {
  const html = render();

  assert.match(html, /12 משיבים בסבב הזה/u);
  assert.match(html, /10 בקודם/u);
});

test("a delta one respondent could have produced is not stated as a change", () => {
  const html = render({ overallDelta: 3 });

  assert.match(html, /שינוי קטן מכדי לקרוא/u);
  assert.match(html, /round-delta-flat/u);
  assert.match(html, /משיב אחד יכול להזיז את הציון עד 10 נקודות/u);
});
