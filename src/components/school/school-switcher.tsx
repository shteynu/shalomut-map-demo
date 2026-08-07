"use client";

import { NEW_SCHOOL_PARAM, SETUP_SCHOOL_PARAM, routes } from "@/lib/navigation";
import type { SchoolSwitcherOption } from "@/lib/schools/school-options";

type SchoolSwitcherProps = {
  options: SchoolSwitcherOption[];
  /** Whether the screen is opening a school the system does not have yet. */
  isNewSchool?: boolean;
};

/**
 * The schools, as one select.
 *
 * It is the round switcher's shape for the same reason: a list that only grows
 * and is read one line at a time. What differs is where the choice reaches. A
 * round is chosen per screen and travels in the URL; a school is chosen once
 * here, and every other screen — the map, the goals, the builder, the round
 * tracking — is read inside it afterwards, because the choice is remembered and
 * scopes the request. That is why this select is on this screen alone.
 *
 * A system with one school has nothing to choose, so nothing is rendered: the
 * screen a manager already knows does not grow a control that can only name
 * where they are. The exception is the moment a second school is being opened,
 * when the select is the way back to the first one.
 *
 * It works without JavaScript. The select sits in a `GET` form whose action is
 * the setup screen and whose parameter is `school`, so submitting it produces a
 * URL a manager can return to; with JavaScript the choice submits on change.
 */
export function SchoolSwitcher({
  options,
  isNewSchool = false,
}: SchoolSwitcherProps) {
  if (options.length < 2 && !(isNewSchool && options.length > 0)) {
    return null;
  }

  const selected = options.find((option) => option.isSelected);

  return (
    <form className="school-switcher" method="get" action={routes.setup}>
      <label htmlFor="school-switcher-select">בית ספר</label>
      <select
        id="school-switcher-select"
        name={SETUP_SCHOOL_PARAM}
        value={isNewSchool ? NEW_SCHOOL_PARAM : (selected?.id ?? "")}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
      >
        {/*
          The school being opened is in the list only while it is being opened.
          Otherwise the select would offer "a new school" as a permanent row,
          and this is a list of the schools that exist.
        */}
        {isNewSchool ? (
          <option value={NEW_SCHOOL_PARAM}>בית ספר חדש</option>
        ) : null}

        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>

      {/*
        The way through when the change handler above cannot run. `noscript`
        renders its contents only when scripting is off, so the button is a real
        submit button for exactly the readers who need it.
      */}
      <noscript>
        <button className="secondary-button" type="submit">
          מעבר
        </button>
      </noscript>
    </form>
  );
}
