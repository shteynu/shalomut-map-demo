import assert from "node:assert";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { QuestionEditDialog } from "../survey-builder/question-edit-dialog";
import { SurveyBuilderQuestions } from "../survey-builder/survey-builder-questions";
import type { BuilderQuestion } from "../survey-builder/types";

/**
 * Writing a question.
 *
 * Everything the questionnaire could hold used to arrive from somewhere else —
 * the canonical template, the model, or a duplicate of a question already in
 * the list — so a manager with a question of their own had to duplicate an
 * unrelated one and overwrite every field of it. The panel now offers the
 * empty question directly, and the dialog it opens in is the one every other
 * question is edited in.
 */

function blankDraft(): BuilderQuestion {
  return {
    id: "custom-1",
    draftKey: "manual-1",
    text: "",
    dimensionId: "certainty",
    required: true,
    enabled: true,
    answerMode: "סקאלת צבעים",
  };
}

function renderPanel(
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
      onAddQuestion={() => {}}
      onLoadTemplate={() => {}}
      onSuggestFromTemplate={() => {}}
      onSuggestWithAi={() => {}}
      suggestionDimensionLabel="ודאות"
      {...overrides}
    />,
  );
}

test("the panel offers a question of the manager's own, not only borrowed wording", () => {
  const markup = renderPanel();

  assert.match(markup, /הוספת שאלה/u);
});

test("the empty draft's own note names three ways out and the panel offers them", () => {
  // The empty state promised "add a question, use an example, or load the
  // template" and offered exactly one of the three.
  const markup = renderPanel();

  assert.match(markup, /אין שאלות בקטגוריה זו/u);
  assert.match(markup, /הוספת שאלה חדשה/u);
  assert.match(markup, /טעינת תבנית השאלון המלאה/u);
});

test("a frozen questionnaire accepts no new question either", () => {
  // Once responses exist the questionnaire may not change, and a question the
  // manager writes is a change like any other.
  const frozen = renderPanel({ isFrozen: true });
  const addButton = frozen.match(/<button[^>]*>[^<]*(?:<[^>]*>)*\s*הוספת שאלה/u);

  assert.ok(addButton, frozen);
  assert.match(addButton[0], /disabled/u);
});

test("a question being written is an addition, and says so on the button", () => {
  const markup = renderToStaticMarkup(
    <QuestionEditDialog
      isOpen
      isNew
      question={blankDraft()}
      questionIndex={0}
      onClose={() => {}}
      onSave={() => {}}
    />,
  );

  assert.match(markup, /הוספת שאלה חדשה/u);
  assert.match(markup, /הוספה לשאלון/u);
  // It carries no number, because it has no place in the questionnaire yet.
  assert.doesNotMatch(markup, /ללא מספר/u);
});

test("wording the manager typed carries no source label and no rewrite demand", () => {
  // The edit requirement exists so a model's sentence is never put to a school
  // as if a person had chosen it. A sentence the manager wrote is already
  // theirs, so neither the label nor the requirement applies.
  const markup = renderToStaticMarkup(
    <QuestionEditDialog
      isOpen
      isNew
      question={{ ...blankDraft(), text: "אני יודעת למי לפנות כשקשה." }}
      questionIndex={0}
      onClose={() => {}}
      onSave={() => {}}
    />,
  );

  assert.doesNotMatch(markup, /הוצע על ידי הבינה המלאכותית/u);
  assert.doesNotMatch(markup, /תבנית השאלון המקורית/u);
  assert.doesNotMatch(markup, /ההוספה תתאפשר לאחר עריכת הנוסח/u);
});

test("an existing question is still edited, not added", () => {
  const markup = renderToStaticMarkup(
    <QuestionEditDialog
      isOpen
      question={{ ...blankDraft(), text: "אני יודעת מה מצפים ממני." }}
      questionIndex={3}
      onClose={() => {}}
      onSave={() => {}}
    />,
  );

  assert.match(markup, /עריכת שאלה 3/u);
  assert.doesNotMatch(markup, /הוספה לשאלון/u);
});
