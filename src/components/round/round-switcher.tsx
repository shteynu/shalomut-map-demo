import Link from "next/link";
import type {
  RoundSwitcherOption,
  RoundSwitcherOptions,
} from "@/lib/rounds/round-options";

type RoundSwitcherProps = {
  options: RoundSwitcherOptions;
  /**
   * The map centres its sidebar column; the ordinary manager screens read from
   * the start of the line like everything else on them.
   */
  align?: "start" | "center";
};

/**
 * The school's rounds, as links.
 *
 * Links rather than a select: switching rounds is a navigation, it must work
 * without JavaScript, and each round keeps a URL a manager can return to. The
 * selected round stays in the list as a non-link so the current position is
 * announced rather than only coloured.
 *
 * Every manager screen that shows one round's numbers renders this, so opening
 * a new round never puts the previous one out of reach.
 */
export function RoundSwitcher({ options, align = "start" }: RoundSwitcherProps) {
  const { current, archived } = options;

  if (current.length + archived.length < 2) {
    return null;
  }

  return (
    <nav
      className={`round-switcher round-switcher-${align}`}
      aria-label="בחירת סבב אבחון"
    >
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
        <details className="round-switcher-archive">
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

function RoundOptionItem({ option }: { option: RoundSwitcherOption }) {
  return (
    <li>
      {option.isSelected ? (
        <span className="round-switcher-option is-selected" aria-current="page">
          <strong>{option.title}</strong>
          <span className="round-switcher-option-status">
            {option.statusLabel}
          </span>
        </span>
      ) : (
        <Link className="round-switcher-option" href={option.href}>
          <strong>{option.title}</strong>
          <span className="round-switcher-option-status">
            {option.statusLabel}
          </span>
        </Link>
      )}
    </li>
  );
}
