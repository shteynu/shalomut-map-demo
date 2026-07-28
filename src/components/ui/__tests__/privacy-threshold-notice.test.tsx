import assert from "node:assert";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  DEFAULT_PRIVACY_THRESHOLD,
  LOW_PRIVACY_THRESHOLD_WARNING,
  MINIMUM_PRIVACY_THRESHOLD,
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
    privacyThresholdNoticeText(MINIMUM_PRIVACY_THRESHOLD),
    null,
  );
  assert.strictEqual(
    privacyThresholdNoticeText(MINIMUM_PRIVACY_THRESHOLD + 5),
    null,
  );

  const text = privacyThresholdNoticeText(MINIMUM_PRIVACY_THRESHOLD - 1);
  assert.ok(text);
  assert.match(text, new RegExp(String(MINIMUM_PRIVACY_THRESHOLD)));
  assert.match(text, new RegExp(String(MINIMUM_PRIVACY_THRESHOLD - 1)));
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

test("the product default is itself compliant and says nothing", () => {
  // Ten is the default and the minimum now, so a manager who changes nothing
  // is already at the required threshold and needs no warning.
  assert.strictEqual(DEFAULT_PRIVACY_THRESHOLD, MINIMUM_PRIVACY_THRESHOLD);
  assert.strictEqual(
    privacyThresholdNoticeText(DEFAULT_PRIVACY_THRESHOLD),
    null,
  );
});

test("the reminder is Hebrew-only text and not colour alone", () => {
  const html = renderToStaticMarkup(
    <PrivacyThresholdNotice minimumResponses={3} emphasis="form" />,
  );

  assert.doesNotMatch(html.replace(/<[^>]*>/gu, ""), LATIN);
  assert.match(html, /role="status"/u);
  assert.ok(html.includes(String(MINIMUM_PRIVACY_THRESHOLD)));
});

test("the reminder renders nothing at a compliant threshold", () => {
  const html = renderToStaticMarkup(
    <PrivacyThresholdNotice
      minimumResponses={MINIMUM_PRIVACY_THRESHOLD}
      emphasis="form"
    />,
  );

  assert.strictEqual(html, "");
});

test("the round metric card explains its own threshold, not the required one", () => {
  // The card and the tooltip beside it used to disagree: the card showed the
  // round's threshold while the tooltip explained the product default.
  const html = renderToStaticMarkup(
    <MetricCard
      value="4"
      label="סף פרטיות"
      helper={`הגנה על אנונימיות — הסף הנדרש ${MINIMUM_PRIVACY_THRESHOLD}`}
      minimumResponses={4}
    />,
  );

  assert.ok(html.includes("בסבב הנוכחי: 4"));
  assert.ok(html.includes("הסף הנדרש"));
  assert.ok(html.includes(`הסף הנדרש ${MINIMUM_PRIVACY_THRESHOLD}`));
});

test("the privacy tooltip carries the reminder for the round it describes", () => {
  const belowThreshold = renderToStaticMarkup(
    <PrivacyTooltip minimumResponses={4} />,
  );
  const atThreshold = renderToStaticMarkup(
    <PrivacyTooltip minimumResponses={MINIMUM_PRIVACY_THRESHOLD} />,
  );

  assert.ok(belowThreshold.includes("הסף הנדרש"));
  assert.ok(!atThreshold.includes("הסף הנדרש"));
});
