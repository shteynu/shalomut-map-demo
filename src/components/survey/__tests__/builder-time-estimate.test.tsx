import assert from "node:assert";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { estimateMinutesForQuestions } from "@/lib/survey-definition";
import { SurveyBuilderSettings } from "../survey-builder/survey-builder-settings";

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
  const markup = renderSettings(estimateMinutesForQuestions(24));

  assert.match(markup, /readonly[^>]*value="4"|value="4"[^>]*readonly/iu);
});

test("the estimate says which number it follows", () => {
  const markup = renderSettings(estimateMinutesForQuestions(24));

  assert.match(markup, /aria-describedby="builder-minutes-note"/u);
  assert.match(markup, /מחושב ממספר השאלות הפעילות/u);
});

test("a shorter questionnaire shows a shorter estimate", () => {
  // The case the hardcoded number got wrong: a trimmed questionnaire kept
  // promising the minutes of the full one.
  assert.match(renderSettings(estimateMinutesForQuestions(6)), /value="1"/u);
  assert.match(renderSettings(estimateMinutesForQuestions(24)), /value="4"/u);
});
