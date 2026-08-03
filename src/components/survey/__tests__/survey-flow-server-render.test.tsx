import assert from "node:assert";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { SurveyDefinitionQuestion } from "@/lib/types/backend";
import { SurveyFlow } from "../survey-flow";

/**
 * What the questionnaire looks like before a browser has been consulted.
 *
 * The draft lives in `sessionStorage`, which the server cannot read, so the
 * server pass has to render the consent screen and the client pass has to be
 * the one that restores. These assertions pin that split: if the draft were
 * ever read during render without a server snapshot, the markup below would
 * change and hydration would disagree with it.
 */

const questions: SurveyDefinitionQuestion[] = [
  {
    id: "q1",
    dimensionId: "self-expression",
    text: "האם את/ה מרגיש/ה בנוח להביע דעה?",
    required: true,
    enabled: true,
    answerMode: "traffic-light",
  },
  {
    id: "q2",
    dimensionId: "balance",
    text: "האם נשאר לך זמן להתאוששות?",
    required: true,
    enabled: true,
    answerMode: "traffic-light",
  },
];

function render() {
  return renderToStaticMarkup(
    <SurveyFlow
      shareCode="SHALOM-7K2M"
      surveyTitle="סבב אבחון"
      introText="כמה שאלות קצרות."
      anonymityText="התשובות אנונימיות."
      estimatedMinutes={7}
      questions={questions}
    />,
  );
}

test("SurveyFlow asks for consent before it asks anything else", () => {
  const markup = render();

  assert.ok(markup.includes("לפני שמתחילים"));
  assert.ok(markup.includes("הבנתי, אפשר להתחיל"));
});

test("SurveyFlow shows no question until consent is given", () => {
  // Not a styling detail: a question rendered behind the consent screen would
  // mean the respondent was asked before they agreed to be asked.
  const markup = render();

  assert.ok(!markup.includes("האם את/ה מרגיש/ה בנוח להביע דעה?"));
  assert.ok(!markup.includes("שאלה 1 מתוך 2"));
});

test("SurveyFlow states the promises the code owns, not only the manager's text", () => {
  const markup = render();

  assert.ok(markup.includes("לא נאספים שם"));
  assert.ok(markup.includes("ההשתתפות התנדבותית"));
  assert.ok(markup.includes("מצרפית"));
});

test("SurveyFlow tells the respondent the size of what they are agreeing to", () => {
  const markup = render();

  assert.ok(markup.includes("2 שאלות"));
  assert.ok(markup.includes("7 דקות"));
});

test("SurveyFlow server render claims nothing was restored", () => {
  // The notice is a client-only fact. Rendering it on the server would both
  // lie and break hydration.
  const markup = render();

  assert.ok(!markup.includes("שוחזרה"));
});

test("SurveyFlow server render does not warn about storage it never asked for", () => {
  const markup = render();

  assert.ok(!markup.includes("לא ניתן לשמור התקדמות"));
});
