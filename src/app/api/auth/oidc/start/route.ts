import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  createAuthorizationRequest,
  resolveIdentityProviderConfig,
} from "@/lib/auth/identity-provider";
import { LOGIN_NEXT_PARAM, resolveLoginRedirect, routes } from "@/lib/navigation";
import {
  OIDC_HANDSHAKE_COOKIE,
  OIDC_HANDSHAKE_PATH,
  OIDC_HANDSHAKE_TTL_SECONDS,
  serializeHandshake,
  type SignInErrorCode,
} from "@/lib/server/oidc-handshake";

function backToLogin(request: NextRequest, error: SignInErrorCode) {
  const url = new URL(routes.login, request.url);
  url.searchParams.set("error", error);
  return NextResponse.redirect(url);
}

/**
 * The first half of a sign-in: send the browser to the provider, and keep the
 * three values the second half will check the answer against.
 */
export async function GET(request: NextRequest) {
  const config = resolveIdentityProviderConfig();
  if (!config) return backToLogin(request, "provider_unconfigured");

  const next = resolveLoginRedirect(
    request.nextUrl.searchParams.get(LOGIN_NEXT_PARAM),
  );

  let authorization;
  try {
    authorization = await createAuthorizationRequest(config);
  } catch (error) {
    // The provider's discovery document is what this failed to read, which is a
    // fact about the provider or about this runtime's configuration and never
    // about the person at the screen.
    console.warn(
      `[auth] the identity provider could not be reached to start a sign-in: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return backToLogin(request, "provider_unconfigured");
  }

  const response = NextResponse.redirect(authorization.url);
  response.cookies.set({
    name: OIDC_HANDSHAKE_COOKIE,
    value: serializeHandshake({
      state: authorization.state,
      nonce: authorization.nonce,
      codeVerifier: authorization.codeVerifier,
      next,
    }),
    httpOnly: true,
    // `lax` rather than `strict`: the browser comes back from the provider as a
    // top-level navigation from another site, and `strict` would withhold the
    // cookie on exactly that request.
    sameSite: "lax",
    path: OIDC_HANDSHAKE_PATH,
    maxAge: OIDC_HANDSHAKE_TTL_SECONDS,
    secure:
      process.env.NODE_ENV === "production" ||
      request.nextUrl.protocol === "https:",
  });

  return response;
}
