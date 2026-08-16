import assert from "node:assert";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  canonicalSurveyQuestions,
  createCanonicalSurveyDefinition,
  createEmptyDraftSurveyDefinition,
  hasSameQuestionSnapshot,
  MINIMUM_PRIVACY_THRESHOLD,
  parseSurveyDefinition,
} from "@/lib/survey-definition";
import { createSurveyDefinitionHash } from "@/lib/survey-definition-hash";
import { SurveyService } from "@/lib/services/survey.service";
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

test("the standard questionnaire no longer claims fifteen minutes", () => {
  // Four, and it stayed four when the estimate stopped being a question count:
  // twenty-four colour questions still cost ten seconds each. What the estimate
  // is made of now lives in `survey/__tests__/survey-duration.test.ts`.
  const definition = createCanonicalSurveyDefinition("סבב רגיל", 10);

  assert.strictEqual(definition.estimatedMinutes, 4);
  assert.strictEqual(definition.questions.length, surveyInstrument.questions.length);
  assert.ok(
    definition.estimatedMinutes < 15,
    "the hardcoded fifteen was several times the real duration",
  );
});

test("the default questionnaire is built in one place and answered against the same one", () => {
  // The regression guard for collapsing three constructions into one. Until
  // this branch, `createCanonicalSurveyDefinition`, the builder's
  // `loadDefaultTemplate` and `canonicalExpectedQuestions` in
  // `services/survey.service.ts` each mapped `surveyInstrument.questions` and
  // re-typed `scaleId` and `polarity` beside it. Nothing compared them, so a
  // change to one was a silent disagreement about what the product asks.
  const questions = canonicalSurveyQuestions();

  assert.deepStrictEqual(
    createCanonicalSurveyDefinition("סבב", MINIMUM_PRIVACY_THRESHOLD).questions,
    questions,
    "a new round must be born with exactly the template",
  );

  // What the template is, pinned so that a change to it is a decision rather
  // than a diff nobody reads: the instrument's questions, all analytic, all on
  // the colour scale, all positive, all enabled.
  assert.deepStrictEqual(
    questions.map((question) => question.id),
    surveyInstrument.questions.map((question) => question.id),
  );
  for (const question of questions) {
    assert.strictEqual(question.kind, "analytic");
    assert.strictEqual(question.scaleId, "wellbeing-colour");
    assert.strictEqual(question.polarity, "positive");
    assert.strictEqual(question.enabled, true);
  }

  // And the half that crosses a module boundary, which is the one a shared
  // helper cannot make true by construction: a submission answering the
  // template, with no expected questions passed, is accepted. When the service
  // kept its own copy this passed by coincidence; it now passes by wiring.
  const submission = SurveyService.processSubmission({
    roundId: "round_canonical_default",
    answers: questions.map((question) => ({
      questionId: question.id,
      dimensionId: question.dimensionId,
      value: "green" as const,
    })),
  });

  assert.strictEqual(submission.result.success, true);
});

test("the questionnaire records which instrument it was built from, and a database round trip keeps it", () => {
  const definition = createCanonicalSurveyDefinition("סבב עם מקור", 10);
  assert.strictEqual(definition.instrumentId, surveyInstrument.id);

  // The column is opaque JSON and every read goes back through the parser,
  // which rebuilds from a whitelist rather than spreading its input — so a
  // field the parser does not name is lost between two page loads, not between
  // two releases.
  const reread = parseSurveyDefinition(
    JSON.parse(JSON.stringify(definition)) as unknown,
  );
  assert.strictEqual(reread.ok, true);
  assert.strictEqual(
    reread.ok && reread.value.instrumentId,
    surveyInstrument.id,
  );
});

test("a questionnaire written before provenance existed keeps its silence", () => {
  const legacy = createCanonicalSurveyDefinition("סבב ותיק", 10);
  delete legacy.instrumentId;

  const parsed = parseSurveyDefinition(legacy);
  assert.strictEqual(parsed.ok, true);
  assert.strictEqual(parsed.ok && parsed.value.instrumentId, undefined);
});

test("a blank questionnaire claims no instrument", () => {
  // It borrows the canonical wording and the estimate, and that is all it
  // borrows: no question in it came from the instrument.
  const draft = createEmptyDraftSurveyDefinition("סבב מאפס", 10);

  assert.deepStrictEqual(draft.questions, []);
  assert.strictEqual(draft.instrumentId, undefined);
});

test("a provenance that is not a usable id is refused rather than dropped", () => {
  const definition = createCanonicalSurveyDefinition("סבב", 10);

  for (const invalid of [42, "", "   ", "x".repeat(201), null]) {
    const parsed = parseSurveyDefinition({
      ...definition,
      instrumentId: invalid,
    });
    assert.strictEqual(
      parsed.ok,
      false,
      `instrumentId ${JSON.stringify(invalid)} should not parse`,
    );
  }
});

test("provenance is outside the hash, so recording it moves no round's identity", () => {
  // The hash is the identity of the question snapshot the AI is shown, and
  // Python recomputes it independently from the aggregates it receives. A round
  // whose questions did not move must not change hash because Core started
  // writing down where its questionnaire came from.
  const definition = createCanonicalSurveyDefinition("סבב", 10);
  const withoutProvenance = { ...definition, instrumentId: undefined };

  assert.strictEqual(
    createSurveyDefinitionHash(definition.questions),
    createSurveyDefinitionHash(withoutProvenance.questions),
  );
});
