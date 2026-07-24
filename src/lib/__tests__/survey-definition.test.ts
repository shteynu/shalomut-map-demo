import assert from "node:assert";
import test from "node:test";
import {
  createCanonicalSurveyDefinition,
  parseSurveyDefinition,
} from "@/lib/survey-definition";

test("parseSurveyDefinition accepts the canonical 24-question definition", () => {
  const definition = createCanonicalSurveyDefinition("סבב קיץ", 10);
  const result = parseSurveyDefinition(definition);

  assert.strictEqual(result.ok, true);
  if (result.ok) {
    assert.strictEqual(result.value.questions.length, 24);
  }
});

test("parseSurveyDefinition rejects disabling a canonical question", () => {
  const definition = createCanonicalSurveyDefinition("סבב קיץ", 10);
  definition.questions[0] = {
    ...definition.questions[0],
    enabled: false,
  };

  const result = parseSurveyDefinition(definition);
  assert.strictEqual(result.ok, false);
  if (!result.ok) {
    assert.match(result.error, /24 canonical/i);
  }
});

test("parseSurveyDefinition enforces the privacy floor", () => {
  const result = parseSurveyDefinition(
    createCanonicalSurveyDefinition("סבב קיץ", 9),
  );

  assert.strictEqual(result.ok, false);
});
