/**
 * What the builder must be true about now that a questionnaire can hold two
 * kinds of question.
 *
 * The load-bearing one is the round trip. A background question used to be
 * filtered out on load, which meant the next save wrote a questionnaire without
 * it — a silent deletion with nothing on screen to notice. Nothing in the
 * builder's own types could catch that, because a shorter list is a valid list.
 */
import assert from "node:assert";
import { test } from "node:test";

import { parseSurveyDefinition } from "@/lib/survey-definition";
import {
  groupBySection,
  sectionNamesIn,
  visibleQuestionsFor,
} from "../survey-builder/question-list-operations";
import {
  BACKGROUND_FILTER_ID,
  getBuilderQuestionnaireValidation,
  toBuilderQuestions,
  toSurveyDefinitionQuestion,
  type BuilderQuestion,
} from "../survey-builder/types";
import { withAnswerMode } from "../survey-builder/survey-question-card";
import { surveyInstrument } from "@/lib/shalomut-source";

function analytic(overrides: Partial<BuilderQuestion> = {}): BuilderQuestion {
  return {
    draftKey: "a1",
    id: "balance-1",
    text: "אני מצליח לשמור על גבולות",
    required: true,
    enabled: true,
    kind: "analytic",
    dimensionId: "balance",
    scaleId: "wellbeing-colour",
    polarity: "positive",
    ...overrides,
  } as BuilderQuestion;
}

function background(overrides: Record<string, unknown> = {}): BuilderQuestion {
  return {
    draftKey: "b1",
    id: "age-band",
    text: "מהי קבוצת הגיל שלך?",
    required: false,
    enabled: true,
    kind: "background",
    answerMode: "single-choice",
    options: [
      { value: "21-30", label: "21-30" },
      { value: "31-40", label: "31-40" },
    ],
    ...overrides,
  } as BuilderQuestion;
}

/** One analytic question per dimension, so coverage is never the failing rule. */
function everyDimension(): BuilderQuestion[] {
  return surveyInstrument.dimensions.map((dimension, index) =>
    analytic({
      draftKey: `cover-${index}`,
      id: `${dimension.id}-1`,
      dimensionId: dimension.id,
    }),
  );
}

test("a background question survives the round trip through the builder's own shape", () => {
  const questions = [...everyDimension(), background()];

  const definition = {
    title: "סבב",
    audience: "כלל צוות ההוראה",
    estimatedMinutes: 5,
    minimumResponses: 10,
    introText: "מבוא",
    anonymityText: "אנונימיות",
    questions: questions.map(toSurveyDefinitionQuestion),
  };

  const parsed = parseSurveyDefinition(definition);
  assert.ok(parsed.ok, parsed.ok ? "" : parsed.error);

  const stored = parsed.value.questions.find((q) => q.id === "age-band");
  assert.ok(stored, "the demographic question was dropped on the way out");
  assert.strictEqual(stored.kind, "background");
  assert.deepStrictEqual(
    stored.kind === "background" ? stored.options : undefined,
    [
      { value: "21-30", label: "21-30" },
      { value: "31-40", label: "31-40" },
    ],
  );
});

test("loading a questionnaire keeps every question it had", () => {
  // The regression this is here for: the builder filtered to analytic on load,
  // so a demographic question was dropped on the way in and gone on the next
  // save. A shorter list is a valid list, so nothing but a count catches it.
  const stored = [
    toSurveyDefinitionQuestion(analytic()),
    toSurveyDefinitionQuestion(background()),
    toSurveyDefinitionQuestion(
      background({
        draftKey: "b2",
        id: "time-teaching",
        answerMode: "allocation-100",
        options: undefined,
        allocationGroupId: "time",
      }),
    ),
  ];

  const loaded = toBuilderQuestions(stored, (_question, index) => `k${index}`);

  assert.strictEqual(loaded.length, stored.length);
  assert.deepStrictEqual(
    loaded.map((question) => question.id),
    ["balance-1", "age-band", "time-teaching"],
  );
  assert.deepStrictEqual(
    loaded.map((question) => question.draftKey),
    ["k0", "k1", "k2"],
  );
});

test("a background question carries no dimension into the saved definition", () => {
  // `parseSurveyDefinition` refuses a background question that carries one, so
  // this is the difference between saving and a rejected save.
  const saved = toSurveyDefinitionQuestion(background());

  assert.ok(!("dimensionId" in saved));
  assert.ok(!("scaleId" in saved));
  assert.ok(!("polarity" in saved));
});

test("a question mode that owns no options saves none at all", () => {
  // Not `options: []`. An empty list is refused outright, with a message about
  // options the manager has no field for on a numeric question.
  const saved = toSurveyDefinitionQuestion(
    background({ answerMode: "number", options: [] }),
  );

  assert.ok(!("options" in saved));
});

test("changing the answer mode drops what the old mode owned", () => {
  const asNumber = withAnswerMode(
    background() as never,
    "number",
  );
  assert.ok(!("options" in asNumber) || asNumber.options === undefined);

  const asGrid = withAnswerMode(asNumber, "allocation-100");
  assert.strictEqual(asGrid.allocationGroupId, "");

  const backToChoice = withAnswerMode(asGrid, "single-choice");
  assert.strictEqual(backToChoice.allocationGroupId, undefined);
  assert.strictEqual(backToChoice.options?.length, 2);
});

