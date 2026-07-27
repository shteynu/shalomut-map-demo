import type { IManagerRepository } from "./domain-contract";
import type { Manager, OrganizationMembership } from "./types";

export type AuthFailureReason =
  | "INVALID_CREDENTIALS"
  | "USER_NOT_FOUND"
  | "ACCOUNT_SUSPENDED"
  | "UNCONFIGURED";

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

function isDeployedRuntime(environment: RuntimeEnvironment = process.env) {
  const isBuilding = environment.NEXT_PHASE === "phase-production-build";

  return (
    (environment.NODE_ENV === "production" ||
      Boolean(environment.VERCEL_ENV?.trim())) &&
    !isBuilding
  );
}

export function resolveManagerOrganizationId(
  environment: RuntimeEnvironment = process.env,
): string | null {
  const configured = environment.MANAGER_ORGANIZATION_ID?.trim();
  if (configured) return configured;

  return isDeployedRuntime(environment) ? null : LOCAL_DEV_ORGANIZATION_ID;
}

const DEFAULT_ADMIN_USER: Manager = {
  id: "mgr-admin-001",
  email: process.env.MANAGER_ADMIN_EMAIL || "admin@shalomut.edu.il",
  name: "מנהל מערכת ראשי",
  createdAt: new Date("2026-07-01T00:00:00.000Z"),
};

const DEFAULT_MANAGER_USER: Manager = {
  id: "mgr-user-001",
  email: "manager@shalomut.edu.il",
  name: "מנהל בית ספר",
  createdAt: new Date("2026-07-01T00:00:00.000Z"),
};

const DEFAULT_SUSPENDED_USER: Manager = {
  id: "mgr-suspended-001",
  email: "suspended@shalomut.edu.il",
  name: "משתמש מוקפא",
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
    const hasAdminPassword = Boolean(
      process.env.MANAGER_ADMIN_PASSWORD?.trim(),
    );
    const hasOrganizationId = Boolean(resolveManagerOrganizationId());

    return !hasSecret || !hasAdminPassword || !hasOrganizationId;
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

  public static async authenticateCredentials(
    email: string,
    password: string,
    repository?: IManagerRepository,
  ): Promise<AuthenticateResult> {
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

    if (repository) {
      const manager = await repository.findByEmail(normalizedEmail);
      if (manager) {
        const memberships = await repository.findMembershipsByManagerId(manager.id);
        const hasActive = memberships.some((m) => m.status === "active");
        if (!hasActive) {
          return {
            ok: false,
            reason: "ACCOUNT_SUSPENDED",
            message: "חשבון זה מוקפא או שאין לו הרשאות פעילות בארגון",
          };
        }

        return {
          ok: true,
          manager,
          memberships,
        };
      }
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
}

