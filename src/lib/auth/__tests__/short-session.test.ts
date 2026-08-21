import assert from "node:assert/strict";
import test from "node:test";
import { InMemoryManagerRepository } from "../domain-contract";
import { JwtSessionProvider } from "../jwt-session-provider";
import { MembershipService } from "../membership-service";
import {
  SESSION_ABSOLUTE_LIFETIME_SECONDS,
  SESSION_TTL_SECONDS,
  ttlSecondsWithin,
} from "../session-lifetime";
import { SessionRenewalService } from "../session-renewal-service";
import type { Manager, OrganizationMembership } from "../types";

const SECRET = "short-session-test-secret-0123456789";

/**
 * Which door these sessions came through. Almost every test here is about the
 * one that is replacing the other: an identity provider in front, manager rows
 * behind it. The two at the end are about the interim password door, whose
 * managers are environment constants with no rows — and passing this explicitly
 * is what keeps a test from silently exercising whichever door the ambient
 * environment happens to have configured.
 */
const PROVIDER_CONFIGURED = true;
const PROVIDER_ABSENT = false;

function manager(overrides: Partial<Manager> = {}): Manager {
  return {
    id: "mgr-cohen",
    email: "cohen@school-a.ac.il",
    name: "Cohen",
    isPlatformAdministrator: false,
    createdAt: new Date("2026-08-01T00:00:00Z"),
    ...overrides,
  };
}

function membership(
  overrides: Partial<OrganizationMembership> = {},
): OrganizationMembership {
  return {
    id: "mbs-a",
    managerId: "mgr-cohen",
    organizationId: "org-school-a",
    role: "manager",
    status: "active",
    createdAt: new Date("2026-08-01T00:00:00Z"),
    ...overrides,
  };
}

function repositoryWith(
  managers: Manager[],
  memberships: OrganizationMembership[],
) {
  return new InMemoryManagerRepository(managers, memberships);
}

test("a fresh session is a quarter of an hour long under a twelve-hour deadline", async () => {
  const provider = new JwtSessionProvider(SECRET);
  const { session } = await provider.createSession(manager(), "org-school-a", [
    membership(),
  ]);

  const windowSeconds =
    (session.expiresAt.getTime() - session.issuedAt.getTime()) / 1000;
  const capSeconds =
    (session.absoluteExpiresAt.getTime() - session.issuedAt.getTime()) / 1000;

  assert.strictEqual(windowSeconds, SESSION_TTL_SECONDS);
  assert.strictEqual(capSeconds, SESSION_ABSOLUTE_LIFETIME_SECONDS);
});

