import { dimensionPresentations } from "../dashboard/dimension-presentation";
import type { RoundGoal, RoundGoalStatus } from "../types/round-goal";
import type { SurveyRound } from "../types/backend";

export interface SchoolGoalRow {
  id: string;
  roundId: string;
  roundTitle: string;
  /** `בארכיון` and the like, so a goal says where it came from. */
  roundStatus: SurveyRound["status"];
  dimensionId: string;
  dimensionLabel: string;
  title: string;
  body: string;
  status: RoundGoalStatus;
}

export interface SchoolGoalsView {
  /** Chosen or being worked on: what the school still owes itself. */
  open: SchoolGoalRow[];
  done: SchoolGoalRow[];
}

// The name a stone carries on the map, so a goal is named by the same word
// the manager saw when they chose it.
const DIMENSION_LABELS = new Map(
  dimensionPresentations.map((dimension) => [
    dimension.id,
    dimension.conceptLabel,
  ]),
);

/**
 * Every goal the school is tracking, across every round it has run.
 *
 * A goal belongs to the round it was chosen in, and until now that round was
 * the only place it could be read. That was already awkward for a school with
 * several rounds, and it became a real gap once an archived round moved behind
 * a disclosure: a goal chosen last spring stayed alive — an archived round's
 * goals are deliberately not frozen — with nowhere convenient to see it.
 *
 * Open goals come first and finished ones follow, because the question this
 * screen answers is "what are we working on", not "what have we done". Inside
 * each group the newest round leads, since that is the order a manager reads
 * rounds in everywhere else.
 */
export function buildSchoolGoalsView(
  rounds: SurveyRound[],
  goals: RoundGoal[],
): SchoolGoalsView {
  const roundsById = new Map(rounds.map((round) => [round.id, round]));
  // The order `rounds` arrives in is the manager's reading order, and it is the
  // one this screen inherits rather than re-deriving.
  const roundOrder = new Map(rounds.map((round, index) => [round.id, index]));

  const rows = goals
    .filter((goal) => roundsById.has(goal.roundId))
    .map((goal) => {
      const round = roundsById.get(goal.roundId)!;
      return {
        id: goal.id,
        roundId: goal.roundId,
        roundTitle: round.title,
        roundStatus: round.status,
        dimensionId: goal.dimensionId,
        dimensionLabel: DIMENSION_LABELS.get(goal.dimensionId) ?? goal.dimensionId,
        title: goal.title,
        body: goal.body,
        status: goal.status,
      } satisfies SchoolGoalRow;
    })
    .sort(
      (left, right) =>
        (roundOrder.get(left.roundId) ?? 0) - (roundOrder.get(right.roundId) ?? 0),
    );

  return {
    open: rows.filter((row) => row.status !== "done"),
    done: rows.filter((row) => row.status === "done"),
  };
}
