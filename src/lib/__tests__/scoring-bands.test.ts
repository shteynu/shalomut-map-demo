import assert from "node:assert";
import { test } from "node:test";
import scoringBandsManifest from "../../../contracts/scoring-bands.json";
import { SCORING_BANDS, loadScoringBands, statusForScore } from "../scoring-bands";
import { AnalyticsService } from "../services/analytics.service";
import { scoringThresholds } from "../shalomut-source";

const validManifest = {
  bands: [
    { status: "green", min: 75, max: 100 },
    { status: "yellow", min: 50, max: 74 },
    { status: "red", min: 0, max: 49 },
  ],
};

function manifestWith(
  bands: Array<Record<string, unknown>>,
): Record<string, unknown> {
  return { bands };
}

test("the shipped manifest is the one the runtime uses", () => {
  assert.deepStrictEqual(SCORING_BANDS, loadScoringBands(scoringBandsManifest));
});

test("statusForScore returns the band each score falls in", () => {
  assert.strictEqual(statusForScore(100), "green");
  assert.strictEqual(statusForScore(75), "green");
  assert.strictEqual(statusForScore(74), "yellow");
  assert.strictEqual(statusForScore(50), "yellow");
  assert.strictEqual(statusForScore(49), "red");
  assert.strictEqual(statusForScore(0), "red");
});

test("a score outside 0-100 takes the nearest band instead of a fourth status", () => {
  assert.strictEqual(statusForScore(120), "green");
  assert.strictEqual(statusForScore(-5), "red");
});

test("changing the manifest changes where the colours fall", () => {
  const stricter = loadScoringBands(
    manifestWith([
      { status: "green", min: 90, max: 100 },
      { status: "yellow", min: 40, max: 89 },
      { status: "red", min: 0, max: 39 },
    ]),
  );

  assert.deepStrictEqual(stricter[0], { status: "green", min: 90, max: 100 });
  assert.deepStrictEqual(stricter[2], { status: "red", min: 0, max: 39 });
});

test("Core's scoring, its methodology table and its payload check share one source", () => {
  // The three places that used to hold their own copy of the bands. The
  // payload check in ai-contract.ts imports the same function these do.
  assert.strictEqual(AnalyticsService.computeStatus(75), statusForScore(75));
  assert.strictEqual(AnalyticsService.computeStatus(49), statusForScore(49));
  assert.deepStrictEqual(
    scoringThresholds.map(({ status, min, max }) => ({ status, min, max })),
    SCORING_BANDS,
  );
});

test("a manifest that is not three ordered bands is refused", () => {
  assert.throws(() => loadScoringBands(null), /must be an object/);
  assert.throws(() => loadScoringBands({}), /must define 3 bands/);
  assert.throws(
    () => loadScoringBands(manifestWith(validManifest.bands.slice(0, 2))),
    /must define 3 bands/,
  );
  assert.throws(
    () =>
      loadScoringBands(
        manifestWith([
          { status: "red", min: 0, max: 49 },
          { status: "yellow", min: 50, max: 74 },
          { status: "green", min: 75, max: 100 },
        ]),
      ),
    /must have status 'green'/,
  );
});

test("a band that is not an object is refused before its bounds are read", () => {
  // The only branch of the loader no test reached. It matters because the
  // manifest is read by Python as well: a band that is `null` in one runtime
  // and a crash in the other is the cross-runtime disagreement this file
  // exists to prevent.
  for (const notABand of [null, [], "green"]) {
    assert.throws(
      () =>
        loadScoringBands(
          manifestWith([
            notABand as unknown as Record<string, unknown>,
            { status: "yellow", min: 50, max: 74 },
            { status: "red", min: 0, max: 49 },
          ]),
        ),
      /Scoring band 0 must be an object/,
    );
  }
});

test("a band with non-integer or inverted bounds is refused", () => {
  assert.throws(
    () =>
      loadScoringBands(
        manifestWith([
          { status: "green", min: 74.5, max: 100 },
          { status: "yellow", min: 50, max: 74 },
          { status: "red", min: 0, max: 49 },
        ]),
      ),
    /needs integer min and max/,
  );
  assert.throws(
    () =>
      loadScoringBands(
        manifestWith([
          { status: "green", min: 75, max: 100 },
          { status: "yellow", min: 74, max: 50 },
          { status: "red", min: 0, max: 49 },
        ]),
      ),
    /has min above max/,
  );
});

test("bands that leave a gap, overlap or miss an end of the scale are refused", () => {
  assert.throws(
    () =>
      loadScoringBands(
        manifestWith([
          { status: "green", min: 75, max: 100 },
          { status: "yellow", min: 51, max: 73 },
          { status: "red", min: 0, max: 49 },
        ]),
      ),
    /must be adjacent/,
  );
  assert.throws(
    () =>
      loadScoringBands(
        manifestWith([
          { status: "green", min: 75, max: 100 },
          { status: "yellow", min: 50, max: 80 },
          { status: "red", min: 0, max: 49 },
        ]),
      ),
    /must be adjacent/,
  );
  assert.throws(
    () =>
      loadScoringBands(
        manifestWith([
          { status: "green", min: 75, max: 99 },
          { status: "yellow", min: 50, max: 74 },
          { status: "red", min: 0, max: 49 },
        ]),
      ),
    /must reach 100/,
  );
  assert.throws(
    () =>
      loadScoringBands(
        manifestWith([
          { status: "green", min: 75, max: 100 },
          { status: "yellow", min: 50, max: 74 },
          { status: "red", min: 1, max: 49 },
        ]),
      ),
    /must start at 0/,
  );
});
