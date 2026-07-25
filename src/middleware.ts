import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { decideBasicAuth } from "@/lib/server/basic-auth";

/**
 * Manager surfaces have no application-level authentication yet, so a single
 * shared Basic credential keeps a public deployment from accepting anonymous
 * writes. It gates access; it does not identify a manager or scope an
 * organization.
 */
export function middleware(request: NextRequest) {
  const decision = decideBasicAuth({
    pathname: request.nextUrl.pathname,
    method: request.method,
    authorization: request.headers.get("authorization"),
  });

  if (decision === "allow") return NextResponse.next();

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
