import { NextResponse } from "next/server";
import { ManagerAdministrationService } from "@/lib/auth/manager-administration-service";
import {
  ManagerAuditService,
  PLATFORM_SCOPE,
} from "@/lib/auth/manager-audit-service";
import { runInTransaction } from "@/lib/composition-root";
import { requirePlatformAdministrator } from "@/lib/server/admin-area";
import { getDurableWriteGuardResponse } from "@/lib/server/durable-write-guard";
import { reportRouteFailure } from "@/lib/server/request-error-report";

/** What each refusal means to a caller, and what it is worth saying out loud. */
const REFUSALS: Record<string, { status: number; error: string }> = {
  INVALID_EMAIL: { status: 400, error: "That is not an address." },
  SCHOOL_NOT_FOUND: { status: 404, error: "School not found." },
  SCHOOL_ALREADY_HAS_SOMEBODY: {
    status: 409,
    error:
      "This school already has somebody. Revoke them first — a school has one user.",
  },
  ALREADY_AN_ADMINISTRATOR: {
    status: 409,
    error: "That address is already a platform administrator.",
  },
  MEMBERSHIP_NOT_FOUND: { status: 404, error: "Membership not found." },
};

/**
 * Invites one person: into a school when the body names one, into the platform
 * when it does not.
 *
 * One route for both because it is one act — deciding that an address may sign
 * in and saying what it reaches. The invitation carries no credential and no
 * link, so there is nothing to deliver: the person signs in with their
 * organizational account and the entitlement is already waiting.
 */
export async function POST(request: Request) {
  try {
    const unavailable = getDurableWriteGuardResponse();
    if (unavailable) return unavailable;

    const authorization = await requirePlatformAdministrator(request);
    if (!authorization.ok) return authorization.response;

    const body = (await request.json()) as {
      email?: unknown;
      name?: unknown;
      organizationId?: unknown;
    };
    const email = typeof body.email === "string" ? body.email : "";
    const name = typeof body.name === "string" ? body.name : undefined;
    const organizationId =
      typeof body.organizationId === "string" && body.organizationId.trim()
        ? body.organizationId.trim()
        : null;

    // Both invitations write and then record, and both do it in one
    // transaction, for the reason recorded on the membership route: the owner
    // decided on 2026-08-23 that these administrative audits are mandatory. An
    // invitation is an entitlement (ADR-027), so an invitation nobody recorded
    // is somebody holding access that the log cannot account for.
    //
    // A refusal is returned rather than thrown — nothing was written, so there
    // is nothing to roll back — and turned into a response outside, where the
    // transaction is already closed.
    if (!organizationId) {
      const result = await runInTransaction(
        async ({ auditLogRepo, managerRepo }) => {
          const outcome = await ManagerAdministrationService.inviteAdministrator(
            managerRepo,
            { email, name },
          );
          if (!outcome.ok) return outcome;

          await ManagerAuditService.logEvent(
            auditLogRepo,
            { ...authorization.session, activeOrganizationId: PLATFORM_SCOPE },
            "ADMINISTRATOR_INVITED",
            undefined,
            { email: outcome.value.email },
          );

          return outcome;
        },
      );
      if (!result.ok) return refuse(result.reason);

      return NextResponse.json(
        { success: true, manager: result.value },
        { status: 201 },
      );
    }

    const result = await runInTransaction(
      async ({ auditLogRepo, managerRepo, orgRepo }) => {
        const outcome = await ManagerAdministrationService.inviteSchoolUser(
          managerRepo,
          orgRepo,
          { email, name, organizationId },
        );
        if (!outcome.ok) return outcome;

        await ManagerAuditService.logEvent(
          auditLogRepo,
          { ...authorization.session, activeOrganizationId: organizationId },
          "MEMBER_INVITED",
          undefined,
          { email: outcome.value.manager.email },
        );

        return outcome;
      },
    );
    if (!result.ok) return refuse(result.reason);

    return NextResponse.json(
      {
        success: true,
        manager: result.value.manager,
        membership: result.value.membership,
      },
      { status: 201 },
    );
  } catch (error) {
    reportRouteFailure(error, request);
    return NextResponse.json(
      { error: "Failed to invite anybody." },
      { status: 500 },
    );
  }
}

function refuse(reason: string) {
  const refusal = REFUSALS[reason] ?? {
    status: 400,
    error: "That invitation was refused.",
  };
  return NextResponse.json({ error: refusal.error }, { status: refusal.status });
}
