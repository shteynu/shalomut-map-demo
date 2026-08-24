import type { AuditLogPage, IAuditLogRepository } from "./domain-contract";
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

/**
 * What an event names when it happened above every school: an administrator was
 * invited, and no school was involved. `unknown` would be a lie — it is not that
 * nobody knows which school, it is that there is none.
 */
export const PLATFORM_SCOPE = "platform";

export type AuditActionType =
  | typeof ADMINISTRATOR_SCHOOL_VISIT
  | "SETUP_SAVED"
  | "ROUND_CREATED"
  | "ROUND_STATUS_UPDATED"
  | "ROUND_RESET"
  | "SURVEY_DEFINITION_UPDATED"
  | "AI_TRIGGERED"
  | "SCHOOL_CREATED"
  | "MEMBER_INVITED"
  | "MEMBER_REVOKED"
  | "MEMBER_RESTORED"
  | "ADMINISTRATOR_INVITED";

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
   * One page of a school's log, to the administrators and to nobody else.
   *
   * An administrator may read any school's, which is the same reach they have
   * over everything else and is what makes their own visits reviewable at all.
   * A school may not read its own: the log records administrators opening the
   * school, so giving it to the school tells the school when it was being
   * looked at, and the owner answered that question `no` on 2026-08-24. The
   * comparison against the active organization that used to permit it is gone
   * rather than merely uncalled — a permission with no caller is a door left
   * open for whoever adds the next one.
   *
   * The page is passed through rather than resolved here: a caller that asks
   * for nothing gets the newest `DEFAULT_AUDIT_LOG_PAGE_SIZE` events, which is
   * the answer a screen wants and is bounded whichever store is behind it. The
   * whole log is deliberately not obtainable in one call — it is the one read
   * this table has, and it is the read that grows forever.
   */
  public static async getOrganizationAuditLogs(
    auditRepo: IAuditLogRepository,
    session: ManagerSession,
    targetOrganizationId: string,
    page?: AuditLogPage,
  ): Promise<AuditEvent[]> {
    if (!session.isPlatformAdministrator) {
      // Every other session, whether it belongs to this school or another one
      return [];
    }
    return auditRepo.findByOrganizationId(targetOrganizationId, page);
  }
}
