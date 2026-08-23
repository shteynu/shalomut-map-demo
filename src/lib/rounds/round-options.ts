import type { RoundStatus, SurveyRoundSummary } from "../types/backend";

/**
 * What a screen needs to offer the school's rounds, and nothing more.
 *
 * The rounds themselves carry share codes, thresholds and questionnaire
 * snapshots; a switcher needs a label and an id, so only those cross into the
 * client component. Where choosing a round leads is the form's action, which
 * is the screen's own path, so it is one value for the whole list rather than
 * one per round.
 */
export type RoundSwitcherOption = {
  id: string;
  title: string;
  statusLabel: string;
  isSelected: boolean;
};

/**
 * The school's rounds in two groups (ADR-018): the ones a manager works with,
 * and the archive they filed away and can still open.
 */
export type RoundSwitcherOptions = {
  current: RoundSwitcherOption[];
  archived: RoundSwitcherOption[];
};

export const roundStatusLabels: Record<RoundStatus, string> = {
  draft: "טיוטה",
  active: "פעיל",
  closed: "סגור",
  archived: "בארכיון",
};

/**
 * Archiving a round takes it out of the everyday list; it does not take it
 * away. The archived rounds stay in the switcher as their own group, so
 * returning to an old semester never requires having kept its URL.
 *
 * The round on screen is the exception, and it has to be: a manager who
 * followed a link to an archived round would otherwise read a switcher naming
 * every round except the one they are looking at. It stays in the everyday
 * list, marked `בארכיון`, so the current position is announced.
 */
export function toRoundSwitcherOptions(
  // A summary, because a switcher renders a title and a status label. It used
  // to take whole rounds and the list arrived carrying every questionnaire.
  rounds: readonly SurveyRoundSummary[],
  selectedRoundId: string,
): RoundSwitcherOptions {
  const options = rounds.map((round) => ({
    round,
    option: {
      id: round.id,
      title: round.title,
      statusLabel: roundStatusLabels[round.status],
      isSelected: round.id === selectedRoundId,
    },
  }));

  return {
    current: options
      .filter(({ round, option }) => round.status !== "archived" || option.isSelected)
      .map(({ option }) => option),
    archived: options
      .filter(({ round, option }) => round.status === "archived" && !option.isSelected)
      .map(({ option }) => option),
  };
}
