import { NextResponse } from "next/server";
import type {
  IOrganizationRepository,
  IRoundRepository,
} from "@/lib/repositories";
import {
  ManagerScopeRequiredError,
  ManagerScopeService,
} from "@/lib/services/manager-scope.service";

export const MANAGER_ORGANIZATION_HEADER =
  "x-shalomut-manager-organization-id";

/**
 * The schools the session is an active member of.
 *
 * The scope header above says which school this request is read inside; this one
 * says which schools the session could have asked for. Both are decided in the
 * middleware, which is the only place holding the session, and both are deleted
 * from the incoming request before either is set — a caller cannot send its own.
 *
 * Present and empty is a session with no active membership, which is a session
 * that reads nothing. Absent is a request with no manager session at all.
 */
export const MANAGER_MEMBER_SCHOOLS_HEADER =
  "x-shalomut-manager-member-organization-ids";

/**
 * The school the manager last chose.
 *
 * The choice is made on one screen and has to hold on every other one, and the
 * other screens carry no school in their URLs — a map link, a goal link and a
 * builder link are all about a round. A cookie is what survives those hops. It
 * is a preference and not a permission, and it is the middleware that makes the
 * difference: the value is honoured only when the session holds an active
 * membership for it, so a wrong value is a wrong screen and never someone
 * else's data.
 */
export const MANAGER_SCHOOL_COOKIE = "shalomut_school";

export function getManagerOrganizationId(request: Pick<Request, "headers">) {
  return (
    request.headers.get(MANAGER_ORGANIZATION_HEADER)?.trim() || undefined
  );
}

/**
 * The session's schools, or `undefined` when the request carries no session.
 *
 * The empty array and `undefined` are different answers and callers treat them
 * differently: the first is a session entitled to nothing, the second is a
 * request the middleware never scoped.
 */
export function getManagerMemberSchools(
  request: { headers: Pick<Headers, "get"> },
): readonly string[] | undefined {
  const raw = request.headers.get(MANAGER_MEMBER_SCHOOLS_HEADER);
  if (raw === null) return undefined;

  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function createScopedManagerHeaders(
  requestHeaders: Headers,
  organizationId?: string,
  memberOrganizationIds?: readonly string[],
) {
  const headers = new Headers(requestHeaders);
  headers.delete(MANAGER_ORGANIZATION_HEADER);
  headers.delete(MANAGER_MEMBER_SCHOOLS_HEADER);

  const scopedOrganizationId = organizationId?.trim();
  if (scopedOrganizationId) {
    headers.set(MANAGER_ORGANIZATION_HEADER, scopedOrganizationId);
  }

  if (memberOrganizationIds) {
    headers.set(MANAGER_MEMBER_SCHOOLS_HEADER, memberOrganizationIds.join(","));
  }

  return headers;
}

export function getManagerScopeErrorResponse(error: unknown) {
  return error instanceof ManagerScopeRequiredError
    ? NextResponse.json(
        { error: "Manager organization scope is required." },
        { status: 403 },
      )
    : null;
}

export async function authorizeManagerRound(
  request: Pick<Request, "headers">,
  roundId: string,
  orgRepo: IOrganizationRepository,
  roundRepo: IRoundRepository,
) {
  try {
    const round = await ManagerScopeService.findRound(
      roundId,
      orgRepo,
      roundRepo,
      getManagerOrganizationId(request),
      getManagerMemberSchools(request),
    );

    return round
      ? { ok: true as const, round }
      : {
          ok: false as const,
          response: NextResponse.json(
            { error: "Survey round not found." },
            { status: 404 },
          ),
        };
  } catch (error) {
    const response = getManagerScopeErrorResponse(error);
    if (response) return { ok: false as const, response };
    throw error;
  }
}
