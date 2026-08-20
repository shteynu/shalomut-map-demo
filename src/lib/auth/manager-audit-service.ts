import type { IAuditLogRepository } from "./domain-contract";
import type { AuditEvent, ManagerSession } from "./types";

/**
 * A platform administrator opened a school they are not a member of.
 *
 * The only read in a list that is otherwise all writes, and the reason the list
 * needed one: an administrator reading a school is precisely the action nothing
 * else records. It is exported as a constant because the recorder fails closed
 * on it and a typo would be a silent hole rather than an error.
 */
export const ADMINISTRATOR_SCHOOL_VISIT = "ADMINISTRATOR_SCHOOL_VISIT";

export type AuditActionType =
  | typeof ADMINISTRATOR_SCHOOL_VISIT
  | "SETUP_SAVED"
  | "ROUND_CREATED"
  | "ROUND_STATUS_UPDATED"
  | "ROUND_RESET"
  | "SURVEY_DEFINITION_UPDATED"
  | "AI_TRIGGERED"
  | "MEMBER_INVITED"
  | "MEMBER_ROLE_CHANGED";

export class ManagerAuditService {
  public static async logEvent(
    auditRepo: IAuditLogRepository,
    session: ManagerSession,
    action: AuditActionType,
    roundId?: string,
    details?: Record<string, unknown>,
  ): Promise<AuditEvent> {
    const event: AuditEvent = {
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      timestamp: new Date(),
      action,
      managerId: session.managerId,
      // A platform administrator's session names no school, so an event filed
      // from the session alone cannot say which one. The production path,
      // `recordRoundAuditEvent`, takes the school from the authorized round and
      // never from here — which is exactly why it takes it as an argument.
      organizationId: session.activeOrganizationId ?? 'unknown',
      roundId,
      details,
    };

    return auditRepo.recordEvent(event);
  }

  /**
   * One school's log, to whoever may read it.
   *
   * An administrator may read any school's, which is the same reach they have
   * over everything else and is what makes their own visits reviewable at all.
   * Whether a school's own user should see the visits made to it is deliberately
   * still open — it is a question for the administrators rather than for this
   * function, and today nothing renders either answer.
   */
  public static async getOrganizationAuditLogs(
    auditRepo: IAuditLogRepository,
    session: ManagerSession,
    targetOrganizationId: string,
  ): Promise<AuditEvent[]> {
    const mayRead =
      session.isPlatformAdministrator ||
      session.activeOrganizationId === targetOrganizationId;
    if (!mayRead) {
      // Hiding foreign organization audit logs
      return [];
    }
    return auditRepo.findByOrganizationId(targetOrganizationId);
  }
}
