import type { ManagerRole } from "./types";

/**
 * Every distinct thing a signed-in person can ask a manager route to do.
 *
 * Owner decision, 2026-08-23: a school user reads and does not write. Every
 * action on a round — building its questionnaire, starting it, analysing it,
 * resetting it, and the goals chosen from its results — belongs to an
 * administrator. That is the table below, and it was already written this way
 * on 2026-08-20 with nothing calling it; what changed is that the routes now
 * ask.
 *
 * One action per thing that can be refused, not one per route. Two routes that
 * are the same act carry the same name, and a route that both reads and writes
 * names the one it is doing.
 */
export type ManagerAction =
  | "read:analytics"
  | "read:survey-definition"
  | "read:round-status"
  | "write:setup"
  | "write:create-round"
  | "write:survey-definition"
  | "write:update-round-status"
  | "write:trigger-ai"
  /**
   * Erasing what a round collected. Named apart from the status write it ends
   * with, because it is the one manager action that destroys respondent
   * answers rather than changing what the round is.
   */
  | "write:reset-round"
  /**
   * Choosing, updating and dropping the goals a round is tracking. A goal is
   * attached to a round and is a round action by the owner's rule, even though
   * it changes nothing about what the round measured.
   */
  | "write:goals"
  /**
   * Asking the provider to draft a question. It writes nothing and still
   * belongs here: it spends a paid call, and it is only useful to somebody who
   * can save the questionnaire it drafts for.
   */
  | "write:question-suggestion"
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
    "write:reset-round",
    "write:goals",
    "write:question-suggestion",
    "manage:members",
  ]),
  // Reads, and nothing else. Not an oversight to be filled in later: the
  // owner's rule is that every action on a round is an administrator's.
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
