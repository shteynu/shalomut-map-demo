import assert from "node:assert";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { SurveyConsentStep } from "../survey-consent-step";
import { createCanonicalSurveyDefinition } from "@/lib/survey-definition";

/**
 * The consent screen is the only place where the product speaks about itself to
 * the person whose answers it wants, and it is read once, by someone deciding
 * whether to trust it. A promise here is not copy; it is the terms.
 *
 * So these tests are about what the screen may not say. They are worded as
 * refusals rather than as expected strings, because the failure they exist to
 * catch is not a typo — it is a future edit that quietly widens a guarantee
 * past what the deployment can keep.
 */

const definition = createCanonicalSurveyDefinition("סבב לבדיקה", 10);

function renderConsent() {
  return renderToStaticMarkup(
    <SurveyConsentStep
      surveyTitle={definition.title}
      introText={definition.introText}
      anonymityText={definition.anonymityText}
      estimatedMinutes={definition.estimatedMinutes}
      questionCount={definition.questions.length}
      onAccept={() => {}}
      onDecline={() => {}}
    />,
  );
}

test("the screen never claims the stack does not see an address", () => {
  const markup = renderConsent();

  // The application collects no address and the hosting edge logs one. Both
  // are true, and only the second decides what a respondent is owed.
  assert.ok(
    !/לא נאספים[^.]*כתובת IP/u.test(markup),
    "an address the hosting edge logs cannot be promised away",
  );
  assert.ok(
    markup.includes("כתובת ה־IP"),
    "and it must be described rather than left unmentioned",
  );
});

test("the third-party model is disclosed, with what it receives", () => {
  const markup = renderConsent();

  assert.ok(markup.includes("מודל שפה של ספק חיצוני"));
  assert.ok(
    markup.includes("ממוצעים ברמת השאלה"),
    "naming the processor without naming what crosses tells a respondent nothing",
  );
});

test("the manager's own wording cannot become a promise", () => {
  const markup = renderToStaticMarkup(
    <SurveyConsentStep
      surveyTitle={definition.title}
      introText={definition.introText}
      // A manager can write anything here, including a guarantee the product
      // does not keep. It must stay outside the promise list.
      anonymityText="אף אחד לעולם לא יידע דבר, מובטח."
      estimatedMinutes={definition.estimatedMinutes}
      questionCount={definition.questions.length}
      onAccept={() => {}}
      onDecline={() => {}}
    />,
  );

  const promiseList = markup.slice(
    markup.indexOf('<ul class="survey-consent-promises">'),
    markup.indexOf("</ul>"),
  );

  assert.ok(promiseList.length > 0, "the promise list is rendered");
  assert.ok(
    !promiseList.includes("מובטח"),
    "manager text renders outside the promises, in its lighter note",
  );
  assert.ok(markup.includes("מובטח"), "and is still shown, just not as a promise");
});
