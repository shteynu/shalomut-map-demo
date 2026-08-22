import type {
  IOrganizationRepository,
  IRoundRepository,
  ISurveyRepository,
} from "../repositories/interfaces";
import type {
  Organization,
  RoundStatus,
  SurveyRoundSummary,
} from "../types/backend";
import type { IManagerRepository } from "./domain-contract";
import type { Manager, ManagerRole, OrganizationMembership } from "./types";

export type AdministrationRefusal =
  | "INVALID_EMAIL"
  | "SCHOOL_NOT_FOUND"
  | "SCHOOL_ALREADY_HAS_SOMEBODY"
  | "ALREADY_AN_ADMINISTRATOR"
  | "MEMBERSHIP_NOT_FOUND";

export type AdministrationResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: AdministrationRefusal };

/**
 * Whether anything is happening in a school, in the only terms an administrator
 * may be told outside it.
 *
 * Every field is a cardinality, a status or a name — nothing here is derived
 * from what anybody answered. That is the k-anonymity limit of the 2026-08-20
 * model expressed as a type: an administrator may open **each school's own**
 * results, which is the same suppressed view that school's user sees, and a
 * figure computed across schools is a different object that stays refused. A
 * score on this summary would be the first half of exactly that object, because
 * the screen renders one of these per school in a list.
 */
export interface CurrentRoundSummary {
  id: string;
  title: string;
  status: RoundStatus;
  /**
   * How many questionnaires came back. A count of people, not a fact about any
   * of them — `getResponseCount` rather than `findResponsesByRoundId`, which
   * would read the answers.
   */
  responseCount: number;
  /** The round's own threshold, which a school may raise above the minimum. */
  privacyThreshold: number;
  /**
   * Whether the count has reached the threshold. Stated rather than left to the
   * screen to derive, so the rule lives beside the numbers it is about and one
   * card cannot render it differently from another.
   */
  isUnlocked: boolean;
}

/** One school and the people who reach it, which is what the screen lists. */
export interface SchoolWithPeople {
  organization: Organization;
  people: { manager: Manager; membership: OrganizationMembership }[];
  /**
   * How many rounds this school has ever had, and what its current one is
   * doing. `null` for a school that has never opened one, which is a real state
   * with its own sentence on the screen rather than a card with a gap in it.
   */
  roundCount: number;
  currentRound: CurrentRoundSummary | null;
}

export interface AdministrationOverview {
  schools: SchoolWithPeople[];
  administrators: Manager[];
  /**
   * People with a row and nothing to open: an invitation to a school that was
   * later deleted, or a revoked membership and no other. Listed because the
   * alternative is a row nobody can see and nobody can clean up.
   */
  unattached: Manager[];
}

/**
 * An address is an address. Deliberately not a full grammar: the identity
 * provider decides what is real, and a regular expression that rejects a valid
 * address is worse than one that lets a typo through — the typo simply never
 * signs in.
 */
function normalizeEmail(email: string): string | null {
  const normalized = email.trim().toLowerCase();
  if (!normalized || /\s/.test(normalized)) return null;

  const at = normalized.indexOf("@");
  if (at <= 0 || at === normalized.length - 1) return null;
  if (!normalized.slice(at + 1).includes(".")) return null;

  return normalized;
}

/**
 * A membership that stands: the school is taken, or is about to be.
 *
 * `invited` counts, because an invitation nobody has accepted is still an
 * invitation, and issuing a second one would mean two people arriving into a
 * product that gives a school exactly one.
 */
function stands(membership: OrganizationMembership): boolean {
  return membership.status === "active" || membership.status === "invited";
}

/**
 * The round a school is currently about.
 *
 * A school runs one round at a time (ADR-014), so at most one is `active` and
 * that one is the answer whenever it exists. Otherwise the most recently created
 * round is what the school last did — a closed round is still the thing an
 * administrator would want to look at, and a draft is still evidence somebody
 * started. `archived` rounds are deliberately eligible: the school took them out
 * of its own list, not out of its history, and a school whose only round is
 * archived should not read as a school that never ran one.
 */
function currentRoundOf(
  rounds: SurveyRoundSummary[],
): SurveyRoundSummary | null {
  if (rounds.length === 0) return null;

  const active = rounds.find((round) => round.status === "active");
  if (active) return active;

  return rounds.reduce((newest, round) =>
    round.createdAt.getTime() > newest.createdAt.getTime() ? round : newest,
  );
}

