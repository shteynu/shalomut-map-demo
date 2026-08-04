import assert from "node:assert";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import type {
  DashboardInsightsDto,
  DashboardStone,
} from "@/lib/dashboard/dashboard-insights";
import { surveyInstrument } from "@/lib/shalomut-source";
import {
  DashboardOverviewSummary,
} from "../dashboard-map-page";
import { getDisplayedMetrics } from "../dashboard-metrics-page";
import {
  getBuilderQuestionnaireValidation,
  localizeSurveyDefinitionSaveError,
  toSurveyDefinitionQuestion,
  type BuilderQuestion,
} from "../../survey/survey-builder/types";
import { SurveyQuestionCard } from "../../survey/survey-builder/survey-question-card";

function createReadyResult(summary: string): DashboardInsightsDto {
  return {
    roundId: "round-dashboard-summary",
    overallSummary: summary,
    stones: {},
  };
}

function stoneWithMetrics(
  metrics: DashboardStone["metrics"],
): DashboardStone {
  return {
    dimensionId: "balance",
    score: 62,
    status: "yellow",
    summary: ["פסקה אחת."],
    interpretationUnavailable: false,
    metrics,
    recommendations: [],
  };
}

test("DashboardOverviewSummary renders the organization summary exactly once", () => {
  const summary =
    "הסיכום הארגוני נשען על כלל הממדים ומוצג פעם אחת בלבד במפת השלומות.";
  const html = renderToStaticMarkup(
    <DashboardOverviewSummary
      state={{ status: "ready", value: createReadyResult(summary) }}
      onRetry={() => undefined}
    />,
  );

  assert.strictEqual(html.split(summary).length - 1, 1);
  assert.match(html, /סיכום ארגוני/);
});

test("DashboardOverviewSummary localizes invalid or unavailable insight states", () => {
  const rawError = "provider-secret-error-must-not-render";
  const html = renderToStaticMarkup(
    <DashboardOverviewSummary
      state={{ status: "error", error: rawError }}
      onRetry={() => undefined}
    />,
  );

  assert.doesNotMatch(html, new RegExp(rawError));
  // Whatever failed upstream, the manager is told the same thing: the analysis
  // service is down right now and their answers are intact.
  assert.match(html, /שירות הניתוח אינו זמין כרגע/);
  assert.match(html, /התשובות שנאספו נשמרו במלואן/);
});

test("DashboardOverviewSummary tells a run in flight apart from a failed one", () => {
  const html = renderToStaticMarkup(
    <DashboardOverviewSummary
      state={{ status: "running" }}
      onRetry={() => undefined}
    />,
  );

  assert.match(html, /הניתוח בעבודה/);
  assert.doesNotMatch(html, /שירות הניתוח אינו זמין כרגע/);
});

test("getDisplayedMetrics forwards variable question metrics to the metrics screen", () => {
  const shortRoundMetrics = [
    { label: "שאלה ראשונה", value: "70 מתוך 100", helper: "12 משיבים" },
    { label: "שאלה שנייה", value: "60 מתוך 100", helper: "12 משיבים" },
  ];
  const expandedRoundMetrics = [
    ...shortRoundMetrics,
    { label: "שאלה מותאמת שלישית", value: "50 מתוך 100", helper: "16 משיבים" },
    { label: "שאלה מותאמת רביעית", value: "80 מתוך 100", helper: "16 משיבים" },
  ];

  assert.deepStrictEqual(
    getDisplayedMetrics(stoneWithMetrics(shortRoundMetrics)),
    shortRoundMetrics,
  );
  assert.deepStrictEqual(
    getDisplayedMetrics(stoneWithMetrics(expandedRoundMetrics)),
    expandedRoundMetrics,
  );
});

function createBuilderQuestions(): BuilderQuestion[] {
  return surveyInstrument.dimensions.map((dimension, index) => ({
    draftKey: `draft-${index}`,
    id: `round-question-${dimension.id}`,
    text: `שאלה מותאמת עבור ${dimension.label}`,
    dimensionId: dimension.id,
    required: true,
    enabled: true,
    answerMode: "סקאלת צבעים",
  }));
}

