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
import {
  SchoolAlreadyHasSomebodyError,
  type IManagerRepository,
} from "./domain-contract";
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

/**
 * How many schools one screenful is, and the widest one an address bar may ask
 * for.
 *
 * The maximum exists because `page` and `q` come off the URL, and an
 * administrator who edits `?size=100000` would otherwise reinstate the query
 * this whole change removed — from the outside, on purpose, and with a
 * plausible-looking link.
 */
export const DEFAULT_SCHOOL_PAGE_SIZE = 20;
export const MAXIMUM_SCHOOL_PAGE_SIZE = 100;

/**
 * The bound on the two people lists beside the schools.
 *
 * Neither is paged. Administrators are a handful by design, and `unattached`
 * should be empty in a healthy platform — it is people whose school was deleted
 * or whose membership was revoked. A cap rather than a page because the honest
 * answer to a hundred unattached people is not a second page of them, it is
 * that something needs cleaning up; the screen says so.
 */
export const MAXIMUM_LISTED_PEOPLE = 50;

/** Which schools the console is asking about. */
export interface AdministrationPageQuery {
  /** Matched as a case-insensitive substring of the name or the city. */
  readonly search?: string;
  /** One-based, the way the address bar spells it. */
  readonly page?: number;
  readonly pageSize?: number;
}

/** Where the schools on screen sit in the whole list. */
export interface AdministrationPage {
  /** Echoed back normalized, so the screen renders what the server read. */
  search: string;
  /** One-based. */
  page: number;
  pageSize: number;
  /** Schools matching the search, not schools on this page. */
  total: number;
  pageCount: number;
}

/** A bounded list, and whether the bound cut anything off. */
export interface BoundedPeople {
  people: Manager[];
  /**
   * True when the store had more than `MAXIMUM_LISTED_PEOPLE` to give. Read
   * from one extra row rather than a second `count`, because the screen needs
   * to say "and more" and not how many more.
   */
  truncated: boolean;
}

export interface AdministrationOverview {
  schools: SchoolWithPeople[];
  /** Where `schools` sits in the whole list, which is what the pager renders. */
  page: AdministrationPage;
  administrators: BoundedPeople;
  /**
   * People with a row and nothing to open: an invitation to a school that was
   * later deleted, or a revoked membership and no other. Listed because the
   * alternative is a row nobody can see and nobody can clean up.
   */
  unattached: BoundedPeople;
}

/**
 * Turns whatever the address bar carries into a page the store can be asked
 * for.
 *
 * Everything is clamped rather than refused: a URL is not a form, and a
 * mistyped `?page=0` should show the first page instead of an error screen.
 * The one thing it will not do is widen the page past the maximum.
 */