function groupBy<T>(
  items: readonly T[],
  key: (item: T) => string,
): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const item of items) {
    const bucket = grouped.get(key(item));
    if (bucket) bucket.push(item);
    else grouped.set(key(item), [item]);
  }
  return grouped;
}

/**
 * What a platform administrator can do that nobody else can: create a school,
 * and decide who reaches it.
 *
 * There is no open registration and no self-service. Every method here is the
 * only way a `managers` or `organization_memberships` row comes into existence
 * outside the first-administrator bootstrap, which is what makes "an invitation
 * is the way in" a statement about the system rather than about the screens.
 *
 * Nothing here checks that the caller is an administrator: the routes do that,
 * because a service that authorises its own caller is a service that can be
 * called with a forged one.
 */
export class ManagerAdministrationService {
  /**
   * Every school, everyone in it, everyone who is not in one, and whether
   * anything is happening in each.
   *
   * Five queries for the whole screen, whatever the number of schools: the
   * schools, the people, every membership among them, every round of them as a
   * summary, and one grouped count of the responses to the rounds the screen
   * actually names. It used to ask three per school inside a loop, each one
   * awaited before the next — some 180 ms apiece against the deployed database,
   * so a hundred schools was around 300 round trips in sequence and a function
   * that timed out before it answered.
   *
   * The rounds arrive as summaries because a round carries its whole
   * questionnaire, and a list of schools needs none of it. Response counts are
   * still asked only for the round each school is currently about: counting
   * every round of every school would make this screen grow with the schools'
   * histories rather than with their number.
   */
  public static async loadOverview(
    orgRepo: IOrganizationRepository,
    managerRepo: IManagerRepository,
    roundRepo: IRoundRepository,
    surveyRepo: ISurveyRepository,
  ): Promise<AdministrationOverview> {
    const [organizations, managers] = await Promise.all([
      orgRepo.findAll(),
      managerRepo.findAllManagers(),
    ]);
    const byId = new Map(managers.map((manager) => [manager.id, manager]));
    const attached = new Set<string>();
    const organizationIds = organizations.map((organization) => organization.id);

    const [memberships, roundSummaries] = await Promise.all([
      managerRepo.findMembershipsByOrganizationIds(organizationIds),
      roundRepo.findSummariesByOrganizationIds(organizationIds),
    ]);

    const membershipsByOrganization = groupBy(
      memberships,
      (membership) => membership.organizationId,
    );
    const roundsByOrganization = groupBy(
      roundSummaries,
      (round) => round.organizationId,
    );

    const currentRounds = new Map(
      organizationIds.map((organizationId) => [
        organizationId,
        currentRoundOf(roundsByOrganization.get(organizationId) ?? []),
      ]),
    );
    const responseCounts = await surveyRepo.countResponsesByRoundIds(
      Array.from(currentRounds.values())
        .filter((round): round is SurveyRoundSummary => round !== null)
        .map((round) => round.id),
    );

    const schools: SchoolWithPeople[] = organizations.map((organization) => {
      const people = [];
      for (const membership of membershipsByOrganization.get(organization.id) ??
        []) {
        const manager = byId.get(membership.managerId);
        // A membership naming a manager who is gone is a row worth not
        // rendering rather than a crash: the audit log keeps what happened.
        if (!manager) continue;
        if (stands(membership)) attached.add(manager.id);
        people.push({ manager, membership });
      }

      const current = currentRounds.get(organization.id) ?? null;
      // Absent from the grouped count means no responses, which is what a
      // round nobody has answered looks like in a `GROUP BY`.
      const responseCount = current
        ? (responseCounts.get(current.id) ?? 0)
        : 0;

      return {
        organization,
        people,
        roundCount: (roundsByOrganization.get(organization.id) ?? []).length,
        currentRound: current
          ? {
              id: current.id,
              title: current.title,
              status: current.status,
              responseCount,
              privacyThreshold: current.privacyThreshold,
              isUnlocked: responseCount >= current.privacyThreshold,
            }
          : null,
      };
    });

    return {
      schools,
      administrators: managers.filter(
        (manager) => manager.isPlatformAdministrator,
      ),
      unattached: managers.filter(
        (manager) =>
          !manager.isPlatformAdministrator && !attached.has(manager.id),
      ),
    };
  }

