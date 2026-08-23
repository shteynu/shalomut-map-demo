import type {
  IOrganizationRepository,
  IRoundRepository,
  ISurveyRepository,
} from "../repositories";
import type {
  Organization,
  SurveyRound,
  SurveyRoundSummary,
} from "../types/backend";
import type { CanonicalRoundAnalytics } from "../types/canonical-analytics";
import { AnalyticsService } from "./analytics.service";
import {
  ManagerScopeRequiredError,
  ManagerScopeService,
} from "./manager-scope.service";

export type ManagerOnboardingState =
  | "needs-organization"
  | "needs-round"
  | "round-ready"
  | "round-not-found"
  | "scope-required";

export interface ManagerContext {
  state: ManagerOnboardingState;
  organization: Organization | null;
  /**
   * The round these screens are about. It is the active round unless a caller
   * asks for another one, which is why it is no longer called `currentRound`:
   * a school with several rounds has exactly one active round but can be
   * looking at any of them.
   */
  selectedRound: SurveyRound | null;
  /**
   * Every round this school has, newest work first, so a screen can offer the
   * history without a second query. Empty whenever there is no organization to
   * scope it to.
   *
   * Summaries, not rounds. Every entry used to arrive with its whole
   * questionnaire and its whole map in tow — eight rounds on the 126-item
   * instrument is a quarter of a megabyte parsed on the way to a screen that
   * renders a list of titles. The one round a screen works on is
   * `selectedRound`, and it is read whole; the type is what keeps the
   * difference true after the next edit.
   */
  rounds: SurveyRoundSummary[];
  responseCount: number;
  analytics: CanonicalRoundAnalytics | null;
}

/**
 * The same context, for a caller that said it does not read the analysis.
 *
 * The field is removed rather than set to `null`, and that is the whole point:
 * `null` already means "this round has no numbers", so a caller that opted out
 * and then read the field would be handed a value that looks like an answer.
 * Omitting it makes reading it a compile error instead, which is the only way
 * an opt-in like this stays true after the screen that uses it is edited.
 *
 * `responseCount` stays, and is counted directly rather than taken from an
 * analysis nobody asked for.
 */
export type ManagerContextWithoutAnalytics = Omit<ManagerContext, "analytics">;

/**
 * What a caller of `ManagerContextService.load` is willing to pay for.
 *
 * There is one option and it only has one useful value: `withAnalytics: false`.
 * The analysis is what the default does, so asking for it is not a request —
 * declining it is.
 */
export interface ManagerContextLoadOptions {
  readonly withAnalytics?: false;
}

/**
 * The two fields this order is made of, named so that the order works on a
 * round and on a summary alike. Both are lists of the same rounds; only one of
 * them carries the questionnaire.
 */
type OrderableRound = Pick<SurveyRound, "status" | "createdAt">;

const roundStatusPriority: Record<SurveyRound["status"], number> = {
  active: 0,
  draft: 1,
  closed: 2,
  archived: 3,
};

/**
 * The one round a school is working on right now: active first, then the newest
 * draft, then the newest closed one. This is what a manager lands on when they
 * have not asked for a particular round.
 */
export function selectActiveRound<T extends OrderableRound>(
  rounds: T[],
): T | null {
  return orderRoundsForManager(rounds)[0] ?? null;
}

/**
 * The order a manager reads rounds in: the active one, then drafts, then closed
 * and archived ones, newest first inside each group. The history list and the
 * default selection use the same order so the first entry is always the round
 * the manager would have landed on anyway.
 */
export function orderRoundsForManager<T extends OrderableRound>(
  rounds: T[],
): T[] {
  return [...rounds].sort((left, right) => {
    const statusDifference =
      roundStatusPriority[left.status] - roundStatusPriority[right.status];

    return statusDifference || right.createdAt.getTime() - left.createdAt.getTime();
  });
}

const supersedableStatuses: ReadonlySet<SurveyRound["status"]> = new Set([
  "closed",
  "archived",
]);

/**
 * Whether the school has moved *past* the round on screen.
 *
 * A superseded round is read rather than worked on: its answers are not reset
 * and its analysis is not re-run, because the school has already acted on what
 * it said.
 *
 * Two conditions, and the second is the one that was missing. Not being the
 * round the manager would have landed on is necessary — `rounds` is ordered for
 * them, so the first entry is that round — but it is not sufficient, because
 * that order puts `active` ahead of `draft`. A round the manager opened a
 * minute ago is a draft while its questionnaire is built, so it sorted behind
 * the round still running and was announced to its own author as a round the
 * school had moved past, with the controls for preparing it taken away. A draft
 * is ahead of the school, not behind it. Only a round whose own status says the
 * school is finished with it can be superseded.
 */
export function isSelectedRoundSuperseded(
  context: ManagerContextWithoutAnalytics,
): boolean {
  const { selectedRound } = context;
  if (!selectedRound) return false;

  return (
    context.rounds[0]?.id !== selectedRound.id &&
    supersedableStatuses.has(selectedRound.status)
  );
}

