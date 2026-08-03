import type {
  IOrganizationRepository,
  IRoundRepository,
  ISurveyRepository,
} from "../repositories";
import type { Organization, SurveyRound } from "../types/backend";
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
   */
  rounds: SurveyRound[];
  responseCount: number;
  analytics: CanonicalRoundAnalytics | null;
}

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
export function selectActiveRound(rounds: SurveyRound[]): SurveyRound | null {
  return orderRoundsForManager(rounds)[0] ?? null;
}

/**
 * The order a manager reads rounds in: the active one, then drafts, then closed
 * and archived ones, newest first inside each group. The history list and the
 * default selection use the same order so the first entry is always the round
 * the manager would have landed on anyway.
 */
export function orderRoundsForManager(rounds: SurveyRound[]): SurveyRound[] {
  return [...rounds].sort((left, right) => {
    const statusDifference =
      roundStatusPriority[left.status] - roundStatusPriority[right.status];

    return statusDifference || right.createdAt.getTime() - left.createdAt.getTime();
  });
}

export class ManagerContextService {
  public static async load(
    orgRepo: IOrganizationRepository,
    roundRepo: IRoundRepository,
    surveyRepo: ISurveyRepository,
    requestedOrganizationId?: string,
    requestedRoundId?: string,
  ): Promise<ManagerContext> {
    let organizationId: string | null;
    try {
      organizationId = await ManagerScopeService.resolveOrganizationId(
        orgRepo,
        requestedOrganizationId,
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

    const rounds = orderRoundsForManager(
      await roundRepo.findByOrganizationId(organization.id),
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

    const selectedRound = requestedRound ?? rounds[0];

    const analytics = await AnalyticsService.getAnalyticsForRound(
      selectedRound.id,
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