test("builder validation reports duplicate stable IDs and incomplete dimension coverage in Hebrew", () => {
  const questions = createBuilderQuestions();
  questions[1] = { ...questions[1], id: questions[0].id };
  questions.find((question) => question.dimensionId === "meaning")!.enabled = false;

  const validation = getBuilderQuestionnaireValidation(questions);

  assert.strictEqual(validation.isValid, false);
  assert.deepStrictEqual(validation.duplicateQuestionIds, [questions[0].id]);
  assert.deepStrictEqual(validation.missingDimensionIds, ["meaning"]);
  assert.match(validation.messages.join(" "), /מזהה קבוע/);
  assert.match(validation.messages.join(" "), /משמעות/);
  assert.doesNotMatch(validation.messages.join(" "), /duplicate|dimension/i);
});

test("builder validation accepts different valid question IDs and counts", () => {
  const shortRound = createBuilderQuestions();
  const expandedRound = [
    ...createBuilderQuestions(),
    {
      ...createBuilderQuestions()[0],
      draftKey: "draft-extra",
      id: "round-extra-self-expression",
      text: "יש לי מרחב נוסף להביע עמדה מקצועית שונה.",
    },
  ];

  assert.strictEqual(getBuilderQuestionnaireValidation(shortRound).isValid, true);
  assert.strictEqual(getBuilderQuestionnaireValidation(expandedRound).isValid, true);
});

test("survey builder never exposes raw API validation errors to managers", () => {
  const localized = localizeSurveyDefinitionSaveError(
    "Enabled survey questions must cover all eight dimensions before activation.",
    400,
  );

  assert.match(localized, /שמונת ממדי השלומות/);
  assert.doesNotMatch(localized, /Enabled|dimensions|activation/);

  const immutableSnapshotError = localizeSurveyDefinitionSaveError(
    "Question snapshot cannot change after responses exist.",
    409,
  );
  assert.match(immutableSnapshotError, /לאחר שהתקבלה תשובה/);
  assert.match(immutableSnapshotError, /סבב או גרסה חדשה/);
  assert.doesNotMatch(immutableSnapshotError, /snapshot|responses/i);
});

test("survey question card exposes editable stable ID, exact text, and dimension mapping", () => {
  const question: BuilderQuestion = {
    draftKey: "draft-custom-balance",
    id: "custom-balance-recovery",
    text: "יש לי מרחב קבוע להתאוששות בין ימי עבודה עמוסים.",
    dimensionId: "balance",
    required: true,
    enabled: true,
    answerMode: "סקאלת צבעים",
  };
  const html = renderToStaticMarkup(
    <SurveyQuestionCard
      question={question}
      questionIndex={1}
      onMove={() => undefined}
      canMoveUp={false}
      canMoveDown={false}
      onUpdate={() => undefined}
      onDuplicate={() => undefined}
    />,
  );

  assert.match(html, /מזהה קבוע לשאלה/);
  assert.match(html, /custom-balance-recovery/);
  assert.match(html, /נוסח השאלה המדויק שיוצג וינותח/);
  assert.match(html, new RegExp(question.text));
  assert.match(html, /<option value="balance" selected="">איזון<\/option>/);
});

test("builder serialization keeps the exact persisted question text and removes draft-only identity", () => {
  const question: BuilderQuestion = {
    draftKey: "draft-exact-text",
    id: "custom-exact-text",
    text: "  נוסח שנשמר בדיוק כפי שהוזן.  ",
    dimensionId: "meaning",
    required: true,
    enabled: true,
    answerMode: "סקאלת צבעים",
  };

  assert.deepStrictEqual(toSurveyDefinitionQuestion(question), {
    id: "custom-exact-text",
    text: question.text,
    dimensionId: "meaning",
    required: true,
    enabled: true,
    answerMode: "סקאלת צבעים",
  });
});
