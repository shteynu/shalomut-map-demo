import assert from "node:assert";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ManagerHelpBoard } from "../manager-help-board";
import { helpTopicAnchor, managerHelpTopics } from "@/lib/help/manager-help";

test("every topic renders with the anchor another screen links to", () => {
  const topics = managerHelpTopics();
  const html = renderToStaticMarkup(<ManagerHelpBoard topics={topics} />);

  for (const topic of topics) {
    const anchor = helpTopicAnchor(topic.id);
    assert.ok(
      html.includes(`id="${anchor}"`),
      `${topic.id} is not addressable, so a link to it would land nowhere`,
    );
    assert.ok(html.includes(topic.title));
  }
});

test("the contents list offers every topic", () => {
  const topics = managerHelpTopics();
  const html = renderToStaticMarkup(<ManagerHelpBoard topics={topics} />);

  for (const topic of topics) {
    assert.ok(html.includes(`href="#${helpTopicAnchor(topic.id)}"`));
  }
});

test("each topic is a labelled section rather than a loose heading", () => {
  // The guide is long enough to be navigated by landmark, and a manager using a
  // screen reader should be able to jump between topics instead of reading
  // through them.
  const html = renderToStaticMarkup(
    <ManagerHelpBoard topics={managerHelpTopics().slice(0, 1)} />,
  );

  assert.match(html, /<section class="help-topic" id="help-privacy" aria-labelledby="help-privacy-title">/);
  assert.match(html, /<h2 id="help-privacy-title">/);
});
