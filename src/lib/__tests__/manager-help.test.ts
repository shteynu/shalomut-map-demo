import assert from "node:assert";
import { test } from "node:test";
import {
  helpTopicAnchor,
  managerHelpTopics,
  type HelpTopicId,
} from "../help/manager-help";
import { scoringThresholds, statusColorLabels } from "../shalomut-source";
import { MINIMUM_PRIVACY_THRESHOLD } from "../survey-definition";

/**
 * The guide is product copy that states the product's own rules, so the thing
 * worth testing is not the wording but the derivation: every number it puts in
 * front of a manager has to come from the module that enforces it. A guide that
 * can drift is worse than no guide, because it drifts silently and in the
 * product's own voice.
 */

test("every topic is complete and addressable", () => {
  const topics = managerHelpTopics();
  assert.ok(topics.length > 0);

  const ids = new Set<HelpTopicId>();
  for (const topic of topics) {
    assert.ok(topic.title.trim().length > 0, `${topic.id} needs a title`);
    assert.ok(topic.summary.trim().length > 0, `${topic.id} needs a summary`);
    assert.ok(topic.points.length > 0, `${topic.id} needs at least one point`);
    assert.ok(
      topic.points.every((point) => point.trim().length > 0),
      `${topic.id} has an empty point`,
    );

    assert.ok(!ids.has(topic.id), `duplicate topic id ${topic.id}`);
    ids.add(topic.id);
  }

  const anchors = topics.map((topic) => helpTopicAnchor(topic.id));
  assert.strictEqual(new Set(anchors).size, anchors.length);
});

test("the privacy topic states the threshold the product actually enforces", () => {
  const privacy = managerHelpTopics().find((topic) => topic.id === "privacy");
  assert.ok(privacy);

  const text = [privacy.summary, ...privacy.points].join(" ");
  assert.ok(
    text.includes(String(MINIMUM_PRIVACY_THRESHOLD)),
    "the guide must quote MINIMUM_PRIVACY_THRESHOLD rather than a literal of its own",
  );
});

test("the colours topic quotes every band from the scoring manifest", () => {
  const colors = managerHelpTopics().find((topic) => topic.id === "colors");
  assert.ok(colors);

  const text = colors.points.join(" ");
  for (const band of scoringThresholds) {
    assert.ok(
      text.includes(statusColorLabels[band.status]),
      `the guide does not name the ${band.status} band`,
    );
    assert.ok(
      text.includes(String(band.min)) && text.includes(String(band.max)),
      `the guide does not state the ${band.status} range from the manifest`,
    );
  }
});

test("the guide keeps the product's own boundaries", () => {
  const topics = managerHelpTopics();
  const everything = topics
    .flatMap((topic) => [topic.title, topic.summary, ...topic.points])
    .join(" ");

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
      `the manager guide must not mention ${forbidden}`,
    );
  }
});

test("the AI topic says what the model cannot decide", () => {
  const ai = managerHelpTopics().find((topic) => topic.id === "ai");
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
