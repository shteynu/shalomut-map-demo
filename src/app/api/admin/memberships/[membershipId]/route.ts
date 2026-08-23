import { NextResponse } from "next/server";
import { ManagerAdministrationService } from "@/lib/auth/manager-administration-service";
import { ManagerAuditService } from "@/lib/auth/manager-audit-service";
import { runInTransaction } from "@/lib/composition-root";
import { requirePlatformAdministrator } from "@/lib/server/admin-area";
import { getDurableWriteGuardResponse } from "@/lib/server/durable-write-guard";

/**
 * Takes a school's person away, or gives them back.
 *
 * Revocation reaches the boundary within a quarter of an hour rather than
 * immediately: the session token carries its memberships, and the middleware
 * trusts them without a query on purpose. What phase 5 changed is how long that
 * trust lasts — the token expires in `SESSION_TTL_SECONDS` and the renewal that
 * would replace it re-reads this row, so a revoked person's next renewal is
 * refused and the token they are holding runs out on its own. An administrator
 * who needs it to be immediate still has to say so; nothing here can make it so.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ membershipId: string }> },
) {
  try {
    const unavailable = getDurableWriteGuardResponse();
    if (unavailable) return unavailable;

    const authorization = await requirePlatformAdministrator(request);
    if (!authorization.ok) return authorization.response;

    const { membershipId } = await params;
    const body = (await request.json()) as {
      status?: unknown;
      organizationId?: unknown;
    };
    const status = body.status === "active" ? "active" : "suspended";
    const organizationId =
      typeof body.organizationId === "string" ? body.organizationId.trim() : "";

    if (!organizationId) {
      return NextResponse.json(
        { error: "The school this membership belongs to must be named." },
        { status: 400 },
      );
    }

    // The change and its record commit together, because the owner's decision
    // of 2026-08-23 is that this audit is mandatory rather than best effort.
    // Until then the record was written after the change and outside any
    // transaction, so an audit insert that failed left the membership changed,
    // answered 500, and left nothing behind saying who changed it — the worst
    // of the three possible outcomes, because the administrator reads a failure
    // and the row disagrees with them.
    //
    // A refusal is returned rather than thrown: nothing was written, so there
    // is nothing to roll back and nothing to record.
    const result = await runInTransaction(async ({ auditLogRepo, managerRepo }) => {
      const outcome = await ManagerAdministrationService.setMembershipStatus(
        managerRepo,
        organizationId,
        membershipId,
        status,
      );
      if (!outcome.ok) return outcome;

      await ManagerAuditService.logEvent(
        auditLogRepo,
        { ...authorization.session, activeOrganizationId: organizationId },
        status === "active" ? "MEMBER_RESTORED" : "MEMBER_REVOKED",
        undefined,
        { managerId: outcome.value.managerId },
      );

      return outcome;
    });

    if (!result.ok) {
      return NextResponse.json(
        {
          error:
            result.reason === "MEMBERSHIP_NOT_FOUND"
              ? "Membership not found."
              : "This school already has somebody.",
        },
        { status: result.reason === "MEMBERSHIP_NOT_FOUND" ? 404 : 409 },
      );
    }

    return NextResponse.json({ success: true, membership: result.value });
  } catch (error) {
    // The message is a constant. What went wrong here is a database error or a
    // constraint name, and the caller of this endpoint is a browser: it can act
    // on "this did not happen" and cannot act on the rest. The detail goes to
    // the log, where an administrator can reach it and a stranger cannot.
    console.error(
      "Changing a membership failed:",
      error instanceof Error ? error.message : "unknown error",
    );
    return NextResponse.json(
      { error: "Failed to change the membership." },
      { status: 500 },
    );
  }
}
