import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  decideBasicAuth,
  isMachineAuthenticatedRoute,
  isRespondentRoute,
} from "@/lib/server/basic-auth";
import { createScopedManagerHeaders } from "@/lib/server/manager-scope";

/**
 * The shared manager credential is bound to exactly one configured
 * organization. The internal scope header is always replaced here so clients
 * cannot select a different school.
 */
export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const method = request.method;
  const decision = decideBasicAuth({
    pathname,
    method,
    authorization: request.headers.get("authorization"),
  });

  if (decision === "allow") {
    const bypassesManagerScope =
      isRespondentRoute(pathname) ||
      isMachineAuthenticatedRoute(pathname, method);
    const headers = createScopedManagerHeaders(
      request.headers,
      bypassesManagerScope
        ? undefined
        : process.env.MANAGER_ORGANIZATION_ID,
    );

    return NextResponse.next({ request: { headers } });
  }

  if (decision === "unconfigured") {
    return new NextResponse(
      "Manager access is not configured for this deployment.",
      {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      },
    );
  }

  return new NextResponse("Authentication required.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Shalomut Map", charset="UTF-8"',
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
