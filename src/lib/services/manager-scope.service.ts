import type {
  IOrganizationRepository,
  IRoundRepository,
} from "../repositories";
import type { SurveyRound } from "../types/backend";

export class ManagerScopeRequiredError extends Error {
  constructor() {
    super("Manager organization scope is required.");
    this.name = "ManagerScopeRequiredError";
  }
}

export class ManagerScopeService {
  public static async resolveOrganizationId(
    orgRepo: IOrganizationRepository,
    requestedOrganizationId?: string,
  ): Promise<string | null> {
    const scopedOrganizationId = requestedOrganizationId?.trim();
    if (scopedOrganizationId) return scopedOrganizationId;

    const organizations = await orgRepo.findAll();
    if (organizations.length > 1) {
      throw new ManagerScopeRequiredError();
    }

    return organizations[0]?.id ?? null;
  }

  public static async findRound(
    roundId: string,
    orgRepo: IOrganizationRepository,
    roundRepo: IRoundRepository,
    requestedOrganizationId?: string,
  ): Promise<SurveyRound | null> {
    const organizationId = await this.resolveOrganizationId(
      orgRepo,
      requestedOrganizationId,
    );
    if (!organizationId) return null;

    const round = await roundRepo.findById(roundId);
    return round?.organizationId === organizationId ? round : null;
  }
}
