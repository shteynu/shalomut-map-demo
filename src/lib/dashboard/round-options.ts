import { dashboardMapRoute } from "../navigation";
import type { RoundStatus, SurveyRound } from "../types/backend";

/**
 * What the dashboard needs to offer the school's rounds, and nothing more.
 *
 * The rounds themselves carry share codes, thresholds and questionnaire
 * snapshots; a switcher needs a label and a link, so only those cross into the
 * client component.
 */
export type DashboardRoundOption = {
  id: string;
  title: string;
  statusLabel: string;
  href: string;
  isSelected: boolean;
};

/**
 * The school's rounds in two groups (ADR-018): the ones a manager works with,
 * and the archive they filed away and can still open.
 */
export type DashboardRoundOptions = {
  current: DashboardRoundOption[];
  archived: DashboardRoundOption[];
};

export const roundStatusLabels: Record<RoundStatus, string> = {
  draft: "טיוטה",
  active: "פעיל",
  closed: "סגור",
  archived: "בארכיון",
};

/**
 * Archiving a round takes it out of the everyday list; it does not take it
 * away. The archived rounds stay behind a disclosure the manager can open, so
 * returning to an old semester never requires having kept its URL.
 *
 * The round on screen is the exception, and it has to be: a manager who
 * followed a link to an archived round would otherwise read a switcher naming
 * every round except the one they are looking at. It stays in the everyday
 * list, marked `בארכיון`, so the current position is announced.
 */
export function toDashboardRoundOptions(
  rounds: SurveyRound[],
  selectedRoundId: string,
): DashboardRoundOptions {
  const options = rounds.map((round) => ({
    round,
    option: {
      id: round.id,
      title: round.title,
      statusLabel: roundStatusLabels[round.status],
      href: dashboardMapRoute(round.id),
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