export function readAdministrationPageQuery(params: {
  q?: string | string[];
  page?: string | string[];
}): AdministrationPageQuery {
  const first = (value?: string | string[]) =>
    Array.isArray(value) ? value[0] : value;

  const page = Number.parseInt(first(params.page) ?? "", 10);

  return {
    search: (first(params.q) ?? "").trim(),
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

function resolvePage(query: AdministrationPageQuery): {
  search: string;
  page: number;
  pageSize: number;
} {
  const requested = query.pageSize ?? DEFAULT_SCHOOL_PAGE_SIZE;
  const pageSize = Math.min(
    MAXIMUM_SCHOOL_PAGE_SIZE,
    Math.max(1, Math.trunc(requested)),
  );
  const page = Math.max(1, Math.trunc(query.page ?? 1));

  return { search: query.search?.trim() ?? "", page, pageSize };
}

/**
 * Reads one more row than will be shown and reports the overflow.
 *
 * The extra row is discarded rather than rendered: showing 51 people when the
 * cap says 50 would make the cap a suggestion, and the next reader would not be
 * able to tell which number was the rule.
 */
function bounded(rows: Manager[], limit: number): BoundedPeople {
  return { people: rows.slice(0, limit), truncated: rows.length > limit };
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
/**
 * Runs a membership write and turns the store's refusal into this module's own.
 *
 * `SchoolAlreadyHasSomebodyError` is what the partial unique index says when
 * two requests both passed a read that said there was room. It is the same
 * situation the read refuses, so it gets the same reason and the screens need
 * to know nothing about it — the only difference is who decided, and by then
 * the answer is no either way.
 */
async function refusingASecondStandingMembership(
  write: () => Promise<OrganizationMembership>,
): Promise<AdministrationResult<OrganizationMembership>> {
  try {
    return { ok: true, value: await write() };
  } catch (error) {
    if (error instanceof SchoolAlreadyHasSomebodyError) {
      return { ok: false, reason: "SCHOOL_ALREADY_HAS_SOMEBODY" };
    }
    throw error;
  }
}

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
   * One page of schools, everyone in those, everyone who is in none, and
   * whether anything is happening in each.
   *
   * Seven queries for the whole screen, whatever the number of schools — and,
   * since 2026-08-23, whatever the size of the platform. It already asked a
   * constant number: before that it asked three per school inside a loop, some
   * 180 ms apiece against the deployed database, so a hundred schools was
   * around 300 round trips in sequence and a function that timed out before it
   * answered. But constant is not the same as bounded. Every one of those seven
   * read the whole table — every school, every manager, every membership, every
   * round summary — and rendered all of it into one page of cards. The audit
   * called it the last screen with no ceiling on it.
   *
   * Now the schools arrive one page at a time and everything else is asked
   * about that page: the memberships name the page's schools, the managers are
   * the ones those memberships point at, the round summaries are the page's.
   * The two lists that are not about schools — administrators, and people with
   * no school — are asked for directly rather than derived, because deriving
   * them needs every manager and every membership in hand, which is precisely
   * what stopped being true.
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
    query: AdministrationPageQuery = {},
  ): Promise<AdministrationOverview> {
    const { search, page, pageSize } = resolvePage(query);

    // One extra row on each people list, which is how `bounded` knows there is
    // a tail without paying for a second `count`.
    const [organizationPage, administrators, unattached] = await Promise.all([
      orgRepo.findPage({
        search,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      managerRepo.findPlatformAdministrators(MAXIMUM_LISTED_PEOPLE + 1),
      managerRepo.findManagersWithoutStandingMembership(
        MAXIMUM_LISTED_PEOPLE + 1,
      ),
    ]);

    const organizations = organizationPage.organizations;
    const organizationIds = organizations.map((organization) => organization.id);

    const [memberships, roundSummaries] = await Promise.all([
      managerRepo.findMembershipsByOrganizationIds(organizationIds),
      roundRepo.findSummariesByOrganizationIds(organizationIds),
    ]);

    // Only the people this page's memberships name. A membership whose manager
    // was deleted names nobody, and the card below skips that row rather than
    // failing over it.
    const managers = await managerRepo.findManagersByIds(
      Array.from(new Set(memberships.map((membership) => membership.managerId))),
    );
    const byId = new Map(managers.map((manager) => [manager.id, manager]));

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
      page: {
        search,
        page,
        pageSize,
        total: organizationPage.total,
        // A platform with no schools still has one page, and an empty one is
        // what the screen has a sentence for. Zero pages would make the pager
        // render "page 1 of 0".
        pageCount: Math.max(1, Math.ceil(organizationPage.total / pageSize)),
      },
      administrators: bounded(administrators, MAXIMUM_LISTED_PEOPLE),
      unattached: bounded(unattached, MAXIMUM_LISTED_PEOPLE),
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
   * The role is `manager`, the read-only half of `RolePermissionService`.
   *
   * It used to be `admin`, on the reading that a school gets one person who
   * does everything today's manager does. The owner decided otherwise on
   * 2026-08-23 (ADR-042): a school user hands out the anonymous link, watches
   * the count and reads the map, and every action on a round belongs to the
   * administrator. Under the old value that decision reached nobody — this is
   * the only place a school membership is created, so every school user was an
   * `admin` and the gate phase 6 installed had no one to refuse.
   *
   * "Administrator" in that decision is the platform administrator, the role
   * above the tenant. `admin` on a membership means something narrower —
   * everything inside one school — and nothing in the product creates one now.
   * The value stays in the type because the column is `String` and rows written
   * before this change still carry it.
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
    // The check above is a read, and two administrators inviting at once both
    // pass it. The store refuses the second, and that refusal is this same
    // answer — so the screen shows one message whichever of the two decided it.
    const membership = await refusingASecondStandingMembership(() =>
      managerRepo.saveMembership({
        id: crypto.randomUUID(),
        managerId: manager.id,
        organizationId: organization.id,
        role: "manager" as ManagerRole,
        status: "invited",
        createdAt: new Date(),
      }),
    );
    if (!membership.ok) return membership;

    return { ok: true, value: { manager, membership: membership.value } };
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

    // Restoring is the other way a school can end up with two standing people:
    // the read above says there is room, and an invitation issued in between
    // takes it. Same refusal, decided by the store.
    return refusingASecondStandingMembership(() =>
      managerRepo.saveMembership({ ...membership, status }),
    );
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
