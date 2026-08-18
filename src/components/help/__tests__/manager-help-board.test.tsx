import assert from "node:assert";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ManagerHelpBoard } from "../manager-help-board";
import {
  helpTopicAnchor,
  managerHelpIntro,
  managerHelpTopics,
} from "@/lib/help/manager-help";
import { HELP_LOCALES, helpLocaleDir } from "@/lib/help/locales";

/**
 * React escapes what it renders, so an English title carrying an apostrophe
 * reaches the markup as `&#x27;`. Comparing raw copy against rendered HTML is
 * the mistake this makes once; escaping the expectation is the fix that keeps
 * the assertion about the content rather than about the encoder.
 */
function asRendered(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

function render(locale: (typeof HELP_LOCALES)[number] = "he") {
  return renderToStaticMarkup(
    <ManagerHelpBoard
      topics={managerHelpTopics(locale)}
      intro={managerHelpIntro(locale)}
      locale={locale}
    />,
  );
}

test("every topic renders with the anchor another screen links to", () => {
  for (const locale of HELP_LOCALES) {
    const html = render(locale);

    for (const topic of managerHelpTopics(locale)) {
      const anchor = helpTopicAnchor(topic.id);
      assert.ok(
        html.includes(`id="${anchor}"`),
        `${topic.id} is not addressable in ${locale}, so a link to it would land nowhere`,
      );
      assert.ok(html.includes(asRendered(topic.title)));
    }
  }
});

test("the contents list offers every topic", () => {
  const html = render();

  for (const topic of managerHelpTopics()) {
    assert.ok(html.includes(`href="#${helpTopicAnchor(topic.id)}"`));
  }
});

test("each topic is a labelled section rather than a loose heading", () => {
  // The guide is long enough to be navigated by landmark, and a manager using a
  // screen reader should be able to jump between topics instead of reading
  // through them.
  const html = renderToStaticMarkup(
    <ManagerHelpBoard
      topics={managerHelpTopics().slice(0, 1)}
      intro={managerHelpIntro()}
      locale="he"
    />,
  );

  assert.match(html, /<section class="help-topic" id="help-privacy" aria-labelledby="help-privacy-title">/);
  assert.match(html, /<h2 id="help-privacy-title">/);
});

test("a translation states its own language and direction", () => {
  // The document is `lang="he" dir="rtl"`. A translation that inherited that
  // would render its punctuation at the wrong end of every sentence.
  for (const locale of HELP_LOCALES) {
    const html = render(locale);

    assert.ok(
      html.includes(`lang="${locale}" dir="${helpLocaleDir[locale]}"`),
      `${locale} does not declare its own direction`,
    );
  }
});

test("the switcher offers the other two languages and marks the current one", () => {
  const html = render("ru");

  assert.ok(html.includes('href="/help"'), "Hebrew is the parameterless link");
  assert.ok(html.includes('href="/help?lang=en"'));
  assert.ok(html.includes('aria-current="true"'));
});
