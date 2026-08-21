import { NextResponse } from "next/server";
import { ManagerAdministrationService } from "@/lib/auth/manager-administration-service";
import { ManagerAuditService } from "@/lib/auth/manager-audit-service";
import { resolveCoreRepositories } from "@/lib/composition-root";
import { requirePlatformAdministrator } from "@/lib/server/admin-area";
import { getDurableWriteGuardResponse } from "@/lib/server/durable-write-guard";

/**
 * Takes a school's person away, or gives them back.
 *
 * Revocation reaches the boundary on the person's next request rather than
 * immediately: the session token carries its memberships and lives for a day,
 * which is exactly the gap phase 5 exists to close. Until it does, revoking
 * somebody who is signed in leaves them working until their token expires, and
 * an administrator who needs it to be immediate has to say so — nothing here
 * can make it so.
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

    const { auditLogRepo, managerRepo } = resolveCoreRepositories();
    const result = await ManagerAdministrationService.setMembershipStatus(
      managerRepo,
      organizationId,
      membershipId,
      status,
    );

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

    await ManagerAuditService.logEvent(
      auditLogRepo,
      { ...authorization.session, activeOrganizationId: organizationId },
      status === "active" ? "MEMBER_RESTORED" : "MEMBER_REVOKED",
      undefined,
      { managerId: result.value.managerId },
    );

    return NextResponse.json({ success: true, membership: result.value });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to change the membership.",
      },
      { status: 500 },
    );
  }
}
