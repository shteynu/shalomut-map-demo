import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { describeSessionSecretSource } from "@/lib/auth/jwt-session-provider";
import { NEW_SCHOOL_PARAM, SETUP_SCHOOL_PARAM } from "@/lib/navigation";
import {
  isMachineAuthenticatedRoute,
  isPublicOperationalRoute,
  isRespondentRoute,
} from "@/lib/server/basic-auth";
import {
  EVERY_SCHOOL,
  MANAGER_SCHOOL_COOKIE,
  createScopedManagerHeaders,
} from "@/lib/server/manager-scope";
import type { ManagerSession } from "@/lib/auth/types";
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
 * The schools this session may read, which is not the same as the schools that
 * exist.
 *
 * An invited membership has not been accepted and a suspended one has been taken
 * away; only an active one is a school. Today every session carries exactly one
 * active membership, built from `MANAGER_ORGANIZATION_ID`, so this list has one
 * entry and nothing below it can behave differently than it did — which is why
 * the rule is worth putting in place now rather than on the day a second
 * membership exists.
 */
function memberSchools(session: ManagerSession): string[] {
  return session.memberships
    .filter((membership) => membership.status === "active")
    .map((membership) => membership.organizationId);
}

/**
 * The administrator area: the schools, the people, and who may reach what.
 *
 * Named here rather than derived from a route table because the middleware is
 * where it has to be true — a page and an API route under the same prefix are
 * the same area, and both are refused by the same expression.
 */
function isAdminArea(pathname: string): boolean {
  return (
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/api/admin" ||
    pathname.startsWith("/api/admin/")
  );
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
    isPublicOperationalRoute(pathname, method) ||
    isPublicAuthRoute;

  if (bypassesManagerScope) {
    const headers = createScopedManagerHeaders(request.headers, undefined);
    return NextResponse.next({ request: { headers } });
  }

  // 1. Primary Auth Gate: Application-level Manager Session (Cookie or Bearer Token)
  const managerSession = await resolveManagerSession(request);
  if (managerSession) {
    // The session names the school a manager lands on; the chosen school, when
    // there is one and the session is a member of it, is what they are reading
    // now. The session value stays the default rather than the pin, which is
    // what makes a second school reachable at all without touching
    // authentication — and the membership is what keeps "reachable" from
    // meaning "anyone's".
    //
    // This is the whole tenant boundary. Every manager route and every manager
    // screen reads the header set here, and nothing below re-derives which
    // school was asked for, so a school refused here is refused everywhere.
    // The second branch, and the reason the check went here rather than into
    // the scope service: a platform administrator may open any school that
    // exists, and that is one condition in the same expression instead of an
    // exception threaded through everything below.
    const isAdministrator = managerSession.isPlatformAdministrator;

    // The administrator area, refused to everybody else before any handler
    // runs. It is the one part of the product that is not about one school, so
    // it sits outside the scope logic below rather than inside it. The routes
    // check the flag again — see `requirePlatformAdministrator` — because this
    // check depends on a matcher that can be edited.
    if (isAdminArea(pathname) && !isAdministrator) {
      return pathname.startsWith("/api/")
        ? NextResponse.json({ error: "Not found." }, { status: 404 })
        : NextResponse.redirect(new URL("/", request.url));
    }

    const schools = memberSchools(managerSession);
    const mayOpen = (school: string) =>
      isAdministrator || schools.includes(school);

    const chosenSchool = readChosenSchool(request);
    const honouredSchool =
      chosenSchool && mayOpen(chosenSchool.id) ? chosenSchool : null;

    // An administrator's session names no school until they choose one, and
    // then the choice is the whole scope. `resolveOrganizationId` still proves
    // the school exists, so "any school" never becomes "any string".
    const sessionSchool = managerSession.activeOrganizationId;
    const defaultSchool =
      sessionSchool && mayOpen(sessionSchool) ? sessionSchool : schools[0];

    const headers = createScopedManagerHeaders(
      request.headers,
      honouredSchool?.id ?? defaultSchool,
      isAdministrator ? EVERY_SCHOOL : schools,
    );
    const response = NextResponse.next({ request: { headers } });

    if (honouredSchool?.isNewChoice) {
      response.cookies.set(MANAGER_SCHOOL_COOKIE, honouredSchool.id, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      });
    }

    // A remembered school the session is no longer a member of is a preference
    // that can never be honoured again. Forgetting it is what keeps the refusal
    // from being repeated on every navigation for the rest of the session, and
    // it is a preference being dropped rather than access being revoked — the
    // revocation already happened to the membership.
    if (chosenSchool && !honouredSchool && !chosenSchool.isNewChoice) {
      response.cookies.delete(MANAGER_SCHOOL_COOKIE);
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