  /**
   * Invites one person into one school.
   *
   * The membership is created `invited` and becomes `active` the first time
   * they sign in — see `ManagerDirectoryService`. That is the whole acceptance
   * step: with identity coming from the provider there is no password to set,
   * so an invitation is an entitlement rather than a credential, and arriving
   * is how it is accepted. It also means the screen can tell an invitation that
   * was never used from a person who is actually working.
   *
   * The role is `admin` and not `manager`: the owner's model gives a school one
   * person who does everything today's manager does, and `manager` is the
   * read-only half of `RolePermissionService`. The word collides with platform
   * administrator and means something narrower — everything inside one school.
   */
  public static async inviteSchoolUser(
    managerRepo: IManagerRepository,
    orgRepo: IOrganizationRepository,
    input: { email: string; name?: string; organizationId: string },
  ): Promise<
    AdministrationResult<{ manager: Manager; membership: OrganizationMembership }>
  > {
    const email = normalizeEmail(input.email);
    if (!email) return { ok: false, reason: "INVALID_EMAIL" };

    const organization = await orgRepo.findById(input.organizationId);
    if (!organization) return { ok: false, reason: "SCHOOL_NOT_FOUND" };

    const existing = await managerRepo.findMembershipsByOrganizationId(
      organization.id,
    );
    // Replacing a school's person is revoke-then-invite rather than a transfer,
    // so a suspended membership does not block the next invitation and a
    // standing one does — including the invitee's own, which would otherwise be
    // silently overwritten.
    if (existing.some(stands)) {
      return { ok: false, reason: "SCHOOL_ALREADY_HAS_SOMEBODY" };
    }

    const manager = await this.findOrCreateManager(managerRepo, email, input.name);
    const membership = await managerRepo.saveMembership({
      id: crypto.randomUUID(),
      managerId: manager.id,
      organizationId: organization.id,
      role: "admin" as ManagerRole,
      status: "invited",
      createdAt: new Date(),
    });

    return { ok: true, value: { manager, membership } };
  }

  /**
   * Invites one of the remaining platform administrators.
   *
   * They get no membership, because an administrator is outside the membership
   * system rather than a member of every school. There is nothing to accept:
   * the flag is the entitlement, and they are an administrator from the moment
   * the row exists.
   */
  public static async inviteAdministrator(
    managerRepo: IManagerRepository,
    input: { email: string; name?: string },
  ): Promise<AdministrationResult<Manager>> {
    const email = normalizeEmail(input.email);
    if (!email) return { ok: false, reason: "INVALID_EMAIL" };

    const existing = await managerRepo.findByEmail(email);
    if (existing?.isPlatformAdministrator) {
      return { ok: false, reason: "ALREADY_AN_ADMINISTRATOR" };
    }

    const manager = await managerRepo.saveManager({
      id: existing?.id ?? crypto.randomUUID(),
      email,
      name: input.name?.trim() || existing?.name || email,
      isPlatformAdministrator: true,
      createdAt: existing?.createdAt ?? new Date(),
    });

    return { ok: true, value: manager };
  }

  /**
   * Takes a school's person away, or gives them back.
   *
   * Revocation is a status and not a delete: the row is what the audit log's
   * `manager_id` points at, and a school that changes hands twice should still
   * be able to say who had it when.
   *
   * The school is named as well as the membership, because the only screen that
   * calls this is looking at one school and an id alone would let a mistyped
   * one act on another.
   */
  public static async setMembershipStatus(
    managerRepo: IManagerRepository,
    organizationId: string,
    membershipId: string,
    status: "active" | "suspended",
  ): Promise<AdministrationResult<OrganizationMembership>> {
    const memberships =
      await managerRepo.findMembershipsByOrganizationId(organizationId);
    const membership = memberships.find((row) => row.id === membershipId);
    if (!membership) return { ok: false, reason: "MEMBERSHIP_NOT_FOUND" };

    if (status === "active" && memberships.some((row) => row !== membership && stands(row))) {
      return { ok: false, reason: "SCHOOL_ALREADY_HAS_SOMEBODY" };
    }

    return {
      ok: true,
      value: await managerRepo.saveMembership({ ...membership, status }),
    };
  }

  private static async findOrCreateManager(
    managerRepo: IManagerRepository,
    email: string,
    name?: string,
  ): Promise<Manager> {
    const existing = await managerRepo.findByEmail(email);
    if (existing) {
      // The name is not overwritten. Whoever is invited a second time is the
      // same person, and an administrator's typo should not rename them.
      return existing;
    }

    return managerRepo.saveManager({
      id: crypto.randomUUID(),
      email,
      // The provider knows their real name and never tells us: nothing reads
      // the profile beyond the address. The address is the honest placeholder.
      name: name?.trim() || email,
      isPlatformAdministrator: false,
      createdAt: new Date(),
    });
  }
}
