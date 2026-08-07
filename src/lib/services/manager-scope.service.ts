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
  /**
   * The school a manager request is read inside.
   *
   * A requested school is honoured when it is a school the system has — or
   * when the system has none at all, which is the empty deployment naming the
   * id its first school will be created with.
   *
   * Otherwise the value is discarded. It reaches here from a cookie the manager
   * set by choosing a school, and a school can be gone by the time the cookie
   * comes back; taking it on trust would leave every manager screen empty with
   * nothing on it explaining why. An unknown value is treated as no choice at
   * all, which lands a one-school system on its school and asks a
   * several-school system to choose again.
   */
  public static async resolveOrganizationId(
    orgRepo: IOrganizationRepository,
    requestedOrganizationId?: string,
  ): Promise<string | null> {
    const scopedOrganizationId = requestedOrganizationId?.trim();
    const organizations = await orgRepo.findAll();

    if (
      scopedOrganizationId &&
      (organizations.length === 0 ||
        organizations.some(
          (organization) => organization.id === scopedOrganizationId,
        ))
    ) {
      return scopedOrganizationId;
    }

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
