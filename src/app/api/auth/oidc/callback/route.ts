import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { resolveCoreRepositories } from "@/lib/composition-root";
import {
  IdentityProviderError,
  exchangeCodeForIdentity,
  resolveIdentityProviderConfig,
} from "@/lib/auth/identity-provider";
import { JwtSessionProvider } from "@/lib/auth/jwt-session-provider";
import { ManagerDirectoryService } from "@/lib/auth/manager-directory-service";
import { routes } from "@/lib/navigation";
import { getRateLimitResponse, RATE_LIMITS } from "@/lib/server/rate-limit";
import { setSessionCookie } from "@/lib/server/session-auth";
import {
  OIDC_HANDSHAKE_COOKIE,
  OIDC_HANDSHAKE_PATH,
  parseHandshake,
  type SignInErrorCode,
} from "@/lib/server/oidc-handshake";

/**
 * Every exit from this route clears the handshake cookie. A half-finished
 * sign-in that stays in the browser is a value the next attempt would compare
 * against and fail on, which reads as "the provider is broken".
 */
function endHandshake(response: NextResponse) {
  response.cookies.set({
    name: OIDC_HANDSHAKE_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    path: OIDC_HANDSHAKE_PATH,
    maxAge: 0,
    expires: new Date(0),
  });
  return response;
}

function backToLogin(request: NextRequest, error: SignInErrorCode) {
  const url = new URL(routes.login, request.url);
  url.searchParams.set("error", error);
  return endHandshake(NextResponse.redirect(url));
}

/**
 * The second half of a sign-in: the provider says which address this is, and
 * the manager rows say whether that address is anybody here.
 */
export async function GET(request: NextRequest) {
  // The limit outlived the password it used to guard. What it guards now is the
  // code exchange — an endpoint that reaches the provider and the database once
  // per call, and that anyone can call.
  const limited = await getRateLimitResponse(
    request.headers,
    RATE_LIMITS.managerLogin,
  );
  if (limited) return backToLogin(request, "rate_limited");

  const config = resolveIdentityProviderConfig();
  if (!config) return backToLogin(request, "provider_unconfigured");

  const handshake = parseHandshake(
    request.cookies.get(OIDC_HANDSHAKE_COOKIE)?.value,
  );
  if (!handshake) return backToLogin(request, "handshake_missing");

  const parameters = request.nextUrl.searchParams;
  if (parameters.get("error")) {
    // The provider's own refusal — a cancelled consent screen, most often.
    return backToLogin(request, "provider_refused");
  }

  // Constant-time comparison would be theatre here: both values are in this
  // request, and the attacker who can read one can read the other.
  if (!parameters.get("state") || parameters.get("state") !== handshake.state) {
    return backToLogin(request, "state_mismatch");
  }

  const code = parameters.get("code");
  if (!code) return backToLogin(request, "provider_refused");

  let identity;
  try {
    identity = await exchangeCodeForIdentity(config, {
      code,
      codeVerifier: handshake.codeVerifier,
      nonce: handshake.nonce,
    });
  } catch (error) {
    console.warn(
      `[auth] a sign-in could not be completed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return backToLogin(
      request,
      error instanceof IdentityProviderError ? error.code : "exchange_failed",
    );
  }

  const { managerRepo } = resolveCoreRepositories();
  const resolved = await ManagerDirectoryService.resolveSignIn(
    managerRepo,
    identity.email,
  );

  if (!resolved.ok) {
    // Authenticating is not being invited, and the screen says so without
    // saying which of the two failed for this particular address.
    return backToLogin(
      request,
      resolved.reason === "USER_NOT_FOUND"
        ? "not_invited"
        : "no_active_membership",
    );
  }

  let sessionProvider: JwtSessionProvider;
  try {
    sessionProvider = new JwtSessionProvider();
  } catch (error) {
    console.warn(
      `[auth] a verified sign-in could not be turned into a session: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return backToLogin(request, "provider_unconfigured");
  }

  const { token } = await sessionProvider.createSession(
    resolved.manager,
    resolved.activeOrganizationId,
    resolved.memberships,
  );

  const response = endHandshake(
    NextResponse.redirect(new URL(handshake.next, request.url)),
  );

  return setSessionCookie(response, token, request);
}
