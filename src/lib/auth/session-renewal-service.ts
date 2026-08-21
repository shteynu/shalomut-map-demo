import type { IManagerRepository, ISessionProvider } from "./domain-contract";
import { isIdentityProviderConfigured } from "./identity-provider";
import { ManagerAuthenticationService } from "./manager-auth-service";
import { ttlSecondsWithin } from "./session-lifetime";
import type { Manager, ManagerSession, OrganizationMembership } from "./types";

export type RenewalRefusal =
  /** The twelve hours are up. No amount of activity is an answer to this one. */
  | "SESSION_EXPIRED"
  /** The row behind the session is gone. */
  | "USER_NOT_FOUND"
  /** Every membership was taken away, and this is not an administrator. */
  | "NO_ACTIVE_MEMBERSHIP"
  /** The particular school this session was reading is no longer theirs. */
  | "SCHOOL_REVOKED";

export type RenewalResult =
  | { ok: true; token: string; session: ManagerSession }
  | { ok: false; reason: RenewalRefusal };

/**
 * The one moment a live session is checked against the database.
 *
 * The token carries memberships and the administrator flag precisely so the
 * middleware can answer "may this request open that school" without a query —
 * Seoul database, Washington functions, roughly 180 ms each time. The price of
 * that is a token which keeps asserting what was true when it was minted, and
 * before this existed the assertion was good for a day: the phase 2 walk
 * watched a revoked person go on reading their school.
 *
 * So the window is short and this is what happens at the end of it. Everything
 * the token claims is re-read here — the person, their memberships, their role,
 * the administrator flag — and a session that no longer deserves to exist is
 * refused rather than re-minted.
 *
 * It reads and does not write. An invitation is accepted by signing in
 * (`ManagerDirectoryService.resolveSignIn`), and renewal is not a sign-in: a
 * school offered to somebody mid-session reaches them at their next one, which
 * is the same day at the latest. Granting access on a renewal would make this
 * a second, quieter sign-in path with no audit event behind it.
 */
export class SessionRenewalService {
  public static async renew(
    managerRepo: IManagerRepository,
    sessionProvider: ISessionProvider,
    session: ManagerSession,
    now: Date = new Date(),
    providerConfigured: boolean = isIdentityProviderConfigured(),
  ): Promise<RenewalResult> {
    const ttlSeconds = ttlSecondsWithin(session.absoluteExpiresAt, now);
    if (ttlSeconds <= 0) {
      return { ok: false, reason: "SESSION_EXPIRED" };
    }

    const entry = await this.readDirectory(
      managerRepo,
      session.managerId,
      providerConfigured,
    );
    if (!entry) {
      return { ok: false, reason: "USER_NOT_FOUND" };
    }

    const { manager, memberships } = entry;
    const active = memberships.filter(
      (membership) => membership.status === "active",
    );

    if (active.length === 0 && !manager.isPlatformAdministrator) {
      return { ok: false, reason: "NO_ACTIVE_MEMBERSHIP" };
    }

    // An administrator's session names no school — they belong to none and open
    // one per visit, through the school cookie the middleware reads. So the
    // only session with a school to re-check is a school user's, and for them
    // the check is the whole point.
    const namedSchool = session.activeOrganizationId;
    if (
      namedSchool &&
      !active.some((membership) => membership.organizationId === namedSchool)
    ) {
      // Refused rather than moved to whichever school is left. Sliding somebody
      // sideways into a different school mid-session would change what they are
      // reading without saying so; signing in again lands them on the same
      // school this would have chosen, and says it.
      return { ok: false, reason: "SCHOOL_REVOKED" };
    }

    const { token, session: renewed } = await sessionProvider.createSession(
      manager,
      namedSchool,
      memberships,
      { ttlSeconds, absoluteExpiresAt: session.absoluteExpiresAt },
    );

    return { ok: true, token, session: renewed };
  }

  /**
   * Which directory can still vouch for this session, which is not a property
   * of the session but of the runtime.
   *
   * Two doors exist and only one is ever open. `authenticateCredentials`
   * refuses outright once a provider is configured, and the OIDC callback
   * cannot run without one — so a runtime with a provider has only
   * provider sessions, whose managers are rows, and a runtime without one has
   * only password sessions, whose managers are constants assembled from
   * environment variables and have no rows at all.
   *
   * Reading the configuration rather than a claim in the token is what makes
   * the closing of that door mean something: configure a provider and the
   * password sessions still in browsers are refused at their next renewal,
   * because the directory that knew them is no longer the one being asked.
   */
  private static async readDirectory(
    managerRepo: IManagerRepository,
    managerId: string,
    providerConfigured: boolean,
  ): Promise<{
    manager: Manager;
    memberships: OrganizationMembership[];
  } | null> {
    if (!providerConfigured) {
      return ManagerAuthenticationService.findAccountById(managerId);
    }

    const manager = await managerRepo.findById(managerId);
    if (!manager) return null;

    return {
      manager,
      memberships: await managerRepo.findMembershipsByManagerId(manager.id),
    };
  }
}
