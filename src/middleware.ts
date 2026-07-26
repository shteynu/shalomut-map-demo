import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  decideBasicAuth,
  isBasicAuthFallbackDisabled,
  isMachineAuthenticatedRoute,
  isRespondentRoute,
} from "@/lib/server/basic-auth";
import { createScopedManagerHeaders } from "@/lib/server/manager-scope";
import { resolveManagerSession } from "@/lib/server/session-auth";

/**
 * Manager surfaces require authentication (App-level session cookie or Basic Auth fallback).
 * Scoped manager organization context is injected via server headers.
 */
export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const method = request.method;

  const isPublicAuthRoute =
    pathname === "/login" || pathname.startsWith("/api/auth/");

  const bypassesManagerScope =
    isRespondentRoute(pathname) ||
    isMachineAuthenticatedRoute(pathname, method) ||
    isPublicAuthRoute;

  if (bypassesManagerScope) {
    const headers = createScopedManagerHeaders(request.headers, undefined);
    return NextResponse.next({ request: { headers } });
  }

  // 1. Primary Auth Gate: Application-level Manager Session (Cookie or Bearer Token)
  const managerSession = await resolveManagerSession(request);
  if (managerSession) {
    const headers = createScopedManagerHeaders(
      request.headers,
      managerSession.activeOrganizationId,
    );
    return NextResponse.next({ request: { headers } });
  }

  // 2. Sunset Option: Fully Disable Basic Auth Fallback if requested via env flag
  if (isBasicAuthFallbackDisabled()) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 },
      );
    }
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") {
      loginUrl.searchParams.set("next", pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  // 3. Fallback Gate: Shared Basic Auth Credential Boundary
  const decision = decideBasicAuth({
    pathname,
    method,
    authorization: request.headers.get("authorization"),
  });

  if (decision === "allow") {
    const headers = createScopedManagerHeaders(
      request.headers,
      process.env.MANAGER_ORGANIZATION_ID,
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


