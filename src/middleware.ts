import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { describeSessionSecretSource } from "@/lib/auth/jwt-session-provider";
import { NEW_SCHOOL_PARAM, SETUP_SCHOOL_PARAM } from "@/lib/navigation";
import {
  isMachineAuthenticatedRoute,
  isRespondentRoute,
} from "@/lib/server/basic-auth";
import {
  MANAGER_SCHOOL_COOKIE,
  createScopedManagerHeaders,
} from "@/lib/server/manager-scope";
import {
  SESSION_COOKIE_NAME,
  describeSessionProviderFailure,
  resolveManagerSession,
} from "@/lib/server/session-auth";

/**
 * The school this request is about: the one just chosen, else the one chosen
 * before, else none — and then the caller falls back to the session's school.
 *
 * `?school=new` is a request for a school that does not exist yet, so it is not
 * a scope. The screen keeps reading the current school while the manager fills
 * in the new one.
 */
function readChosenSchool(request: NextRequest) {
  const requested = request.nextUrl.searchParams
    .get(SETUP_SCHOOL_PARAM)
    ?.trim();

  if (requested && requested !== NEW_SCHOOL_PARAM) {
    return { id: requested, isNewChoice: true };
  }

  const remembered = request.cookies.get(MANAGER_SCHOOL_COOKIE)?.value?.trim();
  return remembered ? { id: remembered, isNewChoice: false } : null;
}

/**
 * One line per distinct reason, not one per request: a browser holding a
 * rejected cookie retries on every navigation, and a log that repeats itself
 * is a log nobody reads.
 */
let lastReportedRejection: string | undefined;

function reportRejectedSession() {
  const failure = describeSessionProviderFailure();
  const reason = failure
    ? `session verification is unavailable in this runtime: ${failure}`
    : "the token did not verify: it is expired, forged, or was signed with a " +
      "different SESSION_SECRET than this runtime holds. This runtime is " +
      `verifying with the ${describeSessionSecretSource()} secret`;

  if (reason === lastReportedRejection) return;
  lastReportedRejection = reason;
  console.warn(`[auth] a manager session cookie was rejected — ${reason}`);
}

/**
 * Manager surfaces require authentication (App-level session cookie or Basic Auth fallback).
 * Scoped manager organization context is injected via server headers.
 */
export async function middleware(request: NextRequest) {
  const rawPathname = request.nextUrl.pathname;
  const pathname =
    rawPathname.length > 1 && rawPathname.endsWith("/")
      ? rawPathname.slice(0, -1)
      : rawPathname;
  const method = request.method;

  const isPublicAuthRoute =
    pathname === "/login" || pathname.startsWith("/api/auth");

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
    // The session names the school a manager lands on; the chosen school, when
    // there is one, is what they are reading now. The session value stays the
    // default rather than the pin, which is what makes a second school
    // reachable at all without touching authentication.
    const chosenSchool = readChosenSchool(request);
    const headers = createScopedManagerHeaders(
      request.headers,
      chosenSchool?.id ?? managerSession.activeOrganizationId,
    );
    const response = NextResponse.next({ request: { headers } });

    if (chosenSchool?.isNewChoice) {
      response.cookies.set(MANAGER_SCHOOL_COOKIE, chosenSchool.id, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      });
    }

    return response;
  }

  // A cookie that was presented and did not survive verification is worth one
  // line in the log: the browser is holding a session the server will not
  // accept, and the redirect that follows looks identical to never having
  // signed in. The reason names the runtime's own configuration when that is
  // what failed, and nothing about the token itself.
  if (request.cookies.get(SESSION_COOKIE_NAME)) {
    reportRejectedSession();
  }

  // 2. Unauthenticated Manager Surfaces:
  // Redirect UI page requests to /login and return 401 JSON for API requests.
  // No Basic Auth popup challenge (WWW-Authenticate) is ever issued.
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

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};


