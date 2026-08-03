import assert from "node:assert";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { SurveyDefinitionQuestion } from "@/lib/types/backend";
import { SurveyFlow } from "../survey-flow";

/**
 * What the questionnaire looks like before a browser has been consulted.
 *
 * The draft lives in `sessionStorage`, which the server cannot read, so the
 * server pass has to render the empty questionnaire and the client pass has to
 * be the one that restores. These assertions pin that split: if the draft were
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
      variant="public"
      shareCode="SHALOM-7K2M"
      surveyTitle="סבב אבחון"
      introText="כמה שאלות קצרות."
      anonymityText="התשובות אנונימיות."
      questions={questions}
    />,
  );
}

test("SurveyFlow server render starts at the first question", () => {
  const markup = render();

  assert.ok(markup.includes("האם את/ה מרגיש/ה בנוח להביע דעה?"));
  assert.ok(markup.includes("שאלה 1 מתוך 2"));
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
