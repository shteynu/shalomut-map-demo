import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { JwtSessionProvider } from "@/lib/auth/jwt-session-provider";
import { ManagerAuthenticationService } from "@/lib/auth/manager-auth-service";
import { SESSION_COOKIE_NAME } from "@/lib/server/session-auth";

const sessionProvider = new JwtSessionProvider();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { email, password } = body || {};

    if (!email || !password) {
      return NextResponse.json(
        {
          ok: false,
          error: "יש להזין כתובת דוא\"ל וסיסמה",
          reason: "INVALID_CREDENTIALS",
        },
        { status: 400 },
      );
    }

    const authResult = await ManagerAuthenticationService.authenticateCredentials(
      email,
      password,
    );

    if (!authResult.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: authResult.message,
          reason: authResult.reason,
        },
        { status: 401 },
      );
    }

    const { manager, memberships } = authResult;
    const activeMembership = memberships.find((m) => m.status === "active") || memberships[0];
    const activeOrganizationId = activeMembership.organizationId;

    const { token, session } = await sessionProvider.createSession(
      manager,
      activeOrganizationId,
      memberships,
    );

    const isSecure =
      process.env.NODE_ENV === "production" ||
      request.nextUrl.protocol === "https:";

    const response = NextResponse.json({
      ok: true,
      session: {
        managerId: session.managerId,
        email: session.email,
        name: manager.name,
        role: session.role,
        activeOrganizationId: session.activeOrganizationId,
        memberships: session.memberships,
      },
    });

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: token,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: isSecure,
      maxAge: 86400, // 24 hours
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "שגיאת שרת פנימית בעת ניסיון ההתחברות",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
