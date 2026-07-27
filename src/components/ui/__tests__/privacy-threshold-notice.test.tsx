import assert from "node:assert";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  DEFAULT_PRIVACY_THRESHOLD,
  LOW_PRIVACY_THRESHOLD_WARNING,
  RECOMMENDED_PRIVACY_THRESHOLD,
} from "@/lib/survey-definition";
import {
  PrivacyThresholdNotice,
  privacyThresholdNoticeText,
} from "../privacy-threshold-notice";
import { MetricCard } from "../metric-card";
import { PrivacyTooltip } from "../privacy-tooltip";

const LATIN = /[A-Za-z]/u;

test("the reminder names the required threshold below it and stays silent at or above it", () => {
  assert.strictEqual(
    privacyThresholdNoticeText(RECOMMENDED_PRIVACY_THRESHOLD),
    null,
  );
  assert.strictEqual(
    privacyThresholdNoticeText(RECOMMENDED_PRIVACY_THRESHOLD + 5),
    null,
  );

  const text = privacyThresholdNoticeText(RECOMMENDED_PRIVACY_THRESHOLD - 1);
  assert.ok(text);
  assert.match(text, new RegExp(String(RECOMMENDED_PRIVACY_THRESHOLD)));
  assert.match(text, new RegExp(String(RECOMMENDED_PRIVACY_THRESHOLD - 1)));
});

test("the reminder is graded rather than repeated", () => {
  // Below five the average stops hiding the individual respondent, which is a
  // different statement from "the recommended number is ten".
  const nearMiss = privacyThresholdNoticeText(LOW_PRIVACY_THRESHOLD_WARNING);
  const unprotected = privacyThresholdNoticeText(
    LOW_PRIVACY_THRESHOLD_WARNING - 1,
  );

  assert.ok(nearMiss && unprotected);
  assert.notStrictEqual(nearMiss, unprotected);
  assert.match(unprotected, /לשייך אותן לאדם מסוים/u);
  assert.doesNotMatch(nearMiss, /לשייך אותן לאדם מסוים/u);
});

test("the product default triggers the reminder", () => {
  // The default is 1 in the database column, in Core and in the AI service. A
  // manager who changes nothing has to be told what that costs.
  assert.ok(privacyThresholdNoticeText(DEFAULT_PRIVACY_THRESHOLD));
});

test("the reminder is Hebrew-only text and not colour alone", () => {
  const html = renderToStaticMarkup(
    <PrivacyThresholdNotice minimumResponses={3} emphasis="form" />,
  );

  assert.doesNotMatch(html.replace(/<[^>]*>/gu, ""), LATIN);
  assert.match(html, /role="status"/u);
  assert.ok(html.includes(String(RECOMMENDED_PRIVACY_THRESHOLD)));
});

test("the reminder renders nothing at a compliant threshold", () => {
  const html = renderToStaticMarkup(
    <PrivacyThresholdNotice
      minimumResponses={RECOMMENDED_PRIVACY_THRESHOLD}
      emphasis="form"
    />,
  );

  assert.strictEqual(html, "");
});

test("the round metric card explains its own threshold, not the product default", () => {
  // The card and the tooltip beside it used to disagree: the card showed the
  // round's threshold while the tooltip explained the default of 1.
  const html = renderToStaticMarkup(
    <MetricCard
      value="4"
      label="סף פרטיות"
      helper={`הגנה על אנונימיות — הסף הנדרש ${RECOMMENDED_PRIVACY_THRESHOLD}`}
      minimumResponses={4}
    />,
  );

  assert.ok(html.includes("בסבב הנוכחי: 4"));
  assert.ok(html.includes("הסף המתודולוגי הנדרש"));
  assert.ok(html.includes(`הסף הנדרש ${RECOMMENDED_PRIVACY_THRESHOLD}`));
});

test("the privacy tooltip carries the reminder for the round it describes", () => {
  const belowThreshold = renderToStaticMarkup(
    <PrivacyTooltip minimumResponses={4} />,
  );
  const atThreshold = renderToStaticMarkup(
    <PrivacyTooltip minimumResponses={RECOMMENDED_PRIVACY_THRESHOLD} />,
  );

  assert.ok(belowThreshold.includes("הסף המתודולוגי הנדרש"));
  assert.ok(!atThreshold.includes("הסף המתודולוגי הנדרש"));
});
