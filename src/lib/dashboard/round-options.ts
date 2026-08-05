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

/**
 * Archiving a round means taking it out of the everyday list, and that is the
 * only thing it means (ADR-018). The round keeps its URL, its dashboard and its
 * place in the comparison history; it stops being one of the choices offered
 * here.
 *
 * The selected round is the exception, and it has to be: a manager who followed
 * a link to an archived round would otherwise read a switcher that names every
 * round except the one on screen.
 */
function belongsInSwitcher(round: SurveyRound, selectedRoundId: string): boolean {
  return round.status !== "archived" || round.id === selectedRoundId;
}

export function toDashboardRoundOptions(
  rounds: SurveyRound[],
  selectedRoundId: string,
): DashboardRoundOption[] {
  return rounds
    .filter((round) => belongsInSwitcher(round, selectedRoundId))
    .map((round) => ({
      id: round.id,
      title: round.title,
      statusLabel: roundStatusLabels[round.status],
      href: dashboardMapRoute(round.id),
      isSelected: round.id === selectedRoundId,
    }));
}
