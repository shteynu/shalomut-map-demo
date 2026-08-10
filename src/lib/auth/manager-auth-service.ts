import { isDeployedRuntime as isDeployedRuntimeShared } from "@/lib/deployment-runtime";

import { isIdentityProviderConfigured } from "./identity-provider";
import type { Manager, OrganizationMembership } from "./types";

export type AuthFailureReason =
  | "INVALID_CREDENTIALS"
  | "USER_NOT_FOUND"
  | "ACCOUNT_SUSPENDED"
  | "UNCONFIGURED"
  /** This runtime signs in through the identity provider, so there is no password to check. */
  | "PROVIDER_REQUIRED";

export type AuthenticateResult =
  | {
      ok: true;
      manager: Manager;
      memberships: OrganizationMembership[];
    }
  | {
      ok: false;
      reason: AuthFailureReason;
      message: string;
    };

interface RuntimeEnvironment {
  NODE_ENV?: string;
  VERCEL_ENV?: string;
  NEXT_PHASE?: string;
  SESSION_SECRET?: string;
  MANAGER_ADMIN_PASSWORD?: string;
  MANAGER_ORGANIZATION_ID?: string;
}

/**
 * Organization scope used only outside a deployed runtime. On a deployed
 * runtime MANAGER_ORGANIZATION_ID is mandatory: a session bound to a stale or
 * non-existent organization leaves every manager screen silently empty, so the
 * login fails loudly with UNCONFIGURED instead.
 */
const LOCAL_DEV_ORGANIZATION_ID = "local-dev-organization";

/**
 * One predicate, shared with the session provider and the machine-to-machine
 * door. It used to be written out here, and the third copy — in
 * `server/shared-secret.ts` — had drifted into asking a weaker question.
 */
function isDeployedRuntime(environment: RuntimeEnvironment = process.env) {
  return isDeployedRuntimeShared(environment);
}

export function resolveManagerOrganizationId(
  environment: RuntimeEnvironment = process.env,
): string | null {
  const configured = environment.MANAGER_ORGANIZATION_ID?.trim();
  if (configured) return configured;

  return isDeployedRuntime(environment) ? null : LOCAL_DEV_ORGANIZATION_ID;
}

/**
 * Why a deployed runtime refuses to run on a weak manager password.
 *
 * There is one manager account per deployment (ADR-020), so an attacker's
 * entire search space is this one password, and the sign-in URL is public. Rate
 * limiting slows guessing down — and on serverless the counters are
 * per-instance, so the real ceiling is the limit times however many instances
 * the attacker's own parallelism warms. That arithmetic only matters against a
 * password worth guessing: a generated one is unreachable at any of those
 * rates, and a chosen one falls at all of them. So the password is the control,
 * and this is the only place that can insist on it.
 *
 * `MANAGER_ADMIN_PASSWORD` was previously required to be non-empty and nothing
 * more; `123` was accepted. The requirement lived in `.env.example` and in the
 * tracker, which is to say it depended on someone reading a document.
 *
 * The rules are deliberately crude. Length is the only property that survives
 * every guess about how the value was produced, and the other two exist to stop
 * a long value that is not actually varied. `openssl rand -hex 32` — what
 * `.env.example` tells the operator to run — passes with room: 64 characters
 * and sixteen distinct ones.
 */
const MINIMUM_PASSWORD_LENGTH = 16;
const MINIMUM_DISTINCT_CHARACTERS = 8;

/**
 * Not a dictionary, and not pretending to be one. It holds the values this
 * repository itself has published — the local default and the seeded
 * accounts — because those are the ones that reach a deployment by being
 * copied out of a README, plus a few that any list would be strange to omit.
 * A serious guess list is what length is for.
 */
const WELL_KNOWN_PASSWORDS = new Set([
  "admin123",
  "manager123",
  "suspended123",
  "password",
  "password123",
  "changeme",
  "letmein",
  "123456",
  "12345678",
  "qwerty",
  "shalomut",
]);

export type ManagerPasswordWeakness =
  | "well-known"
  | "too-short"
  | "too-few-distinct-characters";

/**
 * The reason this password may not run a deployment, or `null` when it may.
 *
 * Exported so the failure can be named in a log and asserted in a test. It is
 * never returned to a caller: an anonymous request that learns *which* rule the
 * configuration broke has learned something about the password.
 */
export function managerPasswordWeakness(
  password: string,
): ManagerPasswordWeakness | null {
  const value = password.trim();

  if (WELL_KNOWN_PASSWORDS.has(value.toLowerCase())) return "well-known";
  if (value.length < MINIMUM_PASSWORD_LENGTH) return "too-short";
  if (new Set(value).size < MINIMUM_DISTINCT_CHARACTERS) {
    return "too-few-distinct-characters";
  }

  return null;
}

