import { NextResponse } from "next/server";
import {
  RolePermissionService,
  type ManagerAction,
} from "@/lib/auth/roles-and-permissions";
import { getManagerRole } from "@/lib/server/manager-scope";

/**
 * Whether this request may do the thing it came to do.
 *
 * Authorization, not authentication. The middleware already decided that there
 * is a session and which school it is reading; this decides what that session
 * may do there, from the role the middleware wrote into a server-owned header.
 *
 * `403` and not `404`, which is a deliberate break from how a foreign resource
 * is hidden elsewhere in this product. A `404` there answers "does this exist"
 * with silence, because the asker has no business knowing. Here the asker is
 * looking at the round on their own screen — hiding it would tell them their
 * own school's round had vanished, and the true answer is shorter and kinder:
 * this is not yours to change.
 *
 * The `reason` names the role and the action and never the person. It is
 * written for a developer reading a log, and it is safe to show a manager
 * because it discloses nothing they cannot already see.
 */
export function requireManagerPermission(
  request: { headers: Pick<Headers, "get"> },
  action: ManagerAction,
): { ok: true } | { ok: false; response: NextResponse } {
  const role = getManagerRole(request);
  const permission = RolePermissionService.enforcePermission(role, action);

  if (permission.allowed) return { ok: true };

  return {
    ok: false,
    response: NextResponse.json(
      {
        error:
          "Only a school administrator can do this. You can read this round's results.",
        code: "FORBIDDEN_FOR_ROLE",
        action,
      },
      { status: 403 },
    ),
  };
}
