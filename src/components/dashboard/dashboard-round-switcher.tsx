import Link from "next/link";
import type {
  DashboardRoundOption,
  DashboardRoundOptions,
} from "@/lib/dashboard/round-options";

type DashboardRoundSwitcherProps = {
  options: DashboardRoundOptions;
};

/**
 * The school's rounds, as links.
 *
 * Links rather than a select: switching rounds is a navigation, it must work
 * without JavaScript, and each round keeps a URL a manager can return to. The
 * selected round stays in the list as a non-link so the current position is
 * announced rather than only coloured.
 */
export function DashboardRoundSwitcher({ options }: DashboardRoundSwitcherProps) {
  const { current, archived } = options;

  if (current.length + archived.length < 2) {
    return null;
  }

  return (
    <nav className="dashboard-round-switcher" aria-label="בחירת סבב אבחון">
      <ul>
        {current.map((option) => (
          <RoundOptionItem key={option.id} option={option} />
        ))}
      </ul>

      {archived.length > 0 ? (
        /*
         * `details` rather than a toggle: the archive has to open without
         * JavaScript, for the same reason the rounds are links.
         */
        <details className="dashboard-round-archive">
          <summary>הצגת הארכיון ({archived.length})</summary>
          <ul>
            {archived.map((option) => (
              <RoundOptionItem key={option.id} option={option} />
            ))}
          </ul>
        </details>
      ) : null}
    </nav>
  );
}

function RoundOptionItem({ option }: { option: DashboardRoundOption }) {
  return (
    <li>
      {option.isSelected ? (
        <span className="dashboard-round-option is-selected" aria-current="page">
          <strong>{option.title}</strong>
          <span className="dashboard-round-option-status">
            {option.statusLabel}
          </span>
        </span>
      ) : (
        <Link className="dashboard-round-option" href={option.href}>
          <strong>{option.title}</strong>
          <span className="dashboard-round-option-status">
            {option.statusLabel}
          </span>
        </Link>
      )}
    </li>
  );
}
