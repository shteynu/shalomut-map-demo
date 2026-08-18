import { helpTopicAnchor } from "@/lib/help/manager-help";
import { helpLocaleDir, type HelpLocale } from "@/lib/help/locales";
import type { HelpIntro, HelpTopic } from "@/lib/help/types";
import { HelpLanguageSwitcher } from "@/components/help/help-language-switcher";

/**
 * The manager guide, rendered.
 *
 * A server component with no state and no interactivity on purpose: this is the
 * screen a manager opens when something else did not explain itself, so it must
 * work with JavaScript off and be readable by a screen reader in one pass. The
 * table of contents is plain anchors for the same reason.
 */
export function ManagerHelpBoard({
  topics,
  intro,
  locale,
}: {
  topics: HelpTopic[];
  intro: HelpIntro;
  locale: HelpLocale;
}) {
  return (
    // The document is Hebrew and right-to-left. A translation that did not say
    // otherwise would render with its punctuation at the wrong end and its
    // lists indented from the wrong side, so the container carries both.
    <div className="help-board" lang={locale} dir={helpLocaleDir[locale]}>
      <div className="help-board-head">
        <nav className="help-contents" aria-label={intro.badgeTitle}>
          <ul>
            {topics.map((topic) => (
              <li key={topic.id}>
                <a href={`#${helpTopicAnchor(topic.id)}`}>{topic.title}</a>
              </li>
            ))}
          </ul>
        </nav>

        {/* Once, at the top, and deliberately not under every topic: seven
            language switchers would be seven navigation landmarks between a
            screen reader and the answer it came for. The contents list above is
            how a reader gets back to where they were. */}
        <HelpLanguageSwitcher current={locale} label={intro.languageLabel} />
      </div>

      <div className="help-topics">
        {topics.map((topic) => (
          <HelpTopicPanel key={topic.id} topic={topic} />
        ))}
      </div>
    </div>
  );
}

function HelpTopicPanel({ topic }: { topic: HelpTopic }) {
  const anchor = helpTopicAnchor(topic.id);

  return (
    // `scroll-margin-top` on the section rather than the heading, so a topic
    // opened by anchor does not land under the sticky header.
    <section className="help-topic" id={anchor} aria-labelledby={`${anchor}-title`}>
      <h2 id={`${anchor}-title`}>{topic.title}</h2>
      <p className="help-topic-summary">{topic.summary}</p>
      <ul className="help-topic-points">
        {topic.points.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
    </section>
  );
}
