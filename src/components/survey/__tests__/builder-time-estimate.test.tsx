import assert from "node:assert";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { estimateMinutesForQuestionnaire } from "@/lib/survey/survey-duration";
import type { SurveyDefinitionQuestion } from "@/lib/types/backend";
import { SurveyBuilderSettings } from "../survey-builder/survey-builder-settings";

/** N colour questions, which is what a questionnaire of N looked like. */
function minutesForColourQuestions(count: number): number {
  const questions: SurveyDefinitionQuestion[] = Array.from(
    { length: count },
    (_, index) => ({
      id: `q${index}`,
      text: `שאלה ${index}`,
      required: true,
      enabled: true,
      kind: "analytic",
      dimensionId: "self-expression",
      scaleId: "wellbeing-colour",
      polarity: "positive",
    }),
  );

  return estimateMinutesForQuestionnaire(questions);
}

/**
 * The estimate is the one promise this product makes about the respondent's
 * time, and it used to be a number a manager typed once and never revisited.
 * These tests are about the two halves of taking that back: the field cannot be
 * typed into, and it says where its number comes from.
 */
function renderSettings(estimatedMinutes: number) {
  return renderToStaticMarkup(
    <SurveyBuilderSettings
      title="סבב לבדיקה"
      setTitle={() => {}}
      audience="כלל צוות ההוראה"
      estimatedMinutes={estimatedMinutes}
      minimumResponses={10}
      setMinimumResponses={() => {}}
      introText="פתיחה"
      setIntroText={() => {}}
      anonymityText="אנונימיות"
      setAnonymityText={() => {}}
    />,
  );
}

test("the time estimate cannot be typed over", () => {
  const markup = renderSettings(minutesForColourQuestions(24));

  assert.match(markup, /readonly[^>]*value="4"|value="4"[^>]*readonly/iu);
});

test("the estimate says which number it follows", () => {
  const markup = renderSettings(minutesForColourQuestions(24));

  assert.match(markup, /aria-describedby="builder-minutes-note"/u);
  assert.match(markup, /זמן המילוי מחושב מהשאלות הפעילות/u);
});

test("a shorter questionnaire shows a shorter estimate", () => {
  // The case the hardcoded number got wrong: a trimmed questionnaire kept
  // promising the minutes of the full one.
  assert.match(renderSettings(minutesForColourQuestions(6)), /value="1"/u);
  assert.match(renderSettings(minutesForColourQuestions(24)), /value="4"/u);
});
