import { helpTopicAnchor, type HelpTopic } from "@/lib/help/manager-help";

/**
 * The manager guide, rendered.
 *
 * A server component with no state and no interactivity on purpose: this is the
 * screen a manager opens when something else did not explain itself, so it must
 * work with JavaScript off and be readable by a screen reader in one pass. The
 * table of contents is plain anchors for the same reason.
 */
export function ManagerHelpBoard({ topics }: { topics: HelpTopic[] }) {
  return (
    <div className="help-board">
      <nav className="help-contents" aria-label="נושאי המדריך">
        <ul>
          {topics.map((topic) => (
            <li key={topic.id}>
              <a href={`#${helpTopicAnchor(topic.id)}`}>{topic.title}</a>
            </li>
          ))}
        </ul>
      </nav>

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
