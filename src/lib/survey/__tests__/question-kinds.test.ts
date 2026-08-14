import assert from "node:assert";
import { test } from "node:test";
import {
  createCanonicalSurveyDefinition,
  parseSurveyDefinition,
} from "../../survey-definition";
import { SurveyService } from "../../services/survey.service";
import { createSurveyDefinitionHash } from "../../survey-definition-hash";
import {
  isAnalyticQuestion,
  type SurveyDefinition,
  type WellbeingDimensionId,
} from "../../types/backend";

function definitionWith(questions: unknown[]): Record<string, unknown> {
  return {
    title: "שאלון",
    audience: "צוות",
    estimatedMinutes: 10,
    minimumResponses: 10,
    introText: "פתיח",
    anonymityText: "אנונימי",
    questions,
  };
}

function analytic(
  id: string,
  dimensionId: WellbeingDimensionId | string,
  extra: Record<string, unknown> = {},
) {
  return {
    id,
    dimensionId: dimensionId as WellbeingDimensionId,
    text: `שאלה ${id}`,
    required: true,
    enabled: true,
    ...extra,
  };
}

/** Eight analytic questions, one per dimension, so a definition can activate. */
function coveringQuestions(extra: Record<string, unknown> = {}) {
  return [
    "self-expression",
    "professional-competence",
    "social-resource",
    "balance",
    "management-support",
    "certainty",
    "organizational-climate",
    "meaning",
  ].map((dimensionId, index) =>
    analytic(`q-${index}`, dimensionId as WellbeingDimensionId, extra),
  );
}

test("a persisted question with no kind is analytic on the colour scale", () => {
  // The load-bearing compatibility case: every questionnaire in the database
  // predates these fields, and reading one differently would change what a
  // round mid-collection means.
  const result = parseSurveyDefinition(
    definitionWith([
      ...coveringQuestions(),
      // The old shape, verbatim, including the label that is no longer read.
      {
        id: "legacy",
        dimensionId: "balance",
        text: "שאלה ישנה",
        required: true,
        enabled: true,
        answerMode: "סקאלת צבעים",
      },
    ]),
  );

  assert.strictEqual(result.ok, true);
  if (!result.ok) return;

  const legacy = result.value.questions.find((q) => q.id === "legacy")!;
  assert.strictEqual(legacy.kind, "analytic");
  assert.ok(isAnalyticQuestion(legacy));
  if (!isAnalyticQuestion(legacy)) return;
  assert.strictEqual(legacy.scaleId, "wellbeing-colour");
  assert.strictEqual(legacy.polarity, "positive");
  assert.strictEqual(legacy.dimensionId, "balance");
});

test("the canonical template still parses and still activates", () => {
  const canonical = createCanonicalSurveyDefinition("סבב", 10);
  const result = parseSurveyDefinition(canonical);

  assert.strictEqual(result.ok, true);
  if (!result.ok) return;
  assert.strictEqual(result.value.questions.length, 24);
  assert.ok(result.value.questions.every(isAnalyticQuestion));
});

test("an analytic question must name a real dimension", () => {
  const result = parseSurveyDefinition(
    definitionWith([...coveringQuestions(), analytic("bad", "not-a-dimension")]),
  );
  assert.strictEqual(result.ok, false);
});

test("an analytic question may not carry options or an allocation group", () => {
  for (const extra of [
    { options: [{ value: "a", label: "א" }] },
    { allocationGroupId: "grid" },
  ]) {
    const result = parseSurveyDefinition(
      definitionWith([...coveringQuestions(), analytic("bad", "balance", extra)]),
    );
    assert.strictEqual(result.ok, false, JSON.stringify(extra));
  }
});

test("an unknown scale or polarity is refused rather than defaulted", () => {
  for (const extra of [
    { scaleId: "likert-6-extent" },
    { polarity: "neutral" },
    { kind: "something-else" },
  ]) {
    const result = parseSurveyDefinition(
      definitionWith([...coveringQuestions(), analytic("bad", "balance", extra)]),
    );
    assert.strictEqual(result.ok, false, JSON.stringify(extra));
  }
});

test("a background question is parsed, carries no dimension, and does not count towards activation", () => {
  const result = parseSurveyDefinition(
    definitionWith([
      ...coveringQuestions(),
      {
        id: "age",
        kind: "background",
        answerMode: "single-choice",
        text: "גיל",
        required: true,
        enabled: true,
        sectionId: "demographics",
        options: [
          { value: "20-", label: "20 ומטה" },
          { value: "21-30", label: "21-30" },
        ],
      },
    ]),
  );

  assert.strictEqual(result.ok, true);
  if (!result.ok) return;

  const age = result.value.questions.find((q) => q.id === "age")!;
  assert.strictEqual(age.kind, "background");
  assert.strictEqual(isAnalyticQuestion(age), false);
  assert.strictEqual(age.sectionId, "demographics");
});

