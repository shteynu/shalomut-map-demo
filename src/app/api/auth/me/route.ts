import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { resolveManagerSession } from "@/lib/server/session-auth";

export async function GET(request: NextRequest) {
  const session = await resolveManagerSession(request);

  if (!session) {
    return NextResponse.json({
      authenticated: false,
      session: null,
    });
  }

  return NextResponse.json({
    authenticated: true,
    session: {
      managerId: session.managerId,
      email: session.email,
      role: session.role,
      activeOrganizationId: session.activeOrganizationId,
      memberships: session.memberships,
      issuedAt: session.issuedAt,
      expiresAt: session.expiresAt,
    },
  });
}
