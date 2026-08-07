import type { Organization } from "../types/backend";

/**
 * What a screen needs to offer the schools, and nothing more.
 *
 * An organization carries its city, its staff count and its rounds; a switcher
 * needs a label and an id, so only those cross into the client component. The
 * city is part of the label rather than a field of its own — two schools in a
 * chain share a name often enough that the name alone would not tell them
 * apart, and a select has one line per option to say it in.
 */
export type SchoolSwitcherOption = {
  id: string;
  label: string;
  isSelected: boolean;
};

/**
 * The schools, in the order a manager reads them: by name, so the list stays
 * where they last saw it as schools are added, rather than by creation time,
 * which reorders the whole list every time one is opened.
 */
export function toSchoolSwitcherOptions(
  organizations: Organization[],
  selectedOrganizationId: string | null | undefined,
): SchoolSwitcherOption[] {
  return [...organizations]
    .sort((left, right) => left.name.localeCompare(right.name, "he"))
    .map((organization) => ({
      id: organization.id,
      label: organization.city
        ? `${organization.name} — ${organization.city}`
        : organization.name,
      isSelected: organization.id === selectedOrganizationId,
    }));
}
