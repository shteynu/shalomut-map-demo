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
  return (
    [...rounds].sort((left, right) => {
      const statusDifference =
        roundStatusPriority[left.status] - roundStatusPriority[right.status];

      return statusDifference || right.createdAt.getTime() - left.createdAt.getTime();
    })[0] ?? null
  );
}

export class ManagerContextService {
  public static async load(
    orgRepo: IOrganizationRepository,
    roundRepo: IRoundRepository,
    surveyRepo: ISurveyRepository,
    requestedOrganizationId?: string,
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
        responseCount: 0,
        analytics: null,
      };
    }

    const selectedRound = selectActiveRound(
      await roundRepo.findByOrganizationId(organization.id),
    );

    if (!selectedRound) {
      return {
        state: "needs-round",
        organization,
        selectedRound: null,
        responseCount: 0,
        analytics: null,
      };
    }

    const analytics = await AnalyticsService.getAnalyticsForRound(
      selectedRound.id,
      roundRepo,
      surveyRepo,
    );

    return {
      state: "round-ready",
      organization,
      selectedRound,
      responseCount: analytics?.totalResponses ?? 0,
      analytics,
    };
  }
}
