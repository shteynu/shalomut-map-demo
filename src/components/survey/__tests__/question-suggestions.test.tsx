import assert from "node:assert";
import test, { afterEach } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { surveyInstrument } from "@/lib/shalomut-source";
import { QuestionEditDialog } from "../survey-builder/question-edit-dialog";
import { SurveyBuilderQuestions } from "../survey-builder/survey-builder-questions";
import {
  requestAiQuestionSuggestion,
  suggestionDimensionId,
  templateSuggestionForDimension,
} from "../survey-builder/question-suggestions";
import type { BuilderQuestion } from "../survey-builder/types";

/**
 * The builder's question library covered three dimensions of eight, so a manager
 * building a round about the other five had nothing to start from. A suggestion
 * now comes either from the model or from the canonical questionnaire, and the
 * two rules that make it safe to offer at all are tested here: the source is
 * always stated, and the manager has to rewrite the wording before it joins the
 * questionnaire.
 */

const SUGGESTED_ITEM = "אני מרגישה שיש לי מסגרת ברורה לתכנון השבוע הקרוב.";
const LATIN = /[A-Za-z]/u;

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
});

function draft(text: string): BuilderQuestion {
  return {
    id: "suggested-1",
    draftKey: "suggested-draft-1",
    text,
    dimensionId: "certainty",
    required: true,
    enabled: true,
    kind: "analytic" as const,
    scaleId: "wellbeing-colour" as const,
    polarity: "positive" as const,
  };
}

function renderDialog(
  question: BuilderQuestion,
  suggestion?: { source: "ai" | "template"; suggestedText: string },
) {
  return renderToStaticMarkup(
    <QuestionEditDialog
      isOpen
      question={question}
      questionIndex={0}
      onClose={() => {}}
      onSave={() => {}}
      suggestion={suggestion}
    />,
  );
}

test("the template half covers all eight dimensions, which the old library did not", () => {
  for (const dimension of surveyInstrument.dimensions) {
    const suggestion = templateSuggestionForDimension(dimension.id);
    assert.ok(suggestion, dimension.id);
    assert.strictEqual(suggestion.dimensionId, dimension.id);
    assert.strictEqual(suggestion.source, "template");
    assert.doesNotMatch(suggestion.text, LATIN);
  }
});

test("a template item the draft already holds is not offered again", () => {
  const [first, second] = surveyInstrument.questions.filter(
    (question) => question.dimensionId === "certainty",
  );

  const afterFirst = templateSuggestionForDimension("certainty", [first.text]);
  assert.strictEqual(afterFirst?.text, second.text);

  // Trailing punctuation and doubled spaces are the same item to a reader.
  const afterSpacing = templateSuggestionForDimension("certainty", [
    `  ${first.text.replace(/\.$/u, "")}  `,
  ]);
  assert.strictEqual(afterSpacing?.text, second.text);

  const all = surveyInstrument.questions
    .filter((question) => question.dimensionId === "certainty")
    .map((question) => question.text);
  assert.strictEqual(templateSuggestionForDimension("certainty", all), null);
});

test("a suggestion is aimed at the dimension in hand, or at the one blocking activation", () => {
  assert.strictEqual(suggestionDimensionId("balance", []), "balance");
  assert.strictEqual(
    suggestionDimensionId("all", ["meaning", "certainty"]),
    "meaning",
  );
  assert.strictEqual(
    suggestionDimensionId("all", []),
    surveyInstrument.dimensions[0].id,
  );
});

test("a model-written item is labelled AI; anything else is not", async () => {
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({ questionText: SUGGESTED_ITEM, source: "ai" }),
      { status: 200 },
    )) as typeof fetch;

  const outcome = await requestAiQuestionSuggestion("certainty", []);

  assert.ok(outcome.ok);
  assert.strictEqual(outcome.suggestion.source, "ai");
  assert.strictEqual(outcome.suggestion.text, SUGGESTED_ITEM);
});

test("a refused request comes back as Hebrew the manager can read", async () => {
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        error: "הצעת שאלה מהבינה המלאכותית אינה זמינה כרגע.",
        reason: "timeout",
      }),
      { status: 503 },
    )) as typeof fetch;

  const outcome = await requestAiQuestionSuggestion("certainty", []);

  assert.strictEqual(outcome.ok, false);
  assert.ok(!outcome.ok && outcome.error);
  assert.doesNotMatch((outcome as { error: string }).error, LATIN);
});

test("a network failure is an unavailable suggestion, not a thrown request", async () => {
  globalThis.fetch = (async () => {
    throw new Error("network down");
  }) as typeof fetch;

  const outcome = await requestAiQuestionSuggestion("certainty", []);

  assert.strictEqual(outcome.ok, false);
});