const DEFAULT_ADMIN_USER: Manager = {
  id: "mgr-admin-001",
  email: process.env.MANAGER_ADMIN_EMAIL || "admin@shalomut.edu.il",
  name: "מנהל מערכת ראשי",
  // Not a platform administrator. This account administers one school in a
  // local runtime; the platform administrator of the 2026-08-20 model is a row
  // with the flag set, created by the bootstrap and reachable only through the
  // identity provider.
  isPlatformAdministrator: false,
  createdAt: new Date("2026-07-01T00:00:00.000Z"),
};

const DEFAULT_MANAGER_USER: Manager = {
  id: "mgr-user-001",
  email: "manager@shalomut.edu.il",
  name: "מנהל בית ספר",
  isPlatformAdministrator: false,
  createdAt: new Date("2026-07-01T00:00:00.000Z"),
};

const DEFAULT_SUSPENDED_USER: Manager = {
  id: "mgr-suspended-001",
  email: "suspended@shalomut.edu.il",
  name: "משתמש מוקפא",
  isPlatformAdministrator: false,
  createdAt: new Date("2026-07-01T00:00:00.000Z"),
};

function buildMembership(
  id: string,
  manager: Manager,
  organizationId: string,
  role: OrganizationMembership["role"],
  status: OrganizationMembership["status"],
): OrganizationMembership {
  return {
    id,
    managerId: manager.id,
    organizationId,
    role,
    status,
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
  };
}

interface StoredAccount {
  manager: Manager;
  passwordHash: string;
  memberships: OrganizationMembership[];
}

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`shalomut_salt_2026:${password}`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqualStrings(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);

  if (aBytes.length !== bBytes.length) return false;

  let mismatch = 0;
  for (let i = 0; i < aBytes.length; i++) {
    mismatch |= aBytes[i] ^ bBytes[i];
  }
  return mismatch === 0;
}

export class ManagerAuthenticationService {
  public static isUnconfigured(): boolean {
    if (!isDeployedRuntime()) return false;

    const hasSecret = Boolean(process.env.SESSION_SECRET?.trim());
    const adminPassword = process.env.MANAGER_ADMIN_PASSWORD?.trim() ?? "";
    const hasOrganizationId = Boolean(resolveManagerOrganizationId());

    return (
      !hasSecret ||
      !adminPassword ||
      this.hasUnusablePassword(adminPassword) ||
      !hasOrganizationId
    );
  }

  /**
   * A weak password is a misconfiguration, and it is treated as one: the
   * deployment answers `UNCONFIGURED` exactly as it does with no password at
   * all, rather than starting and hoping.
   *
   * This fails closed on purpose. The alternative considered was a warning —
   * run anyway, log a complaint — which is the shape of a check that nobody
   * reads until the incident. A refusal is visible in one sign-in attempt, and
   * the fix is one environment variable.
   *
   * The reason is written to the server log and to nowhere else. The caller
   * gets the generic message the missing-variable case already returns, for the
   * same reason `/api/health` reports no credential state: telling an anonymous
   * request which rule the password broke tells it where to push.
   */
  private static hasUnusablePassword(password: string): boolean {
    const weakness = managerPasswordWeakness(password);
    if (!weakness) return false;

    console.error(
      `MANAGER_ADMIN_PASSWORD is unusable on a deployed runtime (${weakness}); ` +
        "manager sign-in answers UNCONFIGURED until it is replaced. " +
        "Generate one with `openssl rand -hex 32`.",
    );

    return true;
  }

  private static async defaultAccounts(): Promise<StoredAccount[]> {
    const organizationId = resolveManagerOrganizationId();
    if (!organizationId) {
      return [];
    }

    const configuredAdminPassword = process.env.MANAGER_ADMIN_PASSWORD?.trim();

    if (isDeployedRuntime()) {
      if (!configuredAdminPassword) {
        return [];
      }
      return [
        {
          manager: DEFAULT_ADMIN_USER,
          passwordHash: await hashPassword(configuredAdminPassword),
          memberships: [
            buildMembership(
              "mem-admin-001",
              DEFAULT_ADMIN_USER,
              organizationId,
              "admin",
              "active",
            ),
          ],
        },
      ];
    }

    const adminPass = configuredAdminPassword || "admin123";
    return [
      {
        manager: DEFAULT_ADMIN_USER,
        passwordHash: await hashPassword(adminPass),
        memberships: [
          buildMembership(
            "mem-admin-001",
            DEFAULT_ADMIN_USER,
            organizationId,
            "admin",
            "active",
          ),
        ],
      },
      {
        manager: DEFAULT_MANAGER_USER,
        passwordHash: await hashPassword("manager123"),
        memberships: [
          buildMembership(
            "mem-user-001",
            DEFAULT_MANAGER_USER,
            organizationId,
            "manager",
            "active",
          ),
        ],
      },
      {
        manager: DEFAULT_SUSPENDED_USER,
        passwordHash: await hashPassword("suspended123"),
        memberships: [
          buildMembership(
            "mem-suspended-001",
            DEFAULT_SUSPENDED_USER,
            organizationId,
            "manager",
            "suspended",
          ),
        ],
      },
    ];
  }

