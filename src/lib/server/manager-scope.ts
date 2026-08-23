import { NextResponse } from "next/server";
import type { IAuditLogRepository } from "@/lib/auth/domain-contract";
import type {
  IOrganizationRepository,
  IRoundRepository,
} from "@/lib/repositories";
import {
  UNRECORDABLE_VISIT_MESSAGE,
  recordAdministratorSchoolVisit,
} from "@/lib/server/manager-audit";
import type { ManagerAction } from "@/lib/auth/roles-and-permissions";
import type { ManagerRole } from "@/lib/auth/types";
import { requireManagerPermission } from "@/lib/server/manager-permission";
import type { ManagerContext } from "@/lib/services/manager-context.service";
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
 * What the header says for a platform administrator: every school, rather than
 * a list of them.
 *
 * An administrator is outside the membership system, so enumerating the schools
 * into their token would make the number of schools change what a session
 * carries — the one thing the model was chosen to avoid. Downstream this reads
 * as "no restriction", which is what the scope service did before memberships
 * were consulted at all.
 */
export const EVERY_SCHOOL = "*";

/**
 * What the session may do in the school this request is read inside.
 *
 * A third server-owned header for the same reason as the second: the middleware
 * is the only place holding the session, and the role that matters is the one
 * on the membership for the school actually being read — not the one the token
 * happens to name for the school the session last landed on. Those differ the
 * moment somebody is an administrator of one school and a user of another.
 *
 * Deleted from the incoming request before it is set, like the other two, so a
 * caller cannot send its own.
 */
export const MANAGER_ROLE_HEADER = "x-shalomut-manager-role";

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
 * The session's schools, or `undefined` when nothing restricts this request to
 * particular ones — an administrator's request, or one the middleware never
 * scoped because it carries no session.
 *
 * The empty array is a third answer and not the same as `undefined`: it is a
 * session entitled to nothing, which reads nothing.
 */
export function getManagerMemberSchools(
  request: { headers: Pick<Headers, "get"> },
): readonly string[] | undefined {
  const raw = request.headers.get(MANAGER_MEMBER_SCHOOLS_HEADER);
  if (raw === null || raw.trim() === EVERY_SCHOOL) return undefined;

  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

/**
 * What this request may do, as the middleware decided it.
 *
 * Absent means the middleware never ran. Over HTTP that cannot happen on a
 * manager route — the middleware answers `401` before any handler does — so an
 * absent header is a handler called directly: a test, or a script holding the
 * repositories already. Both are trusted by construction, and reading absence
 * as `admin` is what keeps this from becoming a second authentication gate
 * that disagrees with the first.
 *
 * A present value that is not `manager` is `admin` for the same reason the
 * session builder defaults that way: the middleware writes one of two words,
 * and anything else is not a third role.
 */
export function getManagerRole(request: {
  headers: Pick<Headers, "get">;
}): ManagerRole {
  return request.headers.get(MANAGER_ROLE_HEADER)?.trim() === "manager"
    ? "manager"
    : "admin";
}

export function createScopedManagerHeaders(
  requestHeaders: Headers,
  organizationId?: string,
  memberOrganizationIds?: readonly string[] | typeof EVERY_SCHOOL,
  role?: ManagerRole,
) {
  const headers = new Headers(requestHeaders);
  headers.delete(MANAGER_ORGANIZATION_HEADER);
  headers.delete(MANAGER_MEMBER_SCHOOLS_HEADER);
  headers.delete(MANAGER_ROLE_HEADER);

  if (role) headers.set(MANAGER_ROLE_HEADER, role);

  const scopedOrganizationId = organizationId?.trim();
  if (scopedOrganizationId) {
    headers.set(MANAGER_ORGANIZATION_HEADER, scopedOrganizationId);
  }

  if (memberOrganizationIds) {
    headers.set(
      MANAGER_MEMBER_SCHOOLS_HEADER,
      typeof memberOrganizationIds === "string"
        ? memberOrganizationIds
        : memberOrganizationIds.join(","),
    );
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

/**
 * The round this request is allowed to be about, and the record that an
 * administrator was here.
 *
 * Both in one function on purpose: this is the chokepoint every round route
 * passes through, so a route cannot reach a round without the visit being
 * recorded, and a new route cannot forget to. The record is taken after the
 * round resolves — a request that names a round in a school it may not read
 * gets a 404 and is not a visit.
 */
export async function authorizeManagerRound(
  request: Pick<Request, "headers">,
  roundId: string,
  orgRepo: IOrganizationRepository,
  roundRepo: IRoundRepository,
  auditRepo: IAuditLogRepository,
  action: ManagerAction,
) {
  try {
    const round = await ManagerScopeService.findRound(
      roundId,
      orgRepo,
      roundRepo,
      getManagerOrganizationId(request),
      getManagerMemberSchools(request),
    );

    if (round) {
      /*
       * After the round resolves and before anything else, because the two
       * refusals answer different questions and their order is what keeps each
       * one truthful. A round in a school this session cannot open is a `404`
       * — the asker has no business knowing it exists. A round on the asker's
       * own screen that they may not change is a `403`; hiding it would tell
       * them their own round had vanished.
       *
       * The action is a parameter and not a lookup, so a new round route names
       * what it does or does not compile. That is the same argument this
       * function already makes about the visit record below.
       */
      const permission = requireManagerPermission(request, action);
      if (!permission.ok) return { ok: false as const, response: permission.response };

      const recorded = await recordAdministratorSchoolVisit(
        auditRepo,
        request,
        round.organizationId,
        round.id,
      );
      if (!recorded) {
        return {
          ok: false as const,
          response: NextResponse.json(
            { error: UNRECORDABLE_VISIT_MESSAGE },
            { status: 503 },
          ),
        };
      }
    }

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
/**
 * The record that an administrator read a manager screen, taken from the school
 * the screen was actually read inside.
 *
 * The screens' half of the chokepoint `authorizeManagerRound` is for the round
 * routes, and it takes the school from the loaded context for the same reason
 * that one takes it from the resolved round: what a request asked for and what
 * it was answered with are not the same thing.
 *
 * Which matters most where a request asks for nothing. A manager chooses a
 * school once and the other screens carry a round in their URLs, so most
 * requests arrive with no school on them at all, and `resolveOrganizationId`
 * then hands back the only school there is without anyone having named it. That
 * is the reading this used to miss — and on a deployment with one school it is
 * every reading there is.
 *
 * `null` in the context is a request that reached no school: nothing was read,
 * so there is nothing to record.
 */
export async function recordManagerScreenVisit(
  auditRepo: IAuditLogRepository,
  request: Pick<Request, "headers">,
  context: Pick<ManagerContext, "organization">,
): Promise<boolean> {
  const organizationId = context.organization?.id;
  if (!organizationId) return true;

  return recordAdministratorSchoolVisit(auditRepo, request, organizationId);
}