test("a background question claiming a dimension is refused", () => {
  const result = parseSurveyDefinition(
    definitionWith([
      ...coveringQuestions(),
      {
        id: "age",
        kind: "background",
        answerMode: "single-choice",
        dimensionId: "balance",
        text: "גיל",
        required: true,
        enabled: true,
        options: [{ value: "a", label: "א" }],
      },
    ]),
  );
  assert.strictEqual(result.ok, false);
});

test("a background questionnaire alone cannot activate", () => {
  // Eight dimensions still have to be covered, and background questions are
  // not eligible to cover them.
  const result = parseSurveyDefinition(
    definitionWith([
      {
        id: "age",
        kind: "background",
        answerMode: "number",
        text: "גיל",
        required: true,
        enabled: true,
      },
    ]),
  );
  assert.strictEqual(result.ok, false);
});

test("a single-choice question needs options; a numeric one does not", () => {
  const withoutOptions = parseSurveyDefinition(
    definitionWith([
      ...coveringQuestions(),
      {
        id: "role",
        kind: "background",
        answerMode: "single-choice",
        text: "תפקיד",
        required: true,
        enabled: true,
      },
    ]),
  );
  assert.strictEqual(withoutOptions.ok, false);

  const numeric = parseSurveyDefinition(
    definitionWith([
      ...coveringQuestions(),
      {
        id: "hours",
        kind: "background",
        answerMode: "number",
        text: "שעות",
        required: true,
        enabled: true,
      },
    ]),
  );
  assert.strictEqual(numeric.ok, true);
});

test("an allocation grid of one row is refused", () => {
  const result = parseSurveyDefinition(
    definitionWith([
      ...coveringQuestions(),
      {
        id: "alloc-1",
        kind: "background",
        answerMode: "allocation-100",
        allocationGroupId: "time",
        text: "לימוד בכיתה",
        required: true,
        enabled: true,
      },
    ]),
  );
  assert.strictEqual(result.ok, false);
});

test("an allocation row must name its grid, and only an allocation row may", () => {
  const unnamed = parseSurveyDefinition(
    definitionWith([
      ...coveringQuestions(),
      {
        id: "alloc-1",
        kind: "background",
        answerMode: "allocation-100",
        text: "לימוד בכיתה",
        required: true,
        enabled: true,
      },
    ]),
  );
  assert.strictEqual(unnamed.ok, false);

  const misnamed = parseSurveyDefinition(
    definitionWith([
      ...coveringQuestions(),
      {
        id: "hours",
        kind: "background",
        answerMode: "number",
        allocationGroupId: "time",
        text: "שעות",
        required: true,
        enabled: true,
      },
    ]),
  );
  assert.strictEqual(misnamed.ok, false);
});

test("the snapshot hash ignores background questions entirely", () => {
  const analyticOnly = coveringQuestions().map((question) => ({
    ...question,
    kind: "analytic" as const,
    scaleId: "wellbeing-colour" as const,
    polarity: "positive" as const,
  }));

  const withBackground = parseSurveyDefinition(
    definitionWith([
      ...coveringQuestions(),
      {
        id: "age",
        kind: "background",
        answerMode: "number",
        text: "גיל",
        required: true,
        enabled: true,
      },
    ]),
  );
  assert.strictEqual(withBackground.ok, true);
  if (!withBackground.ok) return;

  // A demographic question is never sent to the model, so adding one must not
  // change the identity of the snapshot the model is shown.
  assert.strictEqual(
    createSurveyDefinitionHash(withBackground.value.questions),
    createSurveyDefinitionHash(analyticOnly),
  );
});

test("a submission is scored by the question's own scale and polarity", () => {
  const questions = [
    {
      id: "stress",
      kind: "analytic" as const,
      dimensionId: "balance" as const,
      scaleId: "likert-5-extent" as const,
      polarity: "negative" as const,
      required: true,
    },
    {
      id: "support",
      kind: "analytic" as const,
      dimensionId: "social-resource" as const,
      scaleId: "likert-5-extent" as const,
      polarity: "positive" as const,
      required: true,
    },
  ];

  const { result, record } = SurveyService.processSubmission(
    {
      roundId: "round-1",
      answers: [
        { questionId: "stress", dimensionId: "balance", value: "5" },
        { questionId: "support", dimensionId: "social-resource", value: "5" },
      ],
    },
    questions,
  );

  assert.strictEqual(result.success, true);
  // The same keystroke on two questions, scored opposite ways: "very much" is
  // the worst answer to a demand and the best answer to a resource.
  assert.strictEqual(record!.answers[0].score, 0);
  assert.strictEqual(record!.answers[1].score, 100);
});

