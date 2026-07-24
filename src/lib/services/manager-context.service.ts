import type {
  IOrganizationRepository,
  IRoundRepository,
  ISurveyRepository,
} from "../repositories";
import type {
  Organization,
  RoundAnalyticsResult,
  SurveyRound,
} from "../types/backend";
import { AnalyticsService } from "./analytics.service";

export type ManagerOnboardingState =
  | "needs-organization"
  | "needs-round"
  | "round-ready";

export interface ManagerContext {
  state: ManagerOnboardingState;
  organization: Organization | null;
  currentRound: SurveyRound | null;
  responseCount: number;
  analytics: RoundAnalyticsResult | null;
}

const roundStatusPriority: Record<SurveyRound["status"], number> = {
  active: 0,
  draft: 1,
  closed: 2,
  archived: 3,
};

function selectOrganization(organizations: Organization[]): Organization | null {
  return (
    [...organizations].sort(
      (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
    )[0] ?? null
  );
}

export function selectCurrentRound(rounds: SurveyRound[]): SurveyRound | null {
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
  ): Promise<ManagerContext> {
    const organization = selectOrganization(await orgRepo.findAll());

    if (!organization) {
      return {
        state: "needs-organization",
        organization: null,
        currentRound: null,
        responseCount: 0,
        analytics: null,
      };
    }

    const currentRound = selectCurrentRound(
      await roundRepo.findByOrganizationId(organization.id),
    );

    if (!currentRound) {
      return {
        state: "needs-round",
        organization,
        currentRound: null,
        responseCount: 0,
        analytics: null,
      };
    }

    const analytics = await AnalyticsService.getAnalyticsForRound(
      currentRound.id,
      roundRepo,
      surveyRepo,
    );

    return {
      state: "round-ready",
      organization,
      currentRound,
      responseCount: analytics?.totalResponses ?? 0,
      analytics,
    };
  }
}
