import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { JwtSessionProvider } from "@/lib/auth/jwt-session-provider";
import { ManagerAuthenticationService } from "@/lib/auth/manager-auth-service";
import { setSessionCookie } from "@/lib/server/session-auth";
import { getRateLimitResponse, RATE_LIMITS } from "@/lib/server/rate-limit";

export async function POST(request: NextRequest) {
  try {
    /*
     * Before the password is even read. One deployment has one manager account
     * (ADR-020), so an attacker's entire search space is that account's
     * password and nothing here was counting the guesses.
     *
     * The refusal is deliberately indistinguishable between a right and a
     * wrong password: it is a 429 either way, so the limit cannot be used to
     * confirm a guess that arrived one request too late.
     */
    const limited = await getRateLimitResponse(
      request.headers,
      RATE_LIMITS.managerLogin,
    );
    if (limited) return limited;

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
      // 403 rather than 401: the credentials were not wrong, they were the
      // wrong kind. A 401 would invite the browser — and the manager — to try
      // the password again.
      const status =
        authResult.reason === "UNCONFIGURED"
          ? 503
          : authResult.reason === "PROVIDER_REQUIRED"
            ? 403
            : 401;
      return NextResponse.json(
        {
          ok: false,
          error: authResult.message,
          reason: authResult.reason,
        },
        { status },
      );
    }

    const { manager, memberships } = authResult;
    const activeMembership = memberships.find((m) => m.status === "active") || memberships[0];
    const activeOrganizationId = activeMembership.organizationId;

    let sessionProvider: JwtSessionProvider;
    try {
      sessionProvider = new JwtSessionProvider();
    } catch {
      return NextResponse.json(
        {
          ok: false,
          error: "שרת התחברות המנהלים אינו מוגדר בסביבה זו (חסרים סודות מערכת)",
          reason: "UNCONFIGURED",
        },
        { status: 503 },
      );
    }

    const { token, session } = await sessionProvider.createSession(
      manager,
      activeOrganizationId,
      memberships,
    );

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

    return setSessionCookie(response, token, request);
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