test("a background answer is stored with no score and no dimension", () => {
  const { result, record } = SurveyService.processSubmission(
    {
      roundId: "round-1",
      answers: [{ questionId: "age", value: "21-30" }],
    },
    [
      {
        id: "age",
        kind: "background",
        required: true,
        answerMode: "single-choice",
        options: [{ value: "21-30", label: "21-30" }],
      },
    ],
  );

  assert.strictEqual(result.success, true);
  assert.strictEqual(record!.answers[0].score, undefined);
  assert.strictEqual(record!.answers[0].dimensionId, undefined);
  assert.strictEqual(record!.answers[0].value, "21-30");
});

test("an answer off the question's scale is refused", () => {
  const questions = [
    {
      id: "q",
      kind: "analytic" as const,
      dimensionId: "balance" as const,
      scaleId: "likert-5-extent" as const,
      polarity: "positive" as const,
      required: true,
    },
  ];

  for (const value of ["green", "6", "0", ""]) {
    const { result } = SurveyService.processSubmission(
      { roundId: "r", answers: [{ questionId: "q", dimensionId: "balance", value }] },
      questions,
    );
    assert.strictEqual(result.success, false, `"${value}" must be refused`);
  }
});

test("a choice outside the question's own options is refused", () => {
  const { result } = SurveyService.processSubmission(
    { roundId: "r", answers: [{ questionId: "age", value: "41-50" }] },
    [
      {
        id: "age",
        kind: "background",
        required: true,
        answerMode: "single-choice",
        options: [{ value: "21-30", label: "21-30" }],
      },
    ],
  );
  assert.strictEqual(result.success, false);
});

test("claiming a dimension for a background question is refused", () => {
  // The dimension travels with the answer and is checked against the round's
  // own question, so a client cannot move an answer onto a stone.
  const { result } = SurveyService.processSubmission(
    {
      roundId: "r",
      answers: [
        { questionId: "age", dimensionId: "balance", value: "21-30" },
      ],
    },
    [
      {
        id: "age",
        kind: "background",
        required: true,
        answerMode: "single-choice",
        options: [{ value: "21-30", label: "21-30" }],
      },
    ],
  );
  assert.strictEqual(result.success, false);
});

test("an allocation grid must total exactly 100", () => {
  const grid = ["a", "b", "c"].map((suffix) => ({
    id: `time-${suffix}`,
    kind: "background" as const,
    required: true,
    answerMode: "allocation-100" as const,
    allocationGroupId: "time",
  }));

  const exact = SurveyService.processSubmission(
    {
      roundId: "r",
      answers: [
        { questionId: "time-a", value: "50" },
        { questionId: "time-b", value: "25" },
        { questionId: "time-c", value: "25" },
      ],
    },
    grid,
  );
  assert.strictEqual(exact.result.success, true);

  const short = SurveyService.processSubmission(
    {
      roundId: "r",
      answers: [
        { questionId: "time-a", value: "50" },
        { questionId: "time-b", value: "25" },
        { questionId: "time-c", value: "20" },
      ],
    },
    grid,
  );
  assert.strictEqual(short.result.success, false);
  assert.match(short.result.error!, /must total 100, not 95/);
});

test("a half-answered allocation grid is refused even when the rows are optional", () => {
  const grid = ["a", "b"].map((suffix) => ({
    id: `time-${suffix}`,
    kind: "background" as const,
    required: false,
    answerMode: "allocation-100" as const,
    allocationGroupId: "time",
  }));

  const half = SurveyService.processSubmission(
    { roundId: "r", answers: [{ questionId: "time-a", value: "100" }] },
    grid,
  );
  assert.strictEqual(half.result.success, false);
  assert.match(half.result.error!, /answered in full/);

  // Skipping it entirely stays allowed: the rows are optional.
  const skipped = SurveyService.processSubmission(
    { roundId: "r", answers: [] },
    grid,
  );
  assert.strictEqual(skipped.result.success, true);
});

test("a definition round-trips through parse unchanged", () => {
  const source = definitionWith([
    ...coveringQuestions({
      kind: "analytic",
      scaleId: "likert-7-frequency",
      polarity: "negative",
      sectionId: "burnout",
    }),
    {
      id: "age",
      kind: "background",
      answerMode: "single-choice",
      text: "גיל",
      required: false,
      enabled: true,
      sectionId: "demographics",
      options: [{ value: "21-30", label: "21-30" }],
    },
  ]);

  const first = parseSurveyDefinition(source);
  assert.strictEqual(first.ok, true);
  if (!first.ok) return;

  const second = parseSurveyDefinition(
    JSON.parse(JSON.stringify(first.value)) as SurveyDefinition,
  );
  assert.strictEqual(second.ok, true);
  if (!second.ok) return;
  assert.deepStrictEqual(second.value, first.value);
});
