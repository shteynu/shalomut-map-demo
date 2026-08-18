import assert from "node:assert";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ManagerHelpBadge } from "../manager-help-badge";
import { helpTopicAnchor, managerHelpTopics } from "@/lib/help/manager-help";
import { routes, shouldShowHelpBadge } from "@/lib/navigation";

test("the badge offers every topic and the whole guide", () => {
  const html = renderToStaticMarkup(<ManagerHelpBadge />);

  for (const topic of managerHelpTopics()) {
    assert.ok(
      html.includes(`href="/help#${helpTopicAnchor(topic.id)}"`),
      `${topic.id} is missing from the badge`,
    );
    assert.ok(html.includes(topic.title));
  }

  assert.ok(html.includes('href="/help"'));
});

test("the badge opens without JavaScript", () => {
  // A disclosure rather than a menu built on state: the round switcher already
  // established that a control here has to work with scripts off, and this one
  // is the way to the explanation of why a screen is behaving as it is.
  const html = renderToStaticMarkup(<ManagerHelpBadge />);

  assert.match(html, /<details class="help-badge">/);
  assert.match(html, /<summary[^>]*aria-label="[^"]+"/);
});

test("the badge stays away from the respondent and the login screens", () => {
  // A teacher answering the questionnaire is not the audience: this guide is
  // about running a round. The login screen has no session for its links.
  assert.strictEqual(shouldShowHelpBadge("/answer/ABC123"), false);
  assert.strictEqual(shouldShowHelpBadge(routes.login), false);
  assert.strictEqual(shouldShowHelpBadge(null), false);
});

test("the badge is on the dashboard, which has no header to carry it", () => {
  assert.strictEqual(shouldShowHelpBadge(routes.dashboard), true);
  assert.strictEqual(shouldShowHelpBadge("/dashboard/balance/metrics"), true);
  assert.strictEqual(shouldShowHelpBadge(routes.setup), true);
  assert.strictEqual(shouldShowHelpBadge(routes.home), true);
});
