import assert from "node:assert";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  createCanonicalSurveyDefinition,
  estimateMinutesForQuestions,
  hasSameQuestionSnapshot,
  MINIMUM_PRIVACY_THRESHOLD,
  parseSurveyDefinition,
} from "@/lib/survey-definition";
import { createSurveyDefinitionHash } from "@/lib/survey-definition-hash";
import { surveyInstrument } from "@/lib/shalomut-source";
import {
  isAnalyticQuestion,
  type SurveyDefinitionQuestion,
} from "../types/backend";

function createDynamicDefinition() {
  const definition = createCanonicalSurveyDefinition("סבב מותאם", 10);
  definition.questions = surveyInstrument.dimensions.map((dimension, index) => ({
    id: `round-question-${index + 1}`,
    dimensionId: dimension.id,
    text: `שאלת שלומות מותאמת ${index + 1}`,
    required: true,
    enabled: true,
    kind: "analytic" as const,
    scaleId: "wellbeing-colour" as const,
    polarity: "positive" as const,
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
  const invalidResult = parseSurveyDefinition(
    createCanonicalSurveyDefinition("סבב קיץ", 0),
  );
  assert.strictEqual(invalidResult.ok, false);

  const validResult = parseSurveyDefinition(
    createCanonicalSurveyDefinition("סבב קיץ", 1),
  );
  assert.strictEqual(validResult.ok, true);
});

test("parseSurveyDefinition accepts a unique dynamic questionnaire that covers all eight dimensions", () => {
  const result = parseSurveyDefinition(createDynamicDefinition());

  assert.strictEqual(result.ok, true);
  if (result.ok) {
    assert.strictEqual(result.value.questions.length, 8);
    assert.deepStrictEqual(
      new Set(
        result.value.questions
          .filter(isAnalyticQuestion)
          .map((question) => question.dimensionId),
      ),
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
    (question) => !isAnalyticQuestion(question) || question.dimensionId !== "meaning",
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
  // The expected digest is unchanged by the answer-model work on purpose: the
  // contract fixes this projection at questionId/dimensionId/questionText, and
  // the fields added around them must not enter it.
  const questions: SurveyDefinitionQuestion[] = [
    {
      id: "😀",
      kind: "analytic",
      dimensionId: "balance",
      scaleId: "wellbeing-colour",
      polarity: "positive",
      text: "שאלה",
      required: true,
      enabled: true,
    },
    {
      id: "a",
      kind: "analytic",
      dimensionId: "meaning",
      scaleId: "likert-7-frequency",
      polarity: "negative",
      text: "  טקסט מדויק  ",
      required: false,
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

test("a definition stored below the required threshold is raised to it, not refused", () => {
  // Rounds configured before ten became mandatory are still on the database.
  // Refusing them here would take their own answer screen down with them, so
  // the definition loads with the threshold the product now requires.
  const legacy = {
    ...createCanonicalSurveyDefinition("סבב ותיק", 10),
    minimumResponses: 1,
  };

  const result = parseSurveyDefinition(legacy);

  assert.strictEqual(result.ok, true);
  if (result.ok) {
    assert.strictEqual(
      result.value.minimumResponses,
      MINIMUM_PRIVACY_THRESHOLD,
    );
  }
});

test("the database default for a new round is the same number the code requires", () => {
  // This drifted once already: a migration lowered the column default to 1
  // while the code kept asking for ten, and the only round on the database was
  // written with the lower number. Reads clamp, so nothing broke loudly — the
  // round page simply showed a threshold the product no longer allows.
  const schema = readFileSync(
    path.join(process.cwd(), "prisma", "schema.prisma"),
    "utf8",
  );
  const declaredDefault = schema.match(
    /privacyThreshold\s+Int\s+@default\((\d+)\)/,
  );

  assert.ok(declaredDefault, "schema.prisma must declare a privacy threshold default");
  assert.strictEqual(
    Number(declaredDefault[1]),
    MINIMUM_PRIVACY_THRESHOLD,
  );
});

test("a threshold that is not a positive whole number is still refused", () => {
  for (const minimumResponses of [0, -3, 2.5]) {
    const result = parseSurveyDefinition({
      ...createCanonicalSurveyDefinition("סבב ותיק", 10),
      minimumResponses,
    });

    assert.strictEqual(result.ok, false, String(minimumResponses));
  }
});

/**
 * The completion estimate is the last thing a respondent reads before deciding
 * whether to start, and it was a hardcoded 15 for an instrument of twenty-four
 * single-tap items that auto-advance — «24 שאלות, כ־15 דקות». A teacher
 * glancing at the link between lessons decides on that one integer.
 */

test("the completion estimate follows the question count", () => {
  assert.strictEqual(estimateMinutesForQuestions(24), 4);
  assert.strictEqual(estimateMinutesForQuestions(6), 1);
  assert.strictEqual(estimateMinutesForQuestions(48), 8);
});

test("a questionnaire never estimates less than a minute", () => {
  // A round under construction has no questions yet, and «0 דקות» reads as a
  // broken screen rather than as a short survey.
  assert.strictEqual(estimateMinutesForQuestions(0), 1);
  assert.strictEqual(estimateMinutesForQuestions(1), 1);
});

test("the standard questionnaire no longer claims fifteen minutes", () => {
  const definition = createCanonicalSurveyDefinition("סבב רגיל", 10);

  assert.strictEqual(
    definition.estimatedMinutes,
    estimateMinutesForQuestions(surveyInstrument.questions.length),
  );
  assert.ok(
    definition.estimatedMinutes < 15,
    "the hardcoded fifteen was several times the real duration",
  );
});