  /**
   * The interim door: an e-mail and a password, checked against accounts this
   * process assembles from environment variables.
   *
   * It is on its way out and the successor already exists. Identity comes from
   * an external provider (owner decision, 2026-08-20) and manager rows say who
   * may sign in; `ManagerDirectoryService` is that half, and
   * `/api/auth/oidc/callback` is the door. This one answers only while no
   * provider is configured — a local runtime, or a deployment whose OAuth
   * client has not been created yet — and refuses outright once one is.
   *
   * That is also why it was never made repository-backed. Reading managers from
   * the database here would be work on a path being deleted, and it would break
   * the local accounts this method exists to serve, which have no rows.
   *
   * `Manager` carries no credential and never will, which is why the optional
   * `IManagerRepository` this used to take was removed rather than fixed: with
   * one passed, it returned a session for any manager found by e-mail, with no
   * password checked, because there was none to check.
   */
  public static async authenticateCredentials(
    email: string,
    password: string,
  ): Promise<AuthenticateResult> {
    // The one rule that keeps this path from outliving its replacement: where
    // an identity provider is configured, it is the only way in. The password
    // accounts below are the interim door of a runtime that has no provider
    // yet, and this is the line that closes it the day one appears — rather
    // than a second, quieter way in that nobody remembers to remove.
    if (isIdentityProviderConfigured()) {
      return {
        ok: false,
        reason: "PROVIDER_REQUIRED",
        message: "יש להתחבר עם החשבון הארגוני",
      };
    }

    if (this.isUnconfigured()) {
      return {
        ok: false,
        reason: "UNCONFIGURED",
        message:
          "שרת התחברות המנהלים אינו מוגדר בסביבה זו (חסרות הגדרות סביבה נדרשות)",
      };
    }

    const normalizedEmail = email?.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      return {
        ok: false,
        reason: "INVALID_CREDENTIALS",
        message: "יש להזין כתובת דוא\"ל וסיסמה",
      };
    }

    const accounts = await this.defaultAccounts();
    const account = accounts.find(
      (acc) => acc.manager.email.toLowerCase() === normalizedEmail,
    );

    if (!account) {
      return {
        ok: false,
        reason: "USER_NOT_FOUND",
        message: "שם המשתמש או הסיסמה אינם נכונים",
      };
    }

    const inputHash = await hashPassword(password);
    const passwordMatches = timingSafeEqualStrings(inputHash, account.passwordHash);
    if (!passwordMatches) {
      return {
        ok: false,
        reason: "INVALID_CREDENTIALS",
        message: "שם המשתמש או הסיסמה אינם נכונים",
      };
    }

    const activeMemberships = account.memberships.filter((m) => m.status === "active");
    if (activeMemberships.length === 0) {
      return {
        ok: false,
        reason: "ACCOUNT_SUSPENDED",
        message: "חשבון זה מוקפא או שאין לו הרשאות פעילות בארגון",
      };
    }

    return {
      ok: true,
      manager: account.manager,
      memberships: account.memberships,
    };
  }

  /**
   * The same account again, without asking for the password a second time.
   *
   * Renewal re-reads whichever directory the session came from, and for this
   * path the directory is the environment: these managers are constants in this
   * file with no row anywhere, which is what `authenticateCredentials` says
   * above and the reason it was never made repository-backed. Looking them up
   * in `managers` finds nothing, so a short session would sign a password
   * manager out one renewal after letting them in — the deployed endpoint is on
   * this path until its OAuth client exists.
   *
   * No password is checked because none is being offered: the caller is holding
   * a signed session this runtime minted, and the question is whether the
   * account behind it is still there.
   */
  public static async findAccountById(
    managerId: string,
  ): Promise<{ manager: Manager; memberships: OrganizationMembership[] } | null> {
    const accounts = await this.defaultAccounts();
    const account = accounts.find((acc) => acc.manager.id === managerId);
    if (!account) return null;

    return { manager: account.manager, memberships: account.memberships };
  }
}

