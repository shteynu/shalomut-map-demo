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
  RoundFillingService,
  SurveyFunnelService,
} from "@/lib/services";
import type {
  ManagerContext,
  ManagerContextLoadOptions,
  ManagerContextWithoutAnalytics,
} from "@/lib/services";
import type { ManagerRole } from "@/lib/auth/types";
import type { SurveyRound } from "@/lib/types/backend";
import { UNRECORDABLE_VISIT_MESSAGE } from "@/lib/server/manager-audit";
import {
  getManagerMemberSchools,
  getManagerOrganizationId,
  getManagerRole,
  recordManagerScreenVisit,
} from "@/lib/server/manager-scope";
import {
  toSchoolSwitcherOptions,
  type SchoolChoices,
} from "@/lib/schools/school-options";

/**
 * The one door every manager screen comes through.
 *
 * A screen that renders neither the map nor the response count passes
 * `{ withAnalytics: false }` and gets a context with the `analytics` field
 * removed — see `ManagerContextService.load` for why it is removed rather than
 * nulled. It is one entrypoint either way, deliberately: the audit record below
 * is what makes this a chokepoint, and a second function to skip a query would
 * be a second place for a screen to enter without one.
 */
export async function loadManagerContext(
  roundId?: string,
): Promise<ManagerContext>;
export async function loadManagerContext(
  roundId: string | undefined,
  options: { readonly withAnalytics: false },
): Promise<ManagerContextWithoutAnalytics>;
export async function loadManagerContext(
  roundId?: string,
  options?: ManagerContextLoadOptions,
): Promise<ManagerContext | ManagerContextWithoutAnalytics> {
  await connection();
  const { auditLogRepo, orgRepo, roundRepo, surveyRepo } =
    resolveCoreRepositories();
  const requestHeaders = await headers();

  const organizationId = getManagerOrganizationId({ headers: requestHeaders });
  const memberSchools = getManagerMemberSchools({ headers: requestHeaders });
  const requestedRoundId = roundId?.trim() || undefined;

  // Spelled out twice rather than passed through, because the two calls have
  // two different return types and that is the point of the option.
  const context =
    options?.withAnalytics === false
      ? await ManagerContextService.load(
          orgRepo,
          roundRepo,
          surveyRepo,
          organizationId,
          requestedRoundId,
          memberSchools,
          { withAnalytics: false },
        )
      : await ManagerContextService.load(
          orgRepo,
          roundRepo,
          surveyRepo,
          organizationId,
          requestedRoundId,
          memberSchools,
        );

  // The screens' half of the same chokepoint the round routes have in
  // `authorizeManagerRound`: eight manager pages enter here, so an
  // administrator cannot open one over a school they are not a member of
  // without the visit being recorded. It throws rather than returning a state,
  // because there is no honest screen for "we are showing you this school but
  // nobody will ever know we did".
  //
  // The record is taken after the context resolves, which costs the reads of a
  // page that is then refused. That is the price of naming the right school:
  // the request often names none, and the school it was answered with is only
  // known once it has been.
  const recorded = await recordManagerScreenVisit(
    auditLogRepo,
    { headers: requestHeaders },
    context,
  );
  if (!recorded) throw new Error(UNRECORDABLE_VISIT_MESSAGE);

  return context;
}

/**
 * What this session may do in the school it is reading.
 *
 * The screens' half of the role gate. It reads the same server-owned header the
 * round routes read, so a tab and the route behind it cannot disagree about who
 * may open it — which is the whole reason the middleware decides the role
 * rather than each screen deriving one.
 *
 * The screens use it to *not offer* what the routes would refuse. It is not the
 * boundary: `requireManagerPermission` is, on every write route, and it holds
 * whether or not a screen ever renders.
 */
export async function loadManagerRole(): Promise<ManagerRole> {
  await connection();
  return getManagerRole({ headers: await headers() });
}

/**
 * Every school this session has, which is not every school the system has.
 *
 * One extra read, and only the setup screen asks for it: it is the one screen
 * that can change which school the manager is in, so it is the only one that
 * needs the list. The other screens are already scoped to the chosen school and
 * would pay for a query they never render.
 *
 * The list is narrowed to the session's memberships, and that is a disclosure
 * boundary rather than a nicety: a school the manager cannot open would still
 * have its name and its city on the switcher. The narrowing is now the query
 * itself. It used to be a filter applied to every row the table had, on the
 * argument that the repository is the one place that legitimately knows about
 * every school — but asking it for named schools does not ask it to forget
 * that, and reading a hundred rows to render one is a cost with no reader.
 *
 * A session with no memberships is a platform administrator, and every school
 * is genuinely what their switcher shows.
 */
export async function loadSchools() {
  await connection();
  const { orgRepo } = resolveCoreRepositories();
  const requestHeaders = await headers();
  const memberSchools = getManagerMemberSchools({ headers: requestHeaders });

  return memberSchools
    ? await orgRepo.findByIds(memberSchools)
    : await orgRepo.findAll();
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
  context: ManagerContextWithoutAnalytics,
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
 * What happened to the people who received one round's link, and how long it
 * took the ones who answered.
 *
 * Two reports and two reads, where there used to be two reports and four. The
 * round screen renders both, and each used to fetch the round's attempts for
 * itself — the same query, twice, on one render. They are one loader now
 * because they are one screen's worth of the same collection, not because the
 * reports are related: the funnel is about who arrived, the filling report
 * about who stayed.
 *
 * Still separate from `ManagerContextService.load`, for the reason the school
 * list and the goals are: only this screen asks, and every other manager screen
 * would pay for a query it never renders, on a database that is not on the same
 * continent as its users.
 *
 * The round is passed rather than its id, because the filling report needs the
 * stored questionnaire and the privacy threshold from it — and because the
 * caller is then holding a round from the manager's own context, which is what
 * keeps this from becoming a way to read another school's collection.
 *
 * `completed` in the funnel is the number of stored responses, which is now
 * `responses.length` rather than its own `COUNT(*)`. Same number, one query
 * fewer, and it stays counted from responses rather than from completion
 * beacons for the reason `getRoundFunnel` documents.
 */
export async function loadRoundActivity(
  round: Pick<SurveyRound, 'id' | 'privacyThreshold' | 'surveyDefinition'>,
) {
  const { surveyAttemptRepo, surveyRepo } = resolveCoreRepositories();

  const [attempts, responses] = await Promise.all([
    surveyAttemptRepo.findByRoundId(round.id),
    surveyRepo.findResponseTimingsByRoundId(round.id),
  ]);

  return {
    funnel: SurveyFunnelService.getRoundFunnel(attempts, responses.length),
    filling: RoundFillingService.getRoundFilling(round, attempts, responses),
  };
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
export async function loadSchoolGoals(context: ManagerContextWithoutAnalytics) {
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
