import assert from "node:assert";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { DashboardMapLocked } from "../dashboard-map-locked";
import { DashboardMapInteractive } from "../dashboard-map-interactive";
import { DashboardMapPage } from "../dashboard-map-page";
import { dimensionPresentations } from "@/lib/dashboard/dimension-presentation";
import { surveyInstrument } from "@/lib/shalomut-source";
import type { WellbeingDimensionId, WellbeingStatus } from "@/lib/shalomut-source";

/**
 * The map screen used to decide for itself whether a round was locked, from the
 * response count alone. The analysis locks a round for two further reasons —
 * a questionnaire that does not cover every dimension, and any single question
 * answered by fewer people than the threshold — and withholds `dimensionScores`
 * when it does. A round locked for one of those arrived at the map with the
 * count already met and nothing to draw, and the map drew it anyway.
 *
 * The decision now travels from the analysis, so these are the two things that
 * have to stay true: the locked screen must not promise a number it cannot
 * keep, and the map must not turn a missing score into a blank page.
 */

type ScoreMap = Record<
  WellbeingDimensionId,
  { averageScore: number; computedStatus: WellbeingStatus }
>;

function scores(): ScoreMap {
  return surveyInstrument.dimensions.reduce((map, dimension) => {
    map[dimension.id] = { averageScore: 80, computedStatus: "green" };
    return map;
  }, {} as ScoreMap);
}

test("the locked screen does not promise that zero more answers will open the map", () => {
  // A round the analysis locked while the total was already met: one question
  // drew fewer answers than the threshold.
  const html = renderToStaticMarkup(
    <DashboardMapLocked responseCount={12} minimumResponses={10} />,
  );

  assert.ok(!html.includes("עוד 0 תשובות"));
  assert.ok(html.includes("חלק מהשאלון"));

  // And the ordinary case still says the useful thing.
  const stillCollecting = renderToStaticMarkup(
    <DashboardMapLocked responseCount={6} minimumResponses={10} />,
  );
  assert.ok(stillCollecting.includes("עוד 4 תשובות"));
});

test("the map skips a stone with no score instead of blanking the page", () => {
  // Reaching this is a bug — the caller withholds a locked round — so what is
  // pinned here is the failure mode, not the state: seven stones beat none.
  const withoutOne = scores();
  delete (withoutOne as Partial<ScoreMap>)[surveyInstrument.dimensions[0].id];

  const html = renderToStaticMarkup(
    <DashboardMapInteractive
      dimensionScores={withoutOne}
      roundId="round_1"
      dimensionDeltas={null}
      divisions={[]}
      minimumReadableDelta={Number.POSITIVE_INFINITY}
      responseCount={12}
    />,
  );

  assert.ok(html.includes(dimensionPresentations[1].label));
  assert.ok(!html.includes(dimensionPresentations[0].label));
});

test("a locked round's empty score map renders no stones rather than throwing", () => {
  const html = renderToStaticMarkup(
    <DashboardMapInteractive
      dimensionScores={{} as ScoreMap}
      roundId="round_1"
      dimensionDeltas={null}
      divisions={[]}
      minimumReadableDelta={Number.POSITIVE_INFINITY}
      responseCount={12}
    />,
  );

  for (const dimension of dimensionPresentations) {
    assert.ok(
      !html.includes(dimension.label),
      `${dimension.id} should not be drawn without a score`,
    );
  }
});

test("the map's stones are the methodology's dimensions, not a second list", () => {
  assert.deepStrictEqual(
    dimensionPresentations.map((dimension) => dimension.id),
    surveyInstrument.dimensions.map((dimension) => dimension.id),
  );

  for (const dimension of surveyInstrument.dimensions) {
    const presentation = dimensionPresentations.find(
      (candidate) => candidate.id === dimension.id,
    );
    assert.ok(presentation);
    // The concept name and the description belong to the methodology. Only
    // `label` — what the stone is called on the map — is the map's own, and
    // `management-support` is where that shows: "עוגן" here, "עורף מקצועי"
    // there.
    assert.strictEqual(presentation.conceptLabel, dimension.conceptLabel);
    assert.strictEqual(presentation.subtitle, dimension.subtitle);
  }
});

test("the map page obeys the analysis about being locked, and does not re-decide", () => {
  // The combination that used to crash: the analysis locked the round while
  // the round total was already past the threshold. The screen's own rule
  // ("responseCount < minimumResponses") reads this as unlocked, so if it ever
  // comes back this renders the map against scores the analysis withheld.
  const html = renderToStaticMarkup(
    <DashboardMapPage
      roundId="round_1"
      organizationName="בית ספר לבדיקה"
      roundTitle="סבב לבדיקה"
      responseCount={12}
      minimumResponses={10}
      overallScore={0}
      dimensionScores={{} as ScoreMap}
      roundOptions={{ current: [], archived: [] }}
      roundSwitcherAction="/dashboard"
      comparison={null}
      divisions={[]}
      isLocked
    />,
  );

  assert.ok(html.includes("המפה עדיין נעולה"));
});
