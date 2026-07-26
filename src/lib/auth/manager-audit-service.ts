import type { IAuditLogRepository } from "./domain-contract";
import type { AuditEvent, ManagerSession } from "./types";

export type AuditActionType =
  | "SETUP_SAVED"
  | "ROUND_CREATED"
  | "ROUND_STATUS_UPDATED"
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
      organizationId: session.activeOrganizationId,
      roundId,
      details,
    };

    return auditRepo.recordEvent(event);
  }

  public static async getOrganizationAuditLogs(
    auditRepo: IAuditLogRepository,
    session: ManagerSession,
    targetOrganizationId: string,
  ): Promise<AuditEvent[]> {
    if (session.activeOrganizationId !== targetOrganizationId) {
      // Hiding foreign organization audit logs
      return [];
    }
    return auditRepo.findByOrganizationId(targetOrganizationId);
  }
}
