import Link from "next/link";
import { CircleHelp } from "lucide-react";
import { helpRoute, routeMetadata } from "@/lib/navigation";
import {
  helpTopicAnchor,
  managerHelpIntro,
  managerHelpTopics,
} from "@/lib/help/manager-help";
import { DEFAULT_HELP_LOCALE } from "@/lib/help/locales";
import { HelpLanguageSwitcher } from "@/components/help/help-language-switcher";

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
 *
 * The badge itself is always Hebrew, in every screen and for every reader. It is
 * part of the product, and the product has one language; the three links at the
 * top of the panel open the *guide* in a language, which is a document rather
 * than a screen a manager works in.
 */
export function ManagerHelpBadge() {
  const intro = managerHelpIntro(DEFAULT_HELP_LOCALE);
  const topics = managerHelpTopics(DEFAULT_HELP_LOCALE);

  return (
    <details className="help-badge">
      <summary aria-label={routeMetadata.help.navLabel}>
        <CircleHelp size={18} aria-hidden="true" />
        <span>{routeMetadata.help.navLabel}</span>
      </summary>

      <div className="help-badge-panel">
        <div className="help-badge-head">
          <p className="help-badge-title">{intro.badgeTitle}</p>
          <HelpLanguageSwitcher
            current={DEFAULT_HELP_LOCALE}
            label={intro.languageLabel}
            compact
          />
        </div>

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
          {intro.wholeGuide}
        </Link>
      </div>
    </details>
  );
}
