"use client";

import { DASHBOARD_ROUND_PARAM } from "@/lib/navigation";
import type {
  RoundSwitcherOption,
  RoundSwitcherOptions,
} from "@/lib/rounds/round-options";

type RoundSwitcherProps = {
  options: RoundSwitcherOptions;
  /**
   * Where the form posts when there is no JavaScript. It is the screen's own
   * path, so choosing a round stays on the screen the manager is reading.
   */
  action: string;
  /**
   * The map centres its sidebar column; the ordinary manager screens read from
   * the start of the line like everything else on them.
   */
  align?: "start" | "center";
};

/**
 * The school's rounds, as one select.
 *
 * It was a row of links, one chip per round, which reads well at three rounds
 * and becomes a wall at twenty — a school runs two to four a year and never
 * deletes one. A select stays one line however long the history gets.
 *
 * It is still a navigation, and it still works without JavaScript: the select
 * sits in a `GET` form whose action is the current screen and whose parameter
 * is the same `round` every screen already reads, so submitting it produces
 * exactly the URL the chips used to link to. With JavaScript the choice
 * submits on change; without it, the button inside `noscript` is the way
 * through. Either way each round keeps a URL a manager can return to.
 */
export function RoundSwitcher({
  options,
  action,
  align = "start",
}: RoundSwitcherProps) {
  const { current, archived } = options;
  const all = [...current, ...archived];
  const selected = all.find((option) => option.isSelected);

  if (all.length < 2) {
    return null;
  }

  return (
    <form
      className={`round-switcher round-switcher-${align}`}
      method="get"
      action={action}
    >
      <label htmlFor="round-switcher-select">סבב אבחון</label>
      <select
        id="round-switcher-select"
        name={DASHBOARD_ROUND_PARAM}
        value={selected?.id ?? ""}
        /*
         * Submitting the form the manager is already standing in, rather than
         * pushing a route: it is the same navigation the button performs, so
         * there is one path through this component instead of two, and the
         * screen arrives built for the round it is about.
         */
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
      >
        {current.map((option) => (
          <RoundOption key={option.id} option={option} />
        ))}

        {archived.length > 0 ? (
          /*
           * The archive is a group inside the same list rather than a place to
           * open: a select shows its groups without being asked, which is what
           * the `details` disclosure used to have to do by hand.
           */
          <optgroup label={`ארכיון (${archived.length})`}>
            {archived.map((option) => (
              <RoundOption key={option.id} option={option} />
            ))}
          </optgroup>
        ) : null}
      </select>

      {/*
        The way through when the change handler above cannot run. `noscript`
        renders its contents only when scripting is off, so the button is a
        real submit button for exactly the readers who need it and absent for
        everyone else, with no state to keep in step.
      */}
      <noscript>
        <button className="secondary-button" type="submit">
          מעבר
        </button>
      </noscript>
    </form>
  );
}

/**
 * The status is part of the option's text. A select cannot carry a second
 * element per row, and the status was never allowed to be colour alone.
 */
function RoundOption({ option }: { option: RoundSwitcherOption }) {
  return (
    <option value={option.id}>
      {option.title} — {option.statusLabel}
    </option>
  );
}