test("the dialog says which source the wording came from", () => {
  const ai = renderDialog(draft(SUGGESTED_ITEM), {
    source: "ai",
    suggestedText: SUGGESTED_ITEM,
  });
  const template = renderDialog(draft(SUGGESTED_ITEM), {
    source: "template",
    suggestedText: SUGGESTED_ITEM,
  });

  assert.match(ai, /הוצע על ידי הבינה המלאכותית/u);
  assert.doesNotMatch(ai, /תבנית השאלון המקורית/u);
  assert.match(template, /תבנית השאלון המקורית/u);
  assert.doesNotMatch(template, /הוצע על ידי הבינה המלאכותית/u);

  // An ordinary edit is not a suggestion and carries no label at all.
  const plain = renderDialog(draft("אני יודעת מה מצפים ממני."));
  assert.doesNotMatch(plain, /הוצע על ידי הבינה המלאכותית/u);
  assert.doesNotMatch(plain, /תבנית השאלון המקורית/u);
});

test("an unedited suggestion cannot be added, and an edited one can", () => {
  const unedited = renderDialog(draft(SUGGESTED_ITEM), {
    source: "ai",
    suggestedText: SUGGESTED_ITEM,
  });
  const edited = renderDialog(draft(`${SUGGESTED_ITEM} בשבוע הבא.`), {
    source: "ai",
    suggestedText: SUGGESTED_ITEM,
  });

  assert.match(unedited, /disabled/u);
  assert.match(unedited, /ההוספה תתאפשר לאחר עריכת הנוסח/u);
  assert.doesNotMatch(edited, /ההוספה תתאפשר לאחר עריכת הנוסח/u);
  // The reason is text, not only a disabled attribute or a colour.
  assert.match(unedited, /aria-describedby="question-dialog-edit-required"/u);
});

function renderQuestionsPanel(
  overrides: Partial<Parameters<typeof SurveyBuilderQuestions>[0]> = {},
) {
  return renderToStaticMarkup(
    <SurveyBuilderQuestions
      questions={[]}
      visibleQuestions={[]}
      selectedDimensionId="certainty"
      setSelectedDimensionId={() => {}}
      searchTerm=""
      setSearchTerm={() => {}}
      onSetVisibleEnabled={() => {}}
      onMoveQuestion={() => {}}
      onUpdateQuestion={() => {}}
      onDuplicateQuestion={() => {}}
      onSuggestFromTemplate={() => {}}
      onSuggestWithAi={() => {}}
      suggestionDimensionLabel="ודאות"
      {...overrides}
    />,
  );
}

test("the panel names the dimension a suggestion will be about, before it is asked for", () => {
  const markup = renderQuestionsPanel();

  assert.match(markup, /הצעת שאלה בעזרת AI/u);
  assert.match(markup, /הצעה מהתבנית/u);
  assert.match(markup, /ההצעה תתייחס לממד/u);
  assert.match(markup, /ודאות/u);
});

test("a request in flight is announced, not only spun", () => {
  const pending = renderQuestionsPanel({ isSuggesting: true });

  assert.match(pending, /aria-busy="true"/u);
  assert.match(pending, /מנסח הצעה/u);
  assert.match(pending, /disabled/u);
});

test("a frozen questionnaire accepts no suggestion from either source", () => {
  // Once responses exist the questionnaire may not change, and a suggestion is
  // a change like any other.
  const frozen = renderQuestionsPanel({ isFrozen: true });
  const disabledButtons = frozen.match(/<button[^>]*disabled/gu) ?? [];

  assert.ok(disabledButtons.length >= 2, frozen);
  assert.match(frozen, /השאלון הוקפא לעריכה/u);
});

test("a failed suggestion is reported in the panel where it was asked for", () => {
  const markup = renderQuestionsPanel({
    suggestionNote: "הצעת שאלה מהבינה המלאכותית אינה זמינה כרגע.",
  });

  assert.match(markup, /role="alert"/u);
  assert.match(markup, /אינה זמינה כרגע/u);
});

test("the questionnaire's own wording is never presented as an edit of itself", () => {
  // A template item opens with the instrument's text, so the edit requirement
  // applies to it exactly as it does to a model's draft: a school reads the
  // questionnaire as the manager's own.
  const canonical = surveyInstrument.questions[0].text;
  const markup = renderDialog(draft(canonical), {
    source: "template",
    suggestedText: canonical,
  });

  assert.match(markup, /ההוספה תתאפשר לאחר עריכת הנוסח/u);
});
