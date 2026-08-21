import assert from "node:assert/strict";
import test from "node:test";
import { dimensionPresentations } from "@/lib/dashboard/dimension-presentation";
import { surveyInstrument } from "@/lib/shalomut-source";
import {
  WELLBEING_DIMENSION_IDS,
  WELLBEING_DIMENSION_TEXTS,
  dimensionTextsFor,
  loadDimensionTexts,
} from "@/lib/wellbeing-dimensions";

/** One well-formed entry, which each test below then breaks in one way. */
function entry(id: string) {
  return {
    id,
    label: "תווית",
    conceptLabel: "שם על המפה",
    subtitle: "תיאור",
    sourceLabel: "כותרת בטופס",
  };
}

const wellFormed = { dimensions: WELLBEING_DIMENSION_IDS.map(entry) };

test("the shipped manifest names every dimension, in order", () => {
  assert.deepStrictEqual(
    WELLBEING_DIMENSION_TEXTS.map((texts) => texts.id),
    [...WELLBEING_DIMENSION_IDS],
  );
});

test("a well-formed manifest loads", () => {
  const texts = loadDimensionTexts(wellFormed);
  assert.strictEqual(texts.length, WELLBEING_DIMENSION_IDS.length);
  assert.strictEqual(texts[0].conceptLabel, "שם על המפה");
});

test("a manifest may rename a dimension but not add one", () => {
  const extra = {
    dimensions: [...wellFormed.dimensions, entry("resilience")],
  };
  assert.throws(() => loadDimensionTexts(extra), /exactly 8 dimensions, not 9/);
});

test("a missing dimension is refused rather than left undefined", () => {
  const short = { dimensions: wellFormed.dimensions.slice(1) };
  assert.throws(() => loadDimensionTexts(short), /exactly 8 dimensions, not 7/);
});

test("the order is the manifest's, and a reordered one is refused", () => {
  const swapped = { dimensions: [...wellFormed.dimensions] };
  [swapped.dimensions[0], swapped.dimensions[1]] = [
    swapped.dimensions[1],
    swapped.dimensions[0],
  ];
  assert.throws(
    () => loadDimensionTexts(swapped),
    /must be 'self-expression', not 'professional-competence'/,
  );
});

test("an empty text is not a text", () => {
  for (const field of ["label", "conceptLabel", "subtitle", "sourceLabel"]) {
    const blank = {
      dimensions: wellFormed.dimensions.map((dimension, index) =>
        index === 3 ? { ...dimension, [field]: "   " } : dimension,
      ),
    };
    assert.throws(
      () => loadDimensionTexts(blank),
      new RegExp(`'balance' needs a non-empty ${field}`),
      field,
    );
  }
});

test("a manifest that is not a manifest is refused", () => {
  assert.throws(() => loadDimensionTexts(null), /must be an object/);
  assert.throws(() => loadDimensionTexts([]), /must be an object/);
  assert.throws(() => loadDimensionTexts({}), /must define dimensions/);
  assert.throws(
    () => loadDimensionTexts({ dimensions: [1, 2, 3, 4, 5, 6, 7, 8] }),
    /Dimension 0 must be an object/,
  );
});

test("the instrument reads its dimension texts from the manifest", () => {
  for (const dimension of surveyInstrument.dimensions) {
    const texts = dimensionTextsFor(dimension.id);
    assert.strictEqual(dimension.label, texts.label);
    assert.strictEqual(dimension.conceptLabel, texts.conceptLabel);
    assert.strictEqual(dimension.subtitle, texts.subtitle);
  }
});

test("every dimension still carries its questions", () => {
  assert.strictEqual(surveyInstrument.dimensions.length, 8);
  for (const dimension of surveyInstrument.dimensions) {
    assert.ok(dimension.questions.length > 0, dimension.id);
    for (const question of dimension.questions) {
      assert.strictEqual(question.dimensionId, dimension.id);
    }
  }
  assert.strictEqual(surveyInstrument.questions.length, 24);
});

test("the map and the methodology name a dimension the same way", () => {
  // `management-support` read `עוגן` on the breakdown table and
  // `עורף מקצועי` everywhere else until the second copy was deleted.
  for (const presentation of dimensionPresentations) {
    assert.strictEqual(
      presentation.conceptLabel,
      dimensionTextsFor(presentation.id).conceptLabel,
      presentation.id,
    );
  }
  assert.strictEqual(
    dimensionTextsFor("management-support").conceptLabel,
    "עורף מקצועי",
  );
});