test("background questions do not count towards dimension coverage", () => {
  // Eight background questions are not eight dimensions. If they counted, a
  // questionnaire of demographics alone would report itself ready to activate.
  const validation = getBuilderQuestionnaireValidation(
    surveyInstrument.dimensions.map((dimension, index) =>
      background({ draftKey: `bg-${index}`, id: `bg-${dimension.id}` }),
    ),
  );

  assert.strictEqual(validation.isValid, false);
  assert.strictEqual(validation.missingDimensionIds.length, 8);
});

test("a choice with fewer than two usable options is reported before saving", () => {
  const validation = getBuilderQuestionnaireValidation([
    ...everyDimension(),
    background({ options: [{ value: "21-30", label: "21-30" }] }),
  ]);

  assert.strictEqual(validation.isSaveable, false);
  assert.deepStrictEqual(validation.incompleteBackgroundDraftKeys, ["b1"]);
  assert.match(validation.messages.join(" "), /שתי אפשרויות/);
});

test("an option with a value but no label does not count as an option", () => {
  const validation = getBuilderQuestionnaireValidation([
    ...everyDimension(),
    background({
      options: [
        { value: "21-30", label: "21-30" },
        { value: "31-40", label: "   " },
      ],
    }),
  ]);

  assert.strictEqual(validation.isSaveable, false);
});

test("an allocation grid of one row is reported, and two rows are not", () => {
  const oneRow = getBuilderQuestionnaireValidation([
    ...everyDimension(),
    background({
      draftKey: "g1",
      id: "time-teaching",
      answerMode: "allocation-100",
      options: undefined,
      allocationGroupId: "time",
    }),
  ]);

  assert.strictEqual(oneRow.isSaveable, false);
  assert.match(oneRow.messages.join(" "), /שתי שורות/);

  const twoRows = getBuilderQuestionnaireValidation([
    ...everyDimension(),
    background({
      draftKey: "g1",
      id: "time-teaching",
      answerMode: "allocation-100",
      options: undefined,
      allocationGroupId: "time",
    }),
    background({
      draftKey: "g2",
      id: "time-admin",
      answerMode: "allocation-100",
      options: undefined,
      allocationGroupId: "time",
    }),
  ]);

  assert.strictEqual(twoRows.isSaveable, true);
});

test("an allocation row naming no grid is reported", () => {
  const validation = getBuilderQuestionnaireValidation([
    ...everyDimension(),
    background({
      answerMode: "allocation-100",
      options: undefined,
      allocationGroupId: "  ",
    }),
  ]);

  assert.strictEqual(validation.isSaveable, false);
  assert.match(validation.messages.join(" "), /לאיזו טבלה/);
});

test("the background tab is the only filter a demographic question appears under", () => {
  const questions = [analytic(), background()];

  assert.deepStrictEqual(
    visibleQuestionsFor(questions, BACKGROUND_FILTER_ID, "").map((q) => q.id),
    ["age-band"],
  );
  assert.deepStrictEqual(
    visibleQuestionsFor(questions, "balance", "").map((q) => q.id),
    ["balance-1"],
  );
  assert.deepStrictEqual(
    visibleQuestionsFor(questions, "all", "").map((q) => q.id),
    ["balance-1", "age-band"],
  );
});

test("a background question is searchable by its section, having no dimension", () => {
  const question = background({ sectionId: "פרטי רקע" });

  assert.strictEqual(visibleQuestionsFor([question], "all", "רקע").length, 1);
  assert.strictEqual(visibleQuestionsFor([question], "all", "איזון").length, 0);
});

test("sections keep the questionnaire's own order and drop nothing", () => {
  const questions = [
    analytic({ draftKey: "a", id: "q-a", sectionId: "חלק ב" }),
    background({ draftKey: "b", id: "q-b" }),
    analytic({ draftKey: "c", id: "q-c", sectionId: "חלק א" }),
    analytic({ draftKey: "d", id: "q-d", sectionId: "חלק ב" }),
  ];

  const sections = groupBySection(questions);

  // First appearance, not alphabetical: sorting would show the manager a
  // different questionnaire from the one a respondent will read.
  assert.deepStrictEqual(
    sections.map((section) => section.sectionId),
    ["חלק ב", undefined, "חלק א"],
  );
  assert.deepStrictEqual(
    sections.flatMap((section) => section.questions.map((q) => q.id)),
    ["q-a", "q-d", "q-b", "q-c"],
  );
});

test("a section named only by whitespace is no section", () => {
  const sections = groupBySection([
    analytic({ draftKey: "a", id: "q-a", sectionId: "   " }),
  ]);

  assert.deepStrictEqual(sections.map((s) => s.sectionId), [undefined]);
  assert.deepStrictEqual(sectionNamesIn([analytic({ sectionId: "  " })]), []);
});

test("the section names offered are the ones already in use, deduplicated", () => {
  const names = sectionNamesIn([
    analytic({ draftKey: "a", sectionId: "חלק ב" }),
    analytic({ draftKey: "b", sectionId: "חלק א" }),
    analytic({ draftKey: "c", sectionId: "חלק ב" }),
  ]);

  assert.deepStrictEqual(names, ["חלק א", "חלק ב"]);
});
