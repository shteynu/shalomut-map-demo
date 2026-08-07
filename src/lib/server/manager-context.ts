import { connection } from "next/server";
import { headers } from "next/headers";
import { resolveCoreRepositories } from "@/lib/composition-root";
import {
  comparableRoundsBefore,
  toRoundComparison,
  type RoundComparison,
} from "@/lib/dashboard/round-comparison";
import { AnalyticsService, ManagerContextService } from "@/lib/services";
import type { ManagerContext } from "@/lib/services";
import { MANAGER_ORGANIZATION_HEADER } from "@/lib/server/manager-scope";

export async function loadManagerContext(roundId?: string) {
  await connection();
  const { orgRepo, roundRepo, surveyRepo } = resolveCoreRepositories();
  const requestHeaders = await headers();
  const organizationId =
    requestHeaders.get(MANAGER_ORGANIZATION_HEADER)?.trim() || undefined;

  return ManagerContextService.load(
    orgRepo,
    roundRepo,
    surveyRepo,
    organizationId,
    roundId?.trim() || undefined,
  );
}

/**
 * Every school the system has.
 *
 * One extra read, and only the setup screen asks for it: it is the one screen
 * that can change which school the manager is in, so it is the only one that
 * needs the list. The other screens are already scoped to the chosen school and
 * would pay for a query they never render.
 */
export async function loadSchools() {
  await connection();
  const { orgRepo } = resolveCoreRepositories();
  return orgRepo.findAll();
}

/**
 * The goals of every round this school has run.
 *
 * One extra read, and only the goals screen asks for it. The rounds come from
 * the context, which resolved them inside the manager's own organization, so a
 * goal is still never reached without naming a round the manager owns.
 */
export async function loadSchoolGoals(context: ManagerContext) {
  if (context.rounds.length === 0) return [];

  const { roundGoalRepo } = resolveCoreRepositories();
  return roundGoalRepo.findByRoundIds(context.rounds.map((round) => round.id));
}

/**
 * How many earlier rounds are read before giving up on a comparison. A school
 * that abandoned three rounds in a row is not waiting for a fourth lookup, and
 * this keeps one dashboard render from turning into a walk of the whole history.
 */
const COMPARISON_LOOKBACK = 3;

/**
 * The previous round's numbers for the round already loaded.
 *
 * These are extra reads, so only the screen that shows the comparison asks for
 * them — the round-tracking and builder screens have no use for the comparison
 * and should not pay for it.
 *
 * The nearest earlier round can be one that never reached its privacy threshold,
 * which is a round with no numbers rather than a round with bad numbers. The
 * walk continues past it, and whichever round is used is named on screen.
 */
export async function loadRoundComparison(
  context: ManagerContext,
): Promise<RoundComparison | null> {
  if (!context.selectedRound || !context.analytics) return null;

  const candidates = comparableRoundsBefore(
    context.selectedRound,
    context.rounds,
  ).slice(0, COMPARISON_LOOKBACK);
  if (candidates.length === 0) return null;

  const { roundRepo, surveyRepo } = resolveCoreRepositories();

  for (const candidate of candidates) {
    const previous = await AnalyticsService.getAnalyticsForRound(
      candidate.id,
      roundRepo,
      surveyRepo,
    );
    const comparison = toRoundComparison(context.analytics, candidate, previous);
    if (comparison) return comparison;
  }

  return null;
}
