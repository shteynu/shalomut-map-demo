import { NextResponse } from "next/server";
import { describeStaffFloorRefusal } from "@/lib/rounds/staff-floor";
import { resolveCoreRepositories } from "@/lib/composition-root";
import {
  ManagerScopeService,
  ManagerSetupService,
  type ManagerSetupInput,
} from "@/lib/services";
import { getDurableWriteGuardResponse } from "@/lib/server/durable-write-guard";
import { MINIMUM_PRIVACY_THRESHOLD } from "@/lib/survey-definition";
import {
  authorizeManagerRound,
  getManagerOrganizationId,
  getManagerScopeErrorResponse,
} from "@/lib/server/manager-scope";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function requiredString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function optionalId(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function nonNegativeInteger(value: unknown) {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0
    ? value
    : null;
}

function parseDate(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Whether the request is opening a school rather than saving the one it is in.
 *
 * An absent organization id cannot carry this on its own: the handler scopes an
 * unnamed organization to the school the request is already in, which is what
 * makes an ordinary edit work. Adding a school therefore says so explicitly,
 * and a request that does not say it can never create one by omission.
 */
function createsOrganization(value: unknown): boolean {
  return isRecord(value) && value.createOrganization === true;
}

function parsePayload(value: unknown): ManagerSetupInput | null {
  if (
    !isRecord(value) ||
    !isRecord(value.organization) ||
    !isRecord(value.round)
  ) {
    return null;
  }

  const organizationName = requiredString(value.organization.name);
  const city = requiredString(value.organization.city);
  const schoolType = requiredString(value.organization.schoolType);
  const totalStaffCount = nonNegativeInteger(
    value.organization.totalStaffCount,
  );
  const title = requiredString(value.round.title);
  const privacyThreshold = nonNegativeInteger(value.round.privacyThreshold);
  const startDate = parseDate(value.round.startDate);
  const endDate = value.round.endDate
    ? parseDate(value.round.endDate)
    : undefined;
  const background = value.round.backgroundContext;

  if (
    !organizationName ||
    !city ||
    !schoolType ||
    !totalStaffCount ||
    !title ||
    privacyThreshold === null ||
    privacyThreshold < MINIMUM_PRIVACY_THRESHOLD ||
    !startDate ||
    (value.round.endDate && !endDate) ||
    !isRecord(background) ||
    !isRecord(background.classesPerGrade)
  ) {
    return null;
  }

  const classesPerGrade: Record<string, number> = {};
  for (const [grade, count] of Object.entries(background.classesPerGrade)) {
    const parsedCount = nonNegativeInteger(count);
    if (parsedCount === null) return null;
    classesPerGrade[grade] = parsedCount;
  }

  const sicknessDaysThisQuarter = nonNegativeInteger(
    background.sicknessDaysThisQuarter,
  );
  const newStaffMembers = nonNegativeInteger(background.newStaffMembers);
  const studentCount = nonNegativeInteger(background.studentCount);
  const socioEconomicIndex = nonNegativeInteger(
    background.socioEconomicIndex,
  );
  const audience = requiredString(background.audience);

  if (
    sicknessDaysThisQuarter === null ||
    newStaffMembers === null ||
    studentCount === null ||
    socioEconomicIndex === null ||
    socioEconomicIndex < 1 ||
    socioEconomicIndex > 10 ||
    !audience
  ) {
    return null;
  }

  return {
    organization: {
      id: optionalId(value.organization.id),
      name: organizationName,
      city,
      schoolType,
      totalStaffCount,
    },
    round: {
      id: optionalId(value.round.id),
      title,
      privacyThreshold,
      startDate,
      endDate: endDate ?? undefined,
      backgroundContext: {
        notes:
          typeof background.notes === "string" ? background.notes.trim() : "",
        audience,
        sicknessDaysThisQuarter,
        newStaffMembers,
        studentCount,
        socioEconomicIndex,
        classesPerGrade,
      },
    },
  };
}

export async function PUT(request: Request) {
  try {
    const unavailable = getDurableWriteGuardResponse();
    if (unavailable) return unavailable;

    const body = await request.json();
    const input = parsePayload(body);
    if (!input) {
      return NextResponse.json(
        { error: "Invalid manager setup payload." },
        { status: 400 },
      );
    }

    /*
     * The one round the product refuses to run. See `staff-floor.ts`: a staff
     * smaller than its own privacy threshold produces a measurement that can
     * never be shown, and every teacher who answered it gave something away for
     * nothing. Checked here rather than only in the parser because the manager
     * has to be told which two numbers disagree.
     */
    const refusal = describeStaffFloorRefusal(
      input.organization.totalStaffCount,
      input.round.privacyThreshold,
    );
    if (refusal) {
      return NextResponse.json({ error: refusal.message }, { status: 422 });
    }

    const { orgRepo, roundRepo } = resolveCoreRepositories();

    if (createsOrganization(body)) {
      // A school being opened is outside every existing school, so there is no
      // scope to resolve and none to check against: ids arriving with it would
      // only name records belonging to somebody else's school, and are dropped
      // rather than trusted. The round is the new school's first one.
      const created = await ManagerSetupService.save(
        {
          organization: { ...input.organization, id: undefined },
          round: { ...input.round, id: undefined },
        },
        orgRepo,
        roundRepo,
      );

      return NextResponse.json({
        success: true,
        savedAt: created.round.updatedAt?.toISOString(),
        ...created,
      });
    }

    const organizationId = await ManagerScopeService.resolveOrganizationId(
      orgRepo,
      getManagerOrganizationId(request),
    );
    if (
      organizationId &&
      input.organization.id &&
      input.organization.id !== organizationId
    ) {
      return NextResponse.json(
        { error: "Organization not found." },
        { status: 404 },
      );
    }

    if (input.round.id) {
      const authorization = await authorizeManagerRound(
        request,
        input.round.id,
        orgRepo,
        roundRepo,
      );
      if (!authorization.ok) return authorization.response;
    }

    const result = await ManagerSetupService.save(
      {
        ...input,
        organization: {
          ...input.organization,
          id: organizationId ?? input.organization.id,
        },
      },
      orgRepo,
      roundRepo,
    );

    // The screen shows when the work reached the database, so the time is the
    // round's own `updatedAt` — the value the write stored — rather than the
    // browser clock or a reading this handler takes afterwards. That is also
    // what lets the time survive a reload: the next page load reads the same
    // column.
    return NextResponse.json({
      success: true,
      savedAt: result.round.updatedAt?.toISOString(),
      ...result,
    });
  } catch (error) {
    const scopeResponse = getManagerScopeErrorResponse(error);
    if (scopeResponse) return scopeResponse;

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to save manager setup.",
      },
      { status: 500 },
    );
  }
}
