import Link from "next/link";
import type { DashboardRoundOption } from "@/lib/dashboard/round-options";

type DashboardRoundSwitcherProps = {
  options: DashboardRoundOption[];
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
  if (options.length < 2) {
    return null;
  }

  return (
    <nav className="dashboard-round-switcher" aria-label="בחירת סבב אבחון">
      <ul>
        {options.map((option) => (
          <li key={option.id}>
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
        ))}
      </ul>
    </nav>
  );
}
