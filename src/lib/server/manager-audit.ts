import type { IAuditLogRepository } from "@/lib/auth/domain-contract";
import { JwtSessionProvider } from "@/lib/auth/jwt-session-provider";
import {
  ADMINISTRATOR_SCHOOL_VISIT,
  ManagerAuditService,
  type AuditActionType,
} from "@/lib/auth/manager-audit-service";
import type { ManagerSession } from "@/lib/auth/types";
import { SESSION_COOKIE_NAME } from "@/lib/server/session-auth";

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
 *
 * The repository is an argument because the composition root is the only place
 * that decides which store this is. It used to be a process-local getter living
 * in this file, which is why `check-composition-root.mjs` carried an explicit
 * exception for it; the exception went away with the table.
 */
export async function recordRoundAuditEvent(
  auditRepo: IAuditLogRepository,
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
    isPlatformAdministrator: session?.isPlatformAdministrator ?? false,
    issuedAt: session?.issuedAt ?? new Date(),
    expiresAt: session?.expiresAt ?? new Date(),
  };

  try {
    await ManagerAuditService.logEvent(
      auditRepo,
      auditSession,
      action,
      roundId,
      details,
    );
  } catch (error) {
    // Auditing must never break the action it records. A write is a thing the
    // manager is entitled to do in their own school, and refusing it because
    // the log is unreachable would take away access rather than record it.
    // The administrator's *read* below is the opposite case and is refused.
    console.warn(
      `[audit] ${action} on round ${roundId} was not recorded: ` +
        (error instanceof Error ? error.message : String(error)),
    );
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

/**
 * How long one recorded visit speaks for.
 *
 * One screen is a dozen requests and a manager stays on it, so a row per request
 * would bury the log it is supposed to make readable. Fifteen minutes is the
 * same window revocation was decided on: a visit that is still going and a visit
 * that just started are the same event at that resolution.
 */
const VISIT_WINDOW_MS = 15 * 60 * 1000;

const recentVisits = new Map<string, number>();

function alreadyRecorded(key: string, now: number): boolean {
  const seen = recentVisits.get(key);
  if (seen !== undefined && now - seen < VISIT_WINDOW_MS) return true;

  // Pruning here rather than on a timer: the map is only ever read on this
  // path, so this is the moment it is known to be worth walking.
  for (const [visited, at] of recentVisits) {
    if (now - at >= VISIT_WINDOW_MS) recentVisits.delete(visited);
  }

  recentVisits.set(key, now);
  return false;
}

/** Test seam: forgets every window, so one test's visit is not another's. */
export function resetVisitWindowForTests() {
  recentVisits.clear();
}

/**
 * Records that a platform administrator opened a school they are not a member
 * of, and says whether the record exists.
 *
 * `false` means the read must not happen. This is the one audited thing the
 * product fails closed on, and the reason is what the role is: about four people
 * can open every school's results, and the log is the whole of what distinguishes
 * a legitimate support visit from an unaccountable one. A read nobody can
 * reconstruct is worse than a read that did not happen.
 *
 * Everyone else returns `true` without a row. A manager reading their own school
 * is the product working, not an event.
 *
 * The deduplication window is process-local, so two instances can each record
 * the same visit. An audit log would rather hold the visit twice than miss it,
 * and the dedup exists to keep the log readable, not to make it exact.
 */
export async function recordAdministratorSchoolVisit(
  auditRepo: IAuditLogRepository,
  request: Pick<Request, "headers">,
  organizationId: string,
  roundId?: string,
): Promise<boolean> {
  const session = await resolveActor(request);
  if (!session?.isPlatformAdministrator) return true;

  const isMember = session.memberships.some(
    (membership) =>
      membership.organizationId === organizationId &&
      membership.status === "active",
  );
  if (isMember) return true;

  const key = `${session.managerId}:${organizationId}`;
  if (alreadyRecorded(key, Date.now())) return true;

  try {
    await ManagerAuditService.logEvent(
      auditRepo,
      { ...session, activeOrganizationId: organizationId },
      ADMINISTRATOR_SCHOOL_VISIT,
      roundId,
      { email: session.email },
    );
  } catch (error) {
    // The window was already claimed above, and this visit never happened, so
    // the claim has to be released — otherwise one failed write would silence
    // the next fifteen minutes of visits.
    recentVisits.delete(key);
    console.error(
      "[audit] a platform administrator's visit to " +
        `${organizationId} could not be recorded, so it was refused: ` +
        (error instanceof Error ? error.message : String(error)),
    );
    return false;
  }

  console.info(
    JSON.stringify({
      audit: ADMINISTRATOR_SCHOOL_VISIT,
      organizationId,
      roundId,
      managerId: session.managerId,
      at: new Date().toISOString(),
    }),
  );

  return true;
}

/** The refusal a caller owes the administrator when the visit cannot be recorded. */
export const UNRECORDABLE_VISIT_MESSAGE =
  "This school cannot be opened right now: the visit could not be recorded.";
