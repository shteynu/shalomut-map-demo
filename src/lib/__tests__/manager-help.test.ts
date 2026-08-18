import assert from "node:assert";
import { test } from "node:test";
import {
  HELP_LOCALES,
  DEFAULT_HELP_LOCALE,
  helpTopicAnchor,
  managerHelpIntro,
  managerHelpTopics,
  readHelpLocaleParam,
  type HelpTopicId,
} from "../help/manager-help";
import { goalActionLabels } from "../goals/labels";
import { scoringThresholds, statusColorLabels } from "../shalomut-source";
import { MINIMUM_PRIVACY_THRESHOLD } from "../survey-definition";

/**
 * The guide is product copy that states the product's own rules, so the thing
 * worth testing is not the wording but the derivation: every number it puts in
 * front of a manager has to come from the module that enforces it. A guide that
 * can drift is worse than no guide, because it drifts silently and in the
 * product's own voice — and now in three languages at once.
 */

test("every topic is complete and addressable, in every language", () => {
  for (const locale of HELP_LOCALES) {
    const topics = managerHelpTopics(locale);
    assert.ok(topics.length > 0);

    const ids = new Set<HelpTopicId>();
    for (const topic of topics) {
      assert.ok(topic.title.trim().length > 0, `${locale}/${topic.id} needs a title`);
      assert.ok(topic.summary.trim().length > 0, `${locale}/${topic.id} needs a summary`);
      assert.ok(topic.points.length > 0, `${locale}/${topic.id} needs a point`);
      assert.ok(
        topic.points.every((point) => point.trim().length > 0),
        `${locale}/${topic.id} has an empty point`,
      );

      assert.ok(!ids.has(topic.id), `duplicate topic id ${topic.id} in ${locale}`);
      ids.add(topic.id);
    }

    const anchors = topics.map((topic) => helpTopicAnchor(topic.id));
    assert.strictEqual(new Set(anchors).size, anchors.length);
  }
});

test("the translations cover the same topics in the same order", () => {
  // A link carries an anchor, not a language, so `#help-privacy` has to be the
  // privacy answer in all three. A translation that dropped or reordered a
  // topic would send a reader to the wrong one rather than to nothing.
  const reference = managerHelpTopics(DEFAULT_HELP_LOCALE).map((topic) => topic.id);

  for (const locale of HELP_LOCALES) {
    assert.deepStrictEqual(
      managerHelpTopics(locale).map((topic) => topic.id),
      reference,
      `${locale} does not match the Hebrew topic set`,
    );
  }
});

test("every language quotes the threshold the product enforces", () => {
  for (const locale of HELP_LOCALES) {
    const privacy = managerHelpTopics(locale).find((topic) => topic.id === "privacy");
    assert.ok(privacy);

    const text = [privacy.summary, ...privacy.points].join(" ");
    assert.ok(
      text.includes(String(MINIMUM_PRIVACY_THRESHOLD)),
      `${locale} must quote MINIMUM_PRIVACY_THRESHOLD rather than a literal of its own`,
    );
  }
});

test("every language quotes every band from the scoring manifest", () => {
  for (const locale of HELP_LOCALES) {
    const colors = managerHelpTopics(locale).find((topic) => topic.id === "colors");
    assert.ok(colors);

    const text = colors.points.join(" ");
    for (const band of scoringThresholds) {
      assert.ok(
        text.includes(String(band.min)) && text.includes(String(band.max)),
        `${locale} does not state the ${band.status} range from the manifest`,
      );
    }
  }
});

test("the Hebrew colours come from the map's own words", () => {
  // Only Hebrew: those three words are rendered on the map itself, so a copy
  // here could drift from what a manager sees. The Russian and English words
  // exist nowhere else in the product and have nothing to drift from.
  const colors = managerHelpTopics("he").find((topic) => topic.id === "colors");
  assert.ok(colors);

  const text = colors.points.join(" ");
  for (const band of scoringThresholds) {
    assert.ok(text.includes(statusColorLabels[band.status]));
  }
});

test("every language names the remove control by the label the button renders", () => {
  // The button on screen is Hebrew whichever language the guide is read in, so
  // a translated button name would send a manager looking for a control that
  // does not exist.
  for (const locale of HELP_LOCALES) {
    const goals = managerHelpTopics(locale).find((topic) => topic.id === "goals");
    assert.ok(goals);

    assert.ok(
      goals.points.some((point) => point.includes(goalActionLabels.remove)),
      `${locale} must quote goalActionLabels.remove rather than a copy of it`,
    );
  }
});

test("the guide keeps the product's own boundaries, in every language", () => {
  for (const locale of HELP_LOCALES) {
    const intro = managerHelpIntro(locale);
    const everything = [
      intro.title,
      intro.description,
      ...managerHelpTopics(locale).flatMap((topic) => [
        topic.title,
        topic.summary,
        ...topic.points,
      ]),
    ].join(" ");

    // The audience is a principal. Naming hosting providers, queue internals or
    // contract versions here would be the operational handbook leaking into a
    // product surface — `docs/platform-handbook.md` is where that reader is.
    for (const forbidden of [
      "Render",
      "Vercel",
      "Supabase",
      "Gemini",
      "FastAPI",
      "leaseToken",
      "heartbeat",
    ]) {
      assert.ok(
        !everything.includes(forbidden),
        `the ${locale} guide must not mention ${forbidden}`,
      );
    }
  }
});

test("the AI topic says what the model cannot decide", () => {
  const ai = managerHelpTopics("he").find((topic) => topic.id === "ai");
  assert.ok(ai);

  // ADR-007: copy the service wrote may be shown, but never as the model's.
  // The guide is where a manager learns that the disclosure on the dimension
  // screen means what it says, so losing this point would leave that label
  // unexplained.
  const text = [ai.summary, ...ai.points].join(" ");
  assert.ok(text.includes("הבינה המלאכותית"));
  assert.ok(
    ai.points.some((point) => point.includes("לא נכתב")),
    "the guide must explain the not-written-by-AI disclosure",
  );
});

test("an unreadable language parameter is Hebrew rather than an error", () => {
  // This is the screen someone opens when something else did not explain
  // itself. Refusing to render it because a link was mistyped would withhold
  // the explanation exactly when it is wanted.
  assert.strictEqual(readHelpLocaleParam({}), DEFAULT_HELP_LOCALE);
  assert.strictEqual(readHelpLocaleParam({ lang: "de" }), DEFAULT_HELP_LOCALE);
  assert.strictEqual(readHelpLocaleParam({ lang: "" }), DEFAULT_HELP_LOCALE);
  assert.strictEqual(readHelpLocaleParam({ lang: "ru" }), "ru");
  assert.strictEqual(readHelpLocaleParam({ lang: ["en", "ru"] }), "en");
});

test("every language has its own screen copy", () => {
  const seen = new Set<string>();

  for (const locale of HELP_LOCALES) {
    const intro = managerHelpIntro(locale);
    for (const value of [
      intro.eyebrow,
      intro.title,
      intro.description,
      intro.badgeTitle,
      intro.wholeGuide,
      intro.languageLabel,
    ]) {
      assert.ok(value.trim().length > 0, `${locale} intro is incomplete`);
    }

    assert.ok(!seen.has(intro.title), `${locale} reuses another language's title`);
    seen.add(intro.title);
  }
});
