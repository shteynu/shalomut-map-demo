import { NextResponse } from "next/server";
import type { ManagerSession } from "@/lib/auth/types";
import { resolveManagerSessionFromHeaders } from "@/lib/server/session-auth";

/**
 * The administrator area's own front door.
 *
 * The middleware already refuses `/admin` and `/api/admin` to anybody without
 * the flag, and this checks again. Not belt and braces for its own sake: the
 * middleware decides from a token it verified, and these routes need the same
 * session anyway to say who acted in the audit log — so re-deriving it here
 * costs one verification and removes "the matcher was edited" from the list of
 * ways the area could open.
 *
 * A refusal is `404`, matching the rest of the product: a route that answers
 * `403` has confirmed it exists.
 */
export async function requirePlatformAdministrator(
  request: { headers: Pick<Headers, "get"> },
): Promise<
  | { ok: true; session: ManagerSession }
  | { ok: false; response: NextResponse }
> {
  const session = await resolveManagerSessionFromHeaders(request);

  if (!session?.isPlatformAdministrator) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Not found." }, { status: 404 }),
    };
  }

  return { ok: true, session };
}
