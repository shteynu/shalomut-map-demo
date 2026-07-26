import type { ManagerRole } from "./types";

export type ManagerAction =
  | "read:analytics"
  | "read:survey-definition"
  | "read:round-status"
  | "write:setup"
  | "write:create-round"
  | "write:survey-definition"
  | "write:update-round-status"
  | "write:trigger-ai"
  | "manage:members";

const ROLE_PERMISSIONS: Record<ManagerRole, Set<ManagerAction>> = {
  admin: new Set<ManagerAction>([
    "read:analytics",
    "read:survey-definition",
    "read:round-status",
    "write:setup",
    "write:create-round",
    "write:survey-definition",
    "write:update-round-status",
    "write:trigger-ai",
    "manage:members",
  ]),
  manager: new Set<ManagerAction>([
    "read:analytics",
    "read:survey-definition",
    "read:round-status",
  ]),
};

export class RolePermissionService {
  public static hasPermission(
    role: ManagerRole,
    action: ManagerAction,
  ): boolean {
    const permissions = ROLE_PERMISSIONS[role];
    return permissions ? permissions.has(action) : false;
  }

  public static enforcePermission(
    role: ManagerRole,
    action: ManagerAction,
  ): { allowed: true } | { allowed: false; reason: string } {
    if (this.hasPermission(role, action)) {
      return { allowed: true };
    }
    return {
      allowed: false,
      reason: `Role '${role}' is not authorized to perform action '${action}'. Required: 'admin'.`,
    };
  }
}
