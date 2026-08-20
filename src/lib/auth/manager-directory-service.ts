import type { IManagerRepository } from "./domain-contract";
import type { Manager, OrganizationMembership } from "./types";

export type SignInRefusal = "USER_NOT_FOUND" | "NO_ACTIVE_MEMBERSHIP";

export type SignInResult =
  | {
      ok: true;
      manager: Manager;
      memberships: OrganizationMembership[];
      /** `null` for a platform administrator, who belongs to no school. */
      activeOrganizationId: string | null;
    }
  | { ok: false; reason: SignInRefusal };

interface DirectoryEnvironment {
  MANAGER_ADMIN_EMAIL?: string;
}

function currentEnvironment(): DirectoryEnvironment {
  return { MANAGER_ADMIN_EMAIL: process.env.MANAGER_ADMIN_EMAIL };
}

/**
 * Who an authenticated address turns out to be.
 *
 * The provider says *that* an address is genuine. This says whether that
 * address is anybody here, and it is the whole of the second half: signing in
 * with Google is not a way to acquire access, an invitation is. An address with
 * no row is refused however impeccably it authenticated.
 */
export class ManagerDirectoryService {
  public static async resolveSignIn(
    managerRepo: IManagerRepository,
    email: string,
    environment: DirectoryEnvironment = currentEnvironment(),
  ): Promise<SignInResult> {
    const normalized = email.trim().toLowerCase();
    if (!normalized) return { ok: false, reason: "USER_NOT_FOUND" };

    const manager =
      (await managerRepo.findByEmail(normalized)) ??
      (await this.bootstrapFirstAdministrator(
        managerRepo,
        normalized,
        environment,
      ));

    if (!manager) return { ok: false, reason: "USER_NOT_FOUND" };

    const memberships = await managerRepo.findMembershipsByManagerId(manager.id);
    const active = memberships.filter(
      (membership) => membership.status === "active",
    );

    if (active.length === 0 && !manager.isPlatformAdministrator) {
      return { ok: false, reason: "NO_ACTIVE_MEMBERSHIP" };
    }

    return {
      ok: true,
      manager,
      memberships,
      activeOrganizationId: active[0]?.organizationId ?? null,
    };
  }

  /**
   * The very first platform administrator, created the first time they sign in.
   *
   * The plan says "on first start". There is no start: the deployed runtime is
   * a set of functions that come and go, and a cold start that writes to the
   * database is a write nobody asked for on every scale-up. Doing it here is
   * the same guarantee with an occasion — the address is one the provider has
   * just verified, and the row is created once because the second call finds it.
   *
   * It is deliberately narrow. It creates nobody but the configured address, it
   * does nothing at all once an administrator exists, and it grants no school:
   * the first administrator's power is to create schools and invite people,
   * which is phase 2.
   */
  private static async bootstrapFirstAdministrator(
    managerRepo: IManagerRepository,
    email: string,
    environment: DirectoryEnvironment,
  ): Promise<Manager | null> {
    const configured = environment.MANAGER_ADMIN_EMAIL?.trim().toLowerCase();
    if (!configured || configured !== email) return null;

    if ((await managerRepo.countPlatformAdministrators()) > 0) return null;

    console.info(
      "[auth] no platform administrator existed; creating the first one from " +
        "MANAGER_ADMIN_EMAIL",
    );

    return managerRepo.saveManager({
      id: crypto.randomUUID(),
      email,
      name: email,
      isPlatformAdministrator: true,
      createdAt: new Date(),
    });
  }
}
