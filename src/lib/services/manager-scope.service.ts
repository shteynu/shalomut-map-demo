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
   * `memberOrganizationIds` is the session's own schools, decided in the
   * middleware and carried in a header. When it is given, it is the population
   * this function reasons about: a school the session is not a member of is not
   * a school as far as this request is concerned, so it can neither be asked for
   * nor be landed on by default. When it is absent — a caller with no session
   * behind it, or a test — every school in the system is the population, which
   * is what this function did before memberships were consulted at all.
   *
   * A requested school is honoured when it is one of those schools. A school
   * with no row yet still counts as one when the session holds a membership for
   * it, which is the empty deployment naming the id its first school will be
   * created with.
   *
   * Otherwise the value is discarded. It reaches here from a cookie the manager
   * set by choosing a school, and a school can be gone by the time the cookie
   * comes back; taking it on trust would leave every manager screen empty with
   * nothing on it explaining why. An unknown value is treated as no choice at
   * all, which lands a one-school manager on their school and asks a
   * several-school manager to choose again.
   */
  public static async resolveOrganizationId(
    orgRepo: IOrganizationRepository,
    requestedOrganizationId?: string,
    memberOrganizationIds?: readonly string[],
  ): Promise<string | null> {
    const scopedOrganizationId = requestedOrganizationId?.trim();
    const existingOrganizations = await orgRepo.findAll();
    const existingSchools = (
      memberOrganizationIds
        ? existingOrganizations.filter((organization) =>
            memberOrganizationIds.includes(organization.id),
          )
        : existingOrganizations
    ).map((organization) => organization.id);

    // The schools this request can end up inside. Normally the ones that exist;
    // when none of them does, the memberships themselves — a session whose
    // school has no row yet is the empty deployment naming the id its first
    // school will be created with.
    const schools =
      existingSchools.length > 0 ? existingSchools : memberOrganizationIds ?? [];

    // An empty system with nothing said about memberships is the one case where
    // any id is taken at its word, and it is how the very first school was
    // always created. A session says which schools are its own, so it never
    // needs this.
    const adoptsAnyId = existingSchools.length === 0 && !memberOrganizationIds;

    if (
      scopedOrganizationId &&
      (adoptsAnyId || schools.includes(scopedOrganizationId))
    ) {
      return scopedOrganizationId;
    }

    if (schools.length > 1) {
      throw new ManagerScopeRequiredError();
    }

    return schools[0] ?? null;
  }

  public static async findRound(
    roundId: string,
    orgRepo: IOrganizationRepository,
    roundRepo: IRoundRepository,
    requestedOrganizationId?: string,
    memberOrganizationIds?: readonly string[],
  ): Promise<SurveyRound | null> {
    const organizationId = await this.resolveOrganizationId(
      orgRepo,
      requestedOrganizationId,
      memberOrganizationIds,
    );
    if (!organizationId) return null;

    const round = await roundRepo.findById(roundId);
    return round?.organizationId === organizationId ? round : null;
  }
}
