import type { NextRequest, NextResponse } from "next/server";
import { JwtSessionProvider } from "@/lib/auth/jwt-session-provider";
import { SESSION_TTL_SECONDS } from "@/lib/auth/session-lifetime";
import type { ManagerSession } from "@/lib/auth/types";
import type { ISessionProvider } from "@/lib/auth/domain-contract";

export const SESSION_COOKIE_NAME = "shalomut_session";

/**
 * Whether this response's cookie may insist on HTTPS.
 *
 * `secure` on a cookie sent over plain HTTP is not a stricter cookie, it is no
 * cookie at all — which on a local `http://localhost` walk reads as a login
 * screen that will not stay signed in.
 */
function isSecureRequest(request: NextRequest): boolean {
  return (
    process.env.NODE_ENV === "production" ||
    request.nextUrl.protocol === "https:"
  );
}

/**
 * Hand the browser a session, on every path that mints one.
 *
 * One writer rather than three, because the lifetime here and the `exp` inside
 * the token are two statements of the same fact and drift silently when they
 * are written apart. They were `86400` in two route handlers and a provider
 * default until the session got short.
 */
export function setSessionCookie(
  response: NextResponse,
  token: string,
  request: NextRequest,
): NextResponse {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: isSecureRequest(request),
    maxAge: SESSION_TTL_SECONDS,
  });
  return response;
}

/**
 * Take the session away — on sign-out, and on a renewal that was refused.
 *
 * A refused renewal has to clear rather than merely answer, or the browser
 * keeps presenting a cookie the server has already decided against until it
 * expires on its own.
 */
export function clearSessionCookie(response: NextResponse): NextResponse {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });
  return response;
}

let cachedDefaultProvider: ISessionProvider | null | undefined;
let cachedDefaultProviderFailure: string | null = null;

function getDefaultProvider(): ISessionProvider | null {
  if (cachedDefaultProvider !== undefined) {
    return cachedDefaultProvider;
  }
  try {
    cachedDefaultProvider = new JwtSessionProvider();
    cachedDefaultProviderFailure = null;
  } catch (error) {
    cachedDefaultProvider = null;
    cachedDefaultProviderFailure =
      error instanceof Error ? error.message : String(error);
  }
  return cachedDefaultProvider;
}

/**
 * Why the default provider could not be built, or `null` when it could.
 *
 * An unconfigured runtime and a forged token are indistinguishable from the
 * outside: both end as a redirect to `/login`, which reads as "wrong password"
 * and sends the reader looking at the login screen. The deployed runtime has
 * already lost a day to exactly that — the middleware was failing on a missing
 * `SESSION_SECRET` and said nothing (`docs/manager-feedback-plan-2026-07-26.md`).
 * Reported here, never in a response, so the answer stays in the server's log
 * where it belongs.
 */
export function describeSessionProviderFailure(): string | null {
  getDefaultProvider();
  return cachedDefaultProviderFailure;
}

export function extractSessionToken(request: NextRequest): string | null {
  const cookieToken = request.cookies.get(SESSION_COOKIE_NAME)?.value?.trim();
  if (cookieToken) return cookieToken;

  const authHeader = request.headers.get("authorization");
  if (authHeader) {
    const spaceIndex = authHeader.indexOf(" ");
    if (spaceIndex > 0) {
      const scheme = authHeader.slice(0, spaceIndex).toLowerCase();
      if (scheme === "bearer") {
        return authHeader.slice(spaceIndex + 1).trim();
      }
    }
  }

  return null;
}

export async function resolveManagerSession(
  request: NextRequest,
  provider?: ISessionProvider,
): Promise<ManagerSession | null> {
  const token = extractSessionToken(request);
  if (!token) return null;

  const activeProvider = provider ?? getDefaultProvider();
  if (!activeProvider) return null;

  return activeProvider.verifyToken(token);
}

/**
 * The session behind a plain `Request`.
 *
 * `resolveManagerSession` above needs a `NextRequest` for its parsed cookie jar,
 * which the middleware has and a route handler does not. Route handlers were
 * each parsing the cookie header themselves; this is that parsing, once.
 */
export function extractSessionTokenFromHeaders(
  request: { headers: Pick<Headers, "get"> },
): string | null {
  const authorization = request.headers.get("authorization");
  if (authorization?.toLowerCase().startsWith("bearer ")) {
    return authorization.slice(7).trim() || null;
  }

  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;

  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === SESSION_COOKIE_NAME) {
      return rest.join("=").trim() || null;
    }
  }

  return null;
}

export async function resolveManagerSessionFromHeaders(
  request: { headers: Pick<Headers, "get"> },
  provider?: ISessionProvider,
): Promise<ManagerSession | null> {
  const token = extractSessionTokenFromHeaders(request);
  if (!token) return null;

  const activeProvider = provider ?? getDefaultProvider();
  if (!activeProvider) return null;

  try {
    return await activeProvider.verifyToken(token);
  } catch {
    // An invalid token is not a session. The caller decides whether that is a
    // refusal or merely an unidentified actor.
    return null;
  }
}
