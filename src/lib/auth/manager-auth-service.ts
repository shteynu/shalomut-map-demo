import type { IManagerRepository } from "./domain-contract";
import type { Manager, OrganizationMembership } from "./types";

export type AuthFailureReason =
  | "INVALID_CREDENTIALS"
  | "USER_NOT_FOUND"
  | "ACCOUNT_SUSPENDED";

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

const DEFAULT_ORG_ID =
  process.env.MANAGER_ORGANIZATION_ID || "34d05e66-fa4d-4a07-a2af-c9d5c41b6088";

const DEFAULT_ADMIN_USER: Manager = {
  id: "mgr-admin-001",
  email: process.env.MANAGER_ADMIN_EMAIL || "admin@shalomut.edu.il",
  name: "מנהל מערכת ראשי",
  createdAt: new Date("2026-07-01T00:00:00.000Z"),
};

const DEFAULT_ADMIN_PASSWORD =
  process.env.MANAGER_ADMIN_PASSWORD || "admin123";

const DEFAULT_ADMIN_MEMBERSHIP: OrganizationMembership = {
  id: "mem-admin-001",
  managerId: DEFAULT_ADMIN_USER.id,
  organizationId: DEFAULT_ORG_ID,
  role: "admin",
  status: "active",
  createdAt: new Date("2026-07-01T00:00:00.000Z"),
};

const DEFAULT_MANAGER_USER: Manager = {
  id: "mgr-user-001",
  email: "manager@shalomut.edu.il",
  name: "מנהל בית ספר",
  createdAt: new Date("2026-07-01T00:00:00.000Z"),
};

const DEFAULT_MANAGER_PASSWORD = "manager123";

const DEFAULT_MANAGER_MEMBERSHIP: OrganizationMembership = {
  id: "mem-user-001",
  managerId: DEFAULT_MANAGER_USER.id,
  organizationId: DEFAULT_ORG_ID,
  role: "manager",
  status: "active",
  createdAt: new Date("2026-07-01T00:00:00.000Z"),
};

const DEFAULT_SUSPENDED_USER: Manager = {
  id: "mgr-suspended-001",
  email: "suspended@shalomut.edu.il",
  name: "משתמש מוקפא",
  createdAt: new Date("2026-07-01T00:00:00.000Z"),
};

const DEFAULT_SUSPENDED_PASSWORD = "suspended123";

const DEFAULT_SUSPENDED_MEMBERSHIP: OrganizationMembership = {
  id: "mem-suspended-001",
  managerId: DEFAULT_SUSPENDED_USER.id,
  organizationId: DEFAULT_ORG_ID,
  role: "manager",
  status: "suspended",
  createdAt: new Date("2026-07-01T00:00:00.000Z"),
};

interface StoredAccount {
  manager: Manager;
  password: string;
  memberships: OrganizationMembership[];
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
  private static defaultAccounts(): StoredAccount[] {
    return [
      {
        manager: DEFAULT_ADMIN_USER,
        password: DEFAULT_ADMIN_PASSWORD,
        memberships: [DEFAULT_ADMIN_MEMBERSHIP],
      },
      {
        manager: DEFAULT_MANAGER_USER,
        password: DEFAULT_MANAGER_PASSWORD,
        memberships: [DEFAULT_MANAGER_MEMBERSHIP],
      },
      {
        manager: DEFAULT_SUSPENDED_USER,
        password: DEFAULT_SUSPENDED_PASSWORD,
        memberships: [DEFAULT_SUSPENDED_MEMBERSHIP],
      },
    ];
  }

  public static async authenticateCredentials(
    email: string,
    password: string,
    repository?: IManagerRepository,
  ): Promise<AuthenticateResult> {
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

    const account = this.defaultAccounts().find(
      (acc) => acc.manager.email.toLowerCase() === normalizedEmail,
    );

    if (!account) {
      return {
        ok: false,
        reason: "USER_NOT_FOUND",
        message: "שם המשתמש או הסיסמה אינם נכונים",
      };
    }

    const passwordMatches = timingSafeEqualStrings(password, account.password);
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
