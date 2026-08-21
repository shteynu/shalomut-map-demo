import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { JwtSessionProvider } from "@/lib/auth/jwt-session-provider";
import { SESSION_RENEWAL_INTERVAL_SECONDS } from "@/lib/auth/session-lifetime";
import { SessionRenewalService } from "@/lib/auth/session-renewal-service";
import { resolveCoreRepositories } from "@/lib/composition-root";
import {
  clearSessionCookie,
  resolveManagerSession,
  setSessionCookie,
} from "@/lib/server/session-auth";

/**
 * Keeps a working manager signed in, and stops keeping a revoked one.
 *
 * A route handler rather than the middleware, which is where it belongs by
 * every other measure — the middleware sees every navigation and is the one
 * place able to set a cookie on one. It is ruled out by this repository's own
 * composition rule: `resolveCoreRepositories()` is called from a route handler,
 * a server-component context loader, a script or a test, and nothing else
 * (`npm run lint:composition`). A server component cannot set a cookie in Next
 * 16 either. So the database re-read lives here and the client asks for it.
 *
 * Public in the middleware's eyes, like every `/api/auth` route, and guarded by
 * the cookie it is handed: with no valid session there is nothing to renew.
 */
export async function POST(request: NextRequest) {
  const session = await resolveManagerSession(request);

  if (!session) {
    // Not a refusal of this person, just an absence of one. The cookie is
    // cleared anyway: a browser holding a token this runtime will not verify
    // would otherwise present it on every navigation until it expired.
    return clearSessionCookie(
      NextResponse.json(
        { ok: false, reason: "NO_SESSION" },
        { status: 401 },
      ),
    );
  }

  let sessionProvider: JwtSessionProvider;
  try {
    sessionProvider = new JwtSessionProvider();
  } catch {
    // The runtime cannot mint, which is a fact about its configuration and not
    // about this session. Leaving the cookie alone keeps the manager working
    // until it expires on its own rather than signing them out over a
    // misconfiguration they cannot see.
    return NextResponse.json(
      { ok: false, reason: "UNCONFIGURED" },
      { status: 503 },
    );
  }

  const { managerRepo } = resolveCoreRepositories();
  const result = await SessionRenewalService.renew(
    managerRepo,
    sessionProvider,
    session,
  );

  if (!result.ok) {
    console.warn(
      `[auth] a session was not renewed for manager ${session.managerId}: ${result.reason}`,
    );
    return clearSessionCookie(
      NextResponse.json(
        { ok: false, reason: result.reason },
        { status: 401 },
      ),
    );
  }

  const response = NextResponse.json({
    ok: true,
    renewAfterSeconds: SESSION_RENEWAL_INTERVAL_SECONDS,
    session: {
      managerId: result.session.managerId,
      email: result.session.email,
      role: result.session.role,
      isPlatformAdministrator: result.session.isPlatformAdministrator,
      activeOrganizationId: result.session.activeOrganizationId,
      memberships: result.session.memberships,
      expiresAt: result.session.expiresAt,
      absoluteExpiresAt: result.session.absoluteExpiresAt,
    },
  });

  return setSessionCookie(response, result.token, request);
}
