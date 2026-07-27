/**
 * The round audience has exactly one editable source: the setup screen.
 *
 * The questionnaire snapshot still carries an `audience` string because it is
 * shown to respondents and frozen with the round, but that string is derived
 * from this map instead of being typed a second time in the builder. Two
 * independently editable audiences is what made the setup and builder screens
 * disagree.
 */
export const AUDIENCE_OPTIONS = [
  { value: "all-staff", label: "כלל צוות בית הספר" },
  { value: "teachers", label: "צוות הוראה בלבד" },
  { value: "administration", label: "צוות מינהלה" },
] as const;

export type AudienceValue = (typeof AUDIENCE_OPTIONS)[number]["value"];

export const DEFAULT_AUDIENCE: AudienceValue = "all-staff";

/**
 * Turns the stored audience code into the wording respondents read. Unknown or
 * legacy values (including free text typed before this was unified) are passed
 * through so an existing round never loses what it already said.
 */
export function resolveAudienceLabel(audience: string | undefined): string {
  const normalized = audience?.trim();
  if (!normalized) {
    return AUDIENCE_OPTIONS[0].label;
  }

  const known = AUDIENCE_OPTIONS.find((option) => option.value === normalized);
  return known ? known.label : normalized;
}
