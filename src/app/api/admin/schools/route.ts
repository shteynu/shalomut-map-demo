import { NextResponse } from "next/server";
import { ManagerAuditService } from "@/lib/auth/manager-audit-service";
import { resolveCoreRepositories } from "@/lib/composition-root";
import { requirePlatformAdministrator } from "@/lib/server/admin-area";
import { getDurableWriteGuardResponse } from "@/lib/server/durable-write-guard";
import type { Organization } from "@/lib/types/backend";

interface CreateSchoolBody {
  name?: unknown;
  city?: unknown;
  schoolType?: unknown;
  totalStaffCount?: unknown;
}

function parse(body: CreateSchoolBody): Omit<Organization, "id" | "createdAt"> | null {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const city = typeof body.city === "string" ? body.city.trim() : "";
  const schoolType =
    typeof body.schoolType === "string" ? body.schoolType.trim() : "";
  const totalStaffCount = Number(body.totalStaffCount);

  if (!name || !city || !schoolType) return null;
  if (!Number.isInteger(totalStaffCount) || totalStaffCount <= 0) return null;

  return { name, city, schoolType, totalStaffCount };
}

/**
 * Opens a school, with nobody in it.
 *
 * The order is the owner's: the administrator creates the school, then invites
 * its person. The school exists in the list before anyone has accepted, and the
 * staff count — which sets the floor under every privacy threshold the school
 * can choose — is set here rather than by the school describing itself.
 *
 * No round is created with it. A school with no rounds already has a screen,
 * and the first round is its own user's first act rather than an administrator
 * guessing at a quarter.
 */
export async function POST(request: Request) {
  try {
    const unavailable = getDurableWriteGuardResponse();
    if (unavailable) return unavailable;

    const authorization = await requirePlatformAdministrator(request);
    if (!authorization.ok) return authorization.response;

    const input = parse((await request.json()) as CreateSchoolBody);
    if (!input) {
      return NextResponse.json(
        { error: "A school needs a name, a city, a type and a staff count." },
        { status: 400 },
      );
    }

    const { auditLogRepo, orgRepo } = resolveCoreRepositories();
    const organization = await orgRepo.create({
      id: crypto.randomUUID(),
      ...input,
      createdAt: new Date(),
    });

    await ManagerAuditService.logEvent(
      auditLogRepo,
      { ...authorization.session, activeOrganizationId: organization.id },
      "SCHOOL_CREATED",
      undefined,
      { name: organization.name, city: organization.city },
    );

    return NextResponse.json({ success: true, organization }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to create a school.",
      },
      { status: 500 },
    );
  }
}
