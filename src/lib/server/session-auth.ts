import type { NextRequest } from "next/server";
import { JwtSessionProvider } from "@/lib/auth/jwt-session-provider";
import type { ManagerSession } from "@/lib/auth/types";
import type { ISessionProvider } from "@/lib/auth/domain-contract";

export const SESSION_COOKIE_NAME = "shalomut_session";

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