test("a token minted before the deadline claim existed is refused", async () => {
  // Forged by hand rather than produced, because the code that produced this
  // shape is gone: it is a 24-hour token from before phase 5, correctly signed
  // with this runtime's own secret and unexpired. Honouring it would mean the
  // sessions this phase exists to shorten outlive the phase.
  const provider = new JwtSessionProvider(SECRET);
  const nowSeconds = Math.floor(Date.now() / 1000);
  const encode = (value: object) =>
    Buffer.from(JSON.stringify(value))
      .toString("base64url")
      .replace(/=+$/, "");

  const header = encode({ alg: "HS256", typ: "JWT" });
  const payload = encode({
    sub: "mgr-cohen",
    email: "cohen@school-a.ac.il",
    org: "org-school-a",
    role: "manager",
    mbs: [
      { id: "mbs-a", org: "org-school-a", role: "manager", status: "active" },
    ],
    iat: nowSeconds,
    exp: nowSeconds + 86400,
    // and no `abs`
  });

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${header}.${payload}`),
  );
  const token = `${header}.${payload}.${Buffer.from(signature)
    .toString("base64url")
    .replace(/=+$/, "")}`;

  assert.strictEqual(await provider.verifyToken(token), null);
});

test("renewal moves the window forward and leaves the deadline where it was", async () => {
  const provider = new JwtSessionProvider(SECRET);
  const repo = repositoryWith([manager()], [membership()]);

  const { session } = await provider.createSession(manager(), "org-school-a", [
    membership(),
  ]);

  const laterOn = new Date(session.issuedAt.getTime() + 10 * 60 * 1000);
  const result = await SessionRenewalService.renew(
    repo,
    provider,
    session,
    laterOn,
    PROVIDER_CONFIGURED,
  );

  assert.ok(result.ok);
  // A full window again, measured from the renewal rather than from the
  // sign-in — which is the whole of what renewal does to the clock. Asserted as
  // a duration rather than as "later than before", because the provider mints
  // against the wall clock and a test that ran in under a millisecond would
  // find the two instants equal.
  assert.strictEqual(
    (result.session.expiresAt.getTime() -
      result.session.issuedAt.getTime()) /
      1000,
    SESSION_TTL_SECONDS,
  );
  assert.strictEqual(
    result.session.absoluteExpiresAt.getTime(),
    session.absoluteExpiresAt.getTime(),
    "the deadline should not have moved",
  );
});

test("renewal past the deadline is refused however active the manager has been", async () => {
  const provider = new JwtSessionProvider(SECRET);
  const repo = repositoryWith([manager()], [membership()]);

  const { session } = await provider.createSession(manager(), "org-school-a", [
    membership(),
  ]);

  const pastTheCap = new Date(session.absoluteExpiresAt.getTime() + 1000);
  const result = await SessionRenewalService.renew(
    repo,
    provider,
    session,
    pastTheCap,
    PROVIDER_CONFIGURED,
  );

  assert.ok(!result.ok);
  assert.strictEqual(result.reason, "SESSION_EXPIRED");
});

test("a renewal near the deadline does not mint a token that outlives it", async () => {
  const provider = new JwtSessionProvider(SECRET);
  const repo = repositoryWith([manager()], [membership()]);

  const { session } = await provider.createSession(manager(), "org-school-a", [
    membership(),
  ]);

  // Five minutes left of the twelve hours, and the window is fifteen.
  const nearTheEnd = new Date(
    session.absoluteExpiresAt.getTime() - 5 * 60 * 1000,
  );
  const result = await SessionRenewalService.renew(
    repo,
    provider,
    session,
    nearTheEnd,
    PROVIDER_CONFIGURED,
  );

  assert.ok(result.ok);
  assert.ok(
    result.session.expiresAt.getTime() <=
      session.absoluteExpiresAt.getTime() + 1000,
    "a renewed token must not outlive the deadline it carries",
  );
  assert.strictEqual(ttlSecondsWithin(session.absoluteExpiresAt, nearTheEnd), 300);
});

test("a suspended membership is refused at renewal rather than at the next sign-in", async () => {
  const provider = new JwtSessionProvider(SECRET);
  const { session } = await provider.createSession(manager(), "org-school-a", [
    membership(),
  ]);

  // The administrator revokes it while the person is signed in. This is the
  // exact sequence the phase 2 walk watched succeed.
  const repo = repositoryWith(
    [manager()],
    [membership({ status: "suspended" })],
  );

  const result = await SessionRenewalService.renew(
    repo,
    provider,
    session,
    new Date(),
    PROVIDER_CONFIGURED,
  );

  assert.ok(!result.ok);
  assert.strictEqual(result.reason, "NO_ACTIVE_MEMBERSHIP");
});

test("a session is refused when the school it names is no longer its manager's", async () => {
  const provider = new JwtSessionProvider(SECRET);
  const both = [
    membership(),
    membership({ id: "mbs-b", organizationId: "org-school-b" }),
  ];
  const { session } = await provider.createSession(
    manager(),
    "org-school-a",
    both,
  );

  // School A taken away, school B kept. Refused rather than slid sideways into
  // B: signing in again lands them on B and says so.
  const repo = repositoryWith(
    [manager()],
    [
      membership({ status: "suspended" }),
      membership({ id: "mbs-b", organizationId: "org-school-b" }),
    ],
  );

  const result = await SessionRenewalService.renew(
    repo,
    provider,
    session,
    new Date(),
    PROVIDER_CONFIGURED,
  );

  assert.ok(!result.ok);
  assert.strictEqual(result.reason, "SCHOOL_REVOKED");
});

test("a session whose manager row is gone is refused", async () => {
  const provider = new JwtSessionProvider(SECRET);
  const { session } = await provider.createSession(manager(), "org-school-a", [
    membership(),
  ]);

  const result = await SessionRenewalService.renew(
    repositoryWith([], []),
    provider,
    session,
    new Date(),
    PROVIDER_CONFIGURED,
  );

  assert.ok(!result.ok);
  assert.strictEqual(result.reason, "USER_NOT_FOUND");
});

test("renewal picks up a role that changed under the session", async () => {
  const provider = new JwtSessionProvider(SECRET);
  const { session } = await provider.createSession(manager(), "org-school-a", [
    membership({ role: "admin" }),
  ]);
  assert.strictEqual(session.role, "admin");

  const repo = repositoryWith([manager()], [membership({ role: "manager" })]);
  const result = await SessionRenewalService.renew(
    repo,
    provider,
    session,
    new Date(),
    PROVIDER_CONFIGURED,
  );

  assert.ok(result.ok);
  assert.strictEqual(result.session.role, "manager");
});

test("renewal picks up an administrator flag that was taken away", async () => {
  const provider = new JwtSessionProvider(SECRET);
  const administrator = manager({ isPlatformAdministrator: true });
  const { session } = await provider.createSession(administrator, null, []);
  assert.strictEqual(session.isPlatformAdministrator, true);

  // No longer an administrator, and never a member of any school — so there is
  // nothing left for this session to be.
  const repo = repositoryWith([manager()], []);
  const result = await SessionRenewalService.renew(
    repo,
    provider,
    session,
    new Date(),
    PROVIDER_CONFIGURED,
  );

  assert.ok(!result.ok);
  assert.strictEqual(result.reason, "NO_ACTIVE_MEMBERSHIP");
});

test("an administrator who is still one keeps a school-less session", async () => {
  const provider = new JwtSessionProvider(SECRET);
  const administrator = manager({ isPlatformAdministrator: true });
  const { session } = await provider.createSession(administrator, null, []);

  const repo = repositoryWith([administrator], []);
  const result = await SessionRenewalService.renew(
    repo,
    provider,
    session,
    new Date(),
    PROVIDER_CONFIGURED,
  );

  assert.ok(result.ok);
  assert.strictEqual(result.session.activeOrganizationId, null);
  assert.strictEqual(result.session.isPlatformAdministrator, true);
});

test("switching school continues the session rather than restarting its clock", async () => {
  const provider = new JwtSessionProvider(SECRET);
  const both = [
    membership({ role: "admin" }),
    membership({ id: "mbs-b", organizationId: "org-school-b", role: "admin" }),
  ];
  const { session } = await provider.createSession(
    manager(),
    "org-school-a",
    both,
  );

  const switched = await MembershipService.switchActiveOrganization(
    provider,
    session,
    "org-school-b",
  );

  assert.ok(switched);
  assert.strictEqual(switched.session.activeOrganizationId, "org-school-b");
  assert.strictEqual(
    switched.session.absoluteExpiresAt.getTime(),
    session.absoluteExpiresAt.getTime(),
    "opening another school must not push the twelve hours out",
  );
});

test("a password session is renewed against the environment, which is where its manager lives", async () => {
  // The defect the local walk found. The interim password door builds its
  // managers from environment variables — `mgr-admin-001` is a constant in
  // `manager-auth-service.ts` and has no row anywhere — so renewing it against
  // `managers` refused every sign-in one renewal after allowing it. The deployed
  // endpoint is on this door until its OAuth client exists, so this is not a
  // local-only case.
  const provider = new JwtSessionProvider(SECRET);
  const passwordManager = manager({
    id: "mgr-admin-001",
    email: "admin@shalomut.edu.il",
  });
  const passwordMembership = membership({
    id: "mem-admin-001",
    managerId: "mgr-admin-001",
    organizationId: "local-dev-organization",
    role: "admin",
  });

  const { session } = await provider.createSession(
    passwordManager,
    "local-dev-organization",
    [passwordMembership],
  );

  const result = await SessionRenewalService.renew(
    // Empty on purpose: the database has nothing to say about this session, and
    // asking it is the bug.
    repositoryWith([], []),
    provider,
    session,
    new Date(),
    PROVIDER_ABSENT,
  );

  assert.ok(result.ok);
  assert.strictEqual(result.session.managerId, "mgr-admin-001");
  assert.strictEqual(
    result.session.activeOrganizationId,
    "local-dev-organization",
  );
});

test("a password session ends at its next renewal once a provider is configured", async () => {
  const provider = new JwtSessionProvider(SECRET);
  const passwordManager = manager({
    id: "mgr-admin-001",
    email: "admin@shalomut.edu.il",
  });
  const { session } = await provider.createSession(
    passwordManager,
    "local-dev-organization",
    [
      membership({
        id: "mem-admin-001",
        managerId: "mgr-admin-001",
        organizationId: "local-dev-organization",
        role: "admin",
      }),
    ],
  );

  // The OAuth client was created and the four `OIDC_*` values set. The password
  // door is shut for new sign-ins by `authenticateCredentials`; this is what
  // shuts it for the sessions it already handed out.
  const result = await SessionRenewalService.renew(
    repositoryWith([], []),
    provider,
    session,
    new Date(),
    PROVIDER_CONFIGURED,
  );

  assert.ok(!result.ok);
  assert.strictEqual(result.reason, "USER_NOT_FOUND");
});
