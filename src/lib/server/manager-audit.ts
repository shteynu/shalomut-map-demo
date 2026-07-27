import { InMemoryAuditLogRepository } from "@/lib/auth/domain-contract";
import type { IAuditLogRepository } from "@/lib/auth/domain-contract";
import { JwtSessionProvider } from "@/lib/auth/jwt-session-provider";
import {
  ManagerAuditService,
  type AuditActionType,
} from "@/lib/auth/manager-audit-service";
import type { ManagerSession } from "@/lib/auth/types";
import { SESSION_COOKIE_NAME } from "@/lib/server/session-auth";

let auditRepository: IAuditLogRepository | null = null;

/**
 * Process-local audit log. It survives a single runtime instance only, so the
 * structured log line below is what makes a destructive action traceable in
 * deployment logs. A durable audit table is a separate, migration-gated slice.
 */
export function getAuditLogRepository(): IAuditLogRepository {
  if (!auditRepository) {
    auditRepository = new InMemoryAuditLogRepository();
  }
  return auditRepository;
}

export function setAuditLogRepositoryForTests(
  repository: IAuditLogRepository | null,
) {
  auditRepository = repository;
}

function readSessionToken(request: Pick<Request, "headers">): string | null {
  const authorization = request.headers.get("authorization");
  if (authorization?.toLowerCase().startsWith("bearer ")) {
    return authorization.slice(7).trim() || null;
  }

  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;

  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === SESSION_COOKIE_NAME) {
      return rest.join("=").trim() || null;
    }
  }

  return null;
}

async function resolveActor(
  request: Pick<Request, "headers">,
): Promise<ManagerSession | null> {
  const token = readSessionToken(request);
  if (!token) return null;

  try {
    return await new JwtSessionProvider().verifyToken(token);
  } catch {
    // Missing session secret or an invalid token: the action is still audited,
    // just without an identified actor.
    return null;
  }
}

/**
 * Records a manager action against a round. Never receives respondent data —
 * only counts and identifiers a manager already sees.
 */
export async function recordRoundAuditEvent(
  request: Pick<Request, "headers">,
  action: AuditActionType,
  roundId: string,
  organizationId: string,
  details?: Record<string, unknown>,
): Promise<void> {
  const session = await resolveActor(request);

  // The organization comes from the authorized round, so the event is filed
  // against the right school even when the actor cannot be identified (for
  // example a machine-run reset without a manager session).
  const auditSession: ManagerSession = {
    managerId: session?.managerId ?? "unknown",
    email: session?.email ?? "unknown",
    role: session?.role ?? "manager",
    activeOrganizationId: organizationId,
    memberships: session?.memberships ?? [],
    issuedAt: session?.issuedAt ?? new Date(),
    expiresAt: session?.expiresAt ?? new Date(),
  };

  try {
    await ManagerAuditService.logEvent(
      getAuditLogRepository(),
      auditSession,
      action,
      roundId,
      details,
    );
  } catch {
    // Auditing must never break the action it records.
  }

  console.info(
    JSON.stringify({
      audit: action,
      roundId,
      organizationId,
      managerId: auditSession.managerId,
      at: new Date().toISOString(),
      ...details,
    }),
  );
}
