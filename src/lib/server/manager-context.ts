import { connection } from "next/server";
import { headers } from "next/headers";
import { resolveCoreRepositories } from "@/lib/composition-root";
import {
  comparableRoundsBefore,
  toRoundComparison,
  type RoundComparison,
} from "@/lib/dashboard/round-comparison";
import {
  AnalyticsService,
  ManagerContextService,
  SurveyFunnelService,
} from "@/lib/services";
import type { ManagerContext } from "@/lib/services";
import { MANAGER_ORGANIZATION_HEADER } from "@/lib/server/manager-scope";
import {
  toSchoolSwitcherOptions,
  type SchoolChoices,
} from "@/lib/schools/school-options";

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
 * The two states a manager cannot leave without naming a school, and nothing on
 * any other screen.
 *
 * A school is chosen once and remembered, so the switcher lives on the setup
 * screen alone — except here. `round-not-found` is a link the manager cannot
 * open and the school is the thing that is wrong about it. `scope-required` is
 * the request having no school at all: the remembered one was deleted, or the
 * session names a school that is gone, and with several schools left the system
 * refuses to pick one. Both are answered by the same list.
 *
 * Which school the round actually belongs to is not looked up and not shown.
 * The manager's scope is a boundary, and naming another school's round would
 * cross it to answer a question the switcher already lets them answer.
 */
const statesNeedingASchool: ReadonlySet<ManagerContext["state"]> = new Set([
  "round-not-found",
  "scope-required",
]);

export async function loadSchoolChoices(
  context: ManagerContext,
  requestedRoundId?: string,
): Promise<SchoolChoices | null> {
  if (!statesNeedingASchool.has(context.state)) return null;

  return {
    options: toSchoolSwitcherOptions(
      await loadSchools(),
      context.organization?.id,
    ),
    roundId: requestedRoundId,
  };
}

/**
 * What happened to the people who received one round's link.
 *
 * One extra read, and only the round screen asks for it — the same reason the
 * school list and the goals are loaded separately rather than folded into
 * `ManagerContextService.load`. Every other manager screen would pay for a
 * query it never renders, on a database that is not in the same continent as
 * its users.
 */
export async function loadRoundFunnel(roundId: string) {
  const { surveyAttemptRepo, surveyRepo } = resolveCoreRepositories();

  return SurveyFunnelService.getRoundFunnel(
    roundId,
    surveyAttemptRepo,
    surveyRepo,
  );
}

/**
 * Every response of one round, answers included.
 *
 * One extra read, and only the breakdown screen asks for it. Every other
 * manager screen reads the round's aggregate, which `ManagerContextService`
 * already computed; the breakdown has to partition the responses themselves, so
 * it is the one screen that cannot work from the aggregate alone.
 *
 * The caller is expected to have a round from the manager's own context, which
 * is what keeps this from becoming a way to read another school's answers.
 */
export async function loadRoundResponses(roundId: string) {
  const { surveyRepo } = resolveCoreRepositories();

  return surveyRepo.findResponsesByRoundId(roundId);
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
