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