export class ManagerContextService {
  /**
   * The school, its rounds, the one on screen, and its numbers.
   *
   * The analysis is the expensive part and most callers never render it. Six of
   * the eleven screens that enter here read neither `analytics` nor
   * `responseCount` — the goals and setup screens and the three dimension
   * screens — and `GET /api/rounds` returns one round object. They were each
   * paying `AnalyticsService.getAnalyticsForRound`, which is a second lookup of
   * a round this method is already holding, a count, and a read of the
   * published copy; and when the basis of calculation changed underneath it, a
   * load of every response, a recompute, and a **write** — from a GET.
   *
   * So the caller says. `{ withAnalytics: false }` returns a context with the
   * field removed, not nulled, so a screen that later starts reading it fails
   * to compile rather than rendering an empty map.
   *
   * This is the same argument the separate loaders in `manager-context.ts`
   * already make for the funnel, the filling times, the goals and the school
   * list — every other manager screen would pay for a query it never renders,
   * on a database that is not in the same continent as its users. The analysis
   * was the one read that had been folded in anyway.
   */
  public static async load(
    orgRepo: IOrganizationRepository,
    roundRepo: IRoundRepository,
    surveyRepo: ISurveyRepository,
    requestedOrganizationId?: string,
    requestedRoundId?: string,
    memberOrganizationIds?: readonly string[],
  ): Promise<ManagerContext>;
  public static async load(
    orgRepo: IOrganizationRepository,
    roundRepo: IRoundRepository,
    surveyRepo: ISurveyRepository,
    requestedOrganizationId: string | undefined,
    requestedRoundId: string | undefined,
    memberOrganizationIds: readonly string[] | undefined,
    options: { readonly withAnalytics: false },
  ): Promise<ManagerContextWithoutAnalytics>;
  public static async load(
    orgRepo: IOrganizationRepository,
    roundRepo: IRoundRepository,
    surveyRepo: ISurveyRepository,
    requestedOrganizationId?: string,
    requestedRoundId?: string,
    memberOrganizationIds?: readonly string[],
    options: ManagerContextLoadOptions = {},
  ): Promise<ManagerContext | ManagerContextWithoutAnalytics> {
    let organizationId: string | null;
    try {
      organizationId = await ManagerScopeService.resolveOrganizationId(
        orgRepo,
        requestedOrganizationId,
        memberOrganizationIds,
      );
    } catch (error) {
      if (!(error instanceof ManagerScopeRequiredError)) throw error;

      return {
        state: "scope-required",
        organization: null,
        selectedRound: null,
        rounds: [],
        responseCount: 0,
        analytics: null,
      };
    }

    const organization = organizationId
      ? await orgRepo.findById(organizationId)
      : null;

    if (!organization) {
      return {
        state: "needs-organization",
        organization: null,
        selectedRound: null,
        rounds: [],
        responseCount: 0,
        analytics: null,
      };
    }

    // Summaries, then the one round that is worked on. A school's list used to
    // arrive as whole rounds — each with its questionnaire and its map — on the
    // way to every manager screen, and every screen but one renders titles from
    // it.
    const rounds: SurveyRoundSummary[] = orderRoundsForManager(
      // The read the administrator console already had. It was written for a
      // screen listing many schools and is exactly the projection one school's
      // own list wants; the ordering is this manager's own and is applied here.
      await roundRepo.findSummariesByOrganizationIds([organization.id]),
    );

    if (rounds.length === 0) {
      return {
        state: "needs-round",
        organization,
        selectedRound: null,
        rounds,
        responseCount: 0,
        analytics: null,
      };
    }

    // A requested round is only ever looked up inside this organization's own
    // rounds, so an id belonging to another school reads as unknown rather than
    // opening its results. An unknown id is reported instead of quietly falling
    // back to the active round: a link that shows a different round's numbers
    // under the requested one would misreport, and this is the screen where a
    // manager decides what the school is doing next.
    const requestedRound = requestedRoundId
      ? rounds.find((round) => round.id === requestedRoundId)
      : undefined;

    if (requestedRoundId && !requestedRound) {
      return {
        state: "round-not-found",
        organization,
        selectedRound: null,
        rounds,
        responseCount: 0,
        analytics: null,
      };
    }

    // The second query, and the reason this is a net win rather than a trade:
    // it reads one round whole where the list used to read all of them whole.
    // A school with a single round pays two queries for what was one, which is
    // the case where there was nothing to save anyway.
    const selectedSummary = requestedRound ?? rounds[0];
    const selectedRound = await roundRepo.findById(selectedSummary.id);

    if (!selectedRound) {
      // The row was there a moment ago and is not now — a reset or a delete
      // landing between the two reads. Reported as the round not being found
      // rather than as an empty school, because the school is real and the
      // manager asked for a round it no longer has.
      return {
        state: "round-not-found",
        organization,
        selectedRound: null,
        rounds,
        responseCount: 0,
        analytics: null,
      };
    }

    if (options.withAnalytics === false) {
      // The count is asked for directly instead of being read off an analysis.
      // It is one indexed count against the round; the analysis it used to come
      // from is a lookup of `selectedRound` all over again, that same count, and
      // a read of the published copy at minimum.
      return {
        state: "round-ready",
        organization,
        selectedRound,
        rounds,
        responseCount: await surveyRepo.getResponseCount(selectedRound.id),
      };
    }

    // The round is in hand, so it is handed over rather than looked up again.
    const analytics = await AnalyticsService.getAnalyticsForLoadedRound(
      selectedRound,
      roundRepo,
      surveyRepo,
    );

    return {
      state: "round-ready",
      organization,
      selectedRound,
      rounds,
      responseCount: analytics?.totalResponses ?? 0,
      analytics,
    };
  }
}
