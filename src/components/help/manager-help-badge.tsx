import Link from "next/link";
import { CircleHelp } from "lucide-react";
import { helpRoute, routeMetadata } from "@/lib/navigation";
import { helpTopicAnchor, managerHelpTopics } from "@/lib/help/manager-help";

/**
 * The guide, one press away from wherever the manager is standing.
 *
 * Built on `<details>` rather than on state, for the same reason the round
 * switcher submits a form: it has to work with JavaScript off. A disclosure
 * element opens, closes, takes focus and announces itself as a button to a
 * screen reader without a line of script, and the fallback for the one thing it
 * cannot do — closing when a click lands elsewhere — is that the manager presses
 * it again.
 *
 * It lists the topics rather than only linking to the screen because the
 * question a manager has is usually one of the seven, and a list that answers
 * "is my question in here" before the navigation costs a click is worth more
 * than a door with no sign on it.
 */
export function ManagerHelpBadge() {
  const topics = managerHelpTopics();

  return (
    <details className="help-badge">
      <summary aria-label={routeMetadata.help.navLabel}>
        <CircleHelp size={18} aria-hidden="true" />
        <span>{routeMetadata.help.navLabel}</span>
      </summary>

      <div className="help-badge-panel">
        <p className="help-badge-title">שאלות שהמסכים מעוררים</p>

        <ul>
          {topics.map((topic) => (
            <li key={topic.id}>
              <Link href={helpRoute(helpTopicAnchor(topic.id))}>
                {topic.title}
              </Link>
            </li>
          ))}
        </ul>

        <Link className="help-badge-all" href={helpRoute()}>
          {/* The whole screen, for a manager who would rather read than search. */}
          למדריך המלא
        </Link>
      </div>
    </details>
  );
}
