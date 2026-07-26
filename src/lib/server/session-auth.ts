import type { NextRequest } from "next/server";
import { JwtSessionProvider } from "@/lib/auth/jwt-session-provider";
import type { ManagerSession } from "@/lib/auth/types";

export const SESSION_COOKIE_NAME = "shalomut_session";

const defaultProvider = new JwtSessionProvider();

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
  provider = defaultProvider,
): Promise<ManagerSession | null> {
  const token = extractSessionToken(request);
  if (!token) return null;
  return provider.verifyToken(token);
}
