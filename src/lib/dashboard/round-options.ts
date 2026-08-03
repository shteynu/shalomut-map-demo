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

export const roundStatusLabels: Record<RoundStatus, string> = {
  draft: "טיוטה",
  active: "פעיל",
  closed: "סגור",
  archived: "בארכיון",
};

export function toDashboardRoundOptions(
  rounds: SurveyRound[],
  selectedRoundId: string,
): DashboardRoundOption[] {
  return rounds.map((round) => ({
    id: round.id,
    title: round.title,
    statusLabel: roundStatusLabels[round.status],
    href: dashboardMapRoute(round.id),
    isSelected: round.id === selectedRoundId,
  }));
}
