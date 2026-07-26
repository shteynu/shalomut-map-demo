import assert from "node:assert";
import test from "node:test";
import {
  createCanonicalSurveyDefinition,
  hasSameQuestionSnapshot,
  parseSurveyDefinition,
} from "@/lib/survey-definition";
import { createSurveyDefinitionHash } from "@/lib/survey-definition-hash";
import { surveyInstrument } from "@/lib/shalomut-source";

function createDynamicDefinition() {
  const definition = createCanonicalSurveyDefinition("סבב מותאם", 10);
  definition.questions = surveyInstrument.dimensions.map((dimension, index) => ({
    id: `round-question-${index + 1}`,
    dimensionId: dimension.id,
    text: `שאלת שלומות מותאמת ${index + 1}`,
    required: true,
    enabled: true,
    answerMode: "סקאלת צבעים",
  }));
  return definition;
}

test("parseSurveyDefinition accepts the canonical 24-question definition", () => {
  const definition = createCanonicalSurveyDefinition("סבב קיץ", 10);
  const result = parseSurveyDefinition(definition);

  assert.strictEqual(result.ok, true);
  if (result.ok) {
    assert.strictEqual(result.value.questions.length, 24);
  }
});

test("parseSurveyDefinition allows disabling a default question while enabled questions still cover all dimensions", () => {
  const definition = createCanonicalSurveyDefinition("סבב קיץ", 10);
  definition.questions[0] = {
    ...definition.questions[0],
    enabled: false,
  };

  const result = parseSurveyDefinition(definition);
  assert.strictEqual(result.ok, true);
});

test("parseSurveyDefinition enforces the privacy floor", () => {
  const result = parseSurveyDefinition(
    createCanonicalSurveyDefinition("סבב קיץ", 9),
  );

  assert.strictEqual(result.ok, false);
});

test("parseSurveyDefinition accepts a unique dynamic questionnaire that covers all eight dimensions", () => {
  const result = parseSurveyDefinition(createDynamicDefinition());

  assert.strictEqual(result.ok, true);
  if (result.ok) {
    assert.strictEqual(result.value.questions.length, 8);
    assert.deepStrictEqual(
      new Set(result.value.questions.map((question) => question.dimensionId)),
      new Set(surveyInstrument.dimensions.map((dimension) => dimension.id)),
    );
  }
});

test("parseSurveyDefinition rejects duplicate stable question IDs", () => {
  const definition = createDynamicDefinition();
  definition.questions[1].id = definition.questions[0].id;

  const result = parseSurveyDefinition(definition);

  assert.strictEqual(result.ok, false);
  if (!result.ok) {
    assert.match(result.error, /unique|duplicate/i);
  }
});

test("parseSurveyDefinition rejects activation without all eight dimensions", () => {
  const definition = createDynamicDefinition();
  definition.questions = definition.questions.filter(
    (question) => question.dimensionId !== "meaning",
  );

  const result = parseSurveyDefinition(definition);

  assert.strictEqual(result.ok, false);
  if (!result.ok) {
    assert.match(result.error, /eight dimensions|all dimensions/i);
  }
});

test("createSurveyDefinitionHash is order-independent and preserves exact persisted text", () => {
  const definition = createDynamicDefinition();
  const reversed = [...definition.questions].reverse();

  assert.strictEqual(
    createSurveyDefinitionHash(definition.questions),
    createSurveyDefinitionHash(reversed),
  );

  const revised = structuredClone(definition.questions);
  revised[0].text = `${revised[0].text} `;
  assert.notStrictEqual(
    createSurveyDefinitionHash(definition.questions),
    createSurveyDefinitionHash(revised),
  );
});

test("createSurveyDefinitionHash ignores disabled questions outside the AI-visible snapshot", () => {
  const definition = createDynamicDefinition();
  const disabled = {
    ...definition.questions[0],
    id: "disabled-question",
    text: "טקסט שלא מוצג",
    enabled: false,
  };

  assert.strictEqual(
    createSurveyDefinitionHash(definition.questions),
    createSurveyDefinitionHash([...definition.questions, disabled]),
  );
});

test("createSurveyDefinitionHash matches the shared UTF-8 compact JSON test vector", () => {
  const questions = [
    {
      id: "😀",
      dimensionId: "balance" as const,
      text: "שאלה",
      enabled: true,
    },
    {
      id: "a",
      dimensionId: "meaning" as const,
      text: "  טקסט מדויק  ",
      enabled: true,
    },
  ];

  assert.strictEqual(
    createSurveyDefinitionHash(questions),
    "sha256:feaed33e2341212b07591e5e0e228f0677d2cfa3fc64ba75eda9ae7d0fb90d24",
  );
});

test("hasSameQuestionSnapshot detects semantic and ordering changes", () => {
  const definition = createDynamicDefinition();
  const revised = structuredClone(definition);
  revised.questions[0].text = `${revised.questions[0].text} חדשה`;
  const reordered = structuredClone(definition);
  reordered.questions.reverse();

  assert.strictEqual(hasSameQuestionSnapshot(definition, definition), true);
  assert.strictEqual(hasSameQuestionSnapshot(definition, revised), false);
  assert.strictEqual(hasSameQuestionSnapshot(definition, reordered), false);
});
