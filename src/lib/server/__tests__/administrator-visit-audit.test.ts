import assert from "node:assert/strict";
import test from "node:test";
import {
  InMemoryAuditLogRepository,
  type IAuditLogRepository,
} from "@/lib/auth/domain-contract";
import { JwtSessionProvider } from "@/lib/auth/jwt-session-provider";
import { ADMINISTRATOR_SCHOOL_VISIT } from "@/lib/auth/manager-audit-service";
import type { Manager, OrganizationMembership } from "@/lib/auth/types";
import {
  InMemoryOrganizationRepository,
  InMemoryRoundRepository,
} from "@/lib/repositories";
import {
  DEMO_ORGANIZATION,
  DEMO_ROUND,
} from "@/lib/repositories/__fixtures__/demo-records";
import {
  recordAdministratorSchoolVisit,
  resetVisitWindowForTests,
} from "../manager-audit";
import {
  EVERY_SCHOOL,
  MANAGER_MEMBER_SCHOOLS_HEADER,
  MANAGER_ORGANIZATION_HEADER,
  authorizeManagerRound,
} from "../manager-scope";

const SCHOOL = DEMO_ORGANIZATION.id;

const administrator: Manager = {
  id: "mgr-administrator",
  email: "operator@shalomut.example",
  name: "Platform Operator",
  isPlatformAdministrator: true,
  createdAt: new Date("2026-08-20T00:00:00.000Z"),
};

const schoolUser: Manager = {
  id: "mgr-school-user",
  email: "principal@shalom-school.ac.il",
  name: "Principal Cohen",
  isPlatformAdministrator: false,
  createdAt: new Date("2026-08-20T00:00:00.000Z"),
};

const schoolMembership: OrganizationMembership = {
  id: "mbs-school",
  managerId: schoolUser.id,
  organizationId: SCHOOL,
  role: "manager",
  status: "active",
  createdAt: new Date("2026-08-20T00:00:00.000Z"),
};

async function requestAs(
  manager: Manager,
  memberships: OrganizationMembership[],
) {
  const { token } = await new JwtSessionProvider().createSession(
    manager,
    manager.isPlatformAdministrator ? null : SCHOOL,
    memberships,
  );

  return {
    headers: new Headers({
      cookie: `shalomut_session=${token}`,
      [MANAGER_ORGANIZATION_HEADER]: SCHOOL,
      [MANAGER_MEMBER_SCHOOLS_HEADER]: manager.isPlatformAdministrator
        ? EVERY_SCHOOL
        : SCHOOL,
    }),
  };
}

/** An audit store that cannot be written to, which is the case worth refusing. */
const brokenAuditRepo: IAuditLogRepository = {
  recordEvent: async () => {
    throw new Error("the audit table is unreachable");
  },
  findByOrganizationId: async () => [],
};

test("an administrator opening a school they are not a member of leaves a row", async () => {
  resetVisitWindowForTests();
  const auditRepo = new InMemoryAuditLogRepository();

  const recorded = await recordAdministratorSchoolVisit(
    auditRepo,
    await requestAs(administrator, []),
    SCHOOL,
  );

  assert.strictEqual(recorded, true);
  const events = await auditRepo.findByOrganizationId(SCHOOL);
  assert.strictEqual(events.length, 1);
  assert.strictEqual(events[0].action, ADMINISTRATOR_SCHOOL_VISIT);
  assert.strictEqual(events[0].managerId, administrator.id);
  assert.strictEqual(events[0].organizationId, SCHOOL);
});

test("a school user reading their own school is the product working, not an event", async () => {
  resetVisitWindowForTests();
  const auditRepo = new InMemoryAuditLogRepository();

  const recorded = await recordAdministratorSchoolVisit(
    auditRepo,
    await requestAs(schoolUser, [schoolMembership]),
    SCHOOL,
  );

  assert.strictEqual(recorded, true);
  assert.deepStrictEqual(await auditRepo.findByOrganizationId(SCHOOL), []);
});

test("a request with no session records nothing and is not refused", async () => {
  resetVisitWindowForTests();
  const auditRepo = new InMemoryAuditLogRepository();

  const recorded = await recordAdministratorSchoolVisit(
    auditRepo,
    { headers: new Headers() },
    SCHOOL,
  );

  assert.strictEqual(recorded, true);
  assert.deepStrictEqual(await auditRepo.findByOrganizationId(SCHOOL), []);
});

test("one visit is one row, however many requests a screen makes", async () => {
  resetVisitWindowForTests();
  const auditRepo = new InMemoryAuditLogRepository();
  const request = await requestAs(administrator, []);

  for (let call = 0; call < 12; call += 1) {
    await recordAdministratorSchoolVisit(auditRepo, request, SCHOOL);
  }

  assert.strictEqual((await auditRepo.findByOrganizationId(SCHOOL)).length, 1);
});

test("a second school in the same window is a second visit", async () => {
  resetVisitWindowForTests();
  const auditRepo = new InMemoryAuditLogRepository();
  const request = await requestAs(administrator, []);

  await recordAdministratorSchoolVisit(auditRepo, request, SCHOOL);
  await recordAdministratorSchoolVisit(auditRepo, request, "org-another");

  assert.strictEqual((await auditRepo.findByOrganizationId(SCHOOL)).length, 1);
  assert.strictEqual(
    (await auditRepo.findByOrganizationId("org-another")).length,
    1,
  );
});

test("a visit that could not be recorded is refused, and does not silence the next one", async () => {
  resetVisitWindowForTests();
  const request = await requestAs(administrator, []);

  const refused = await recordAdministratorSchoolVisit(
    brokenAuditRepo,
    request,
    SCHOOL,
  );
  assert.strictEqual(refused, false);

  // The window must not have been claimed by the write that never happened.
  const auditRepo = new InMemoryAuditLogRepository();
  const recorded = await recordAdministratorSchoolVisit(
    auditRepo,
    request,
    SCHOOL,
  );
  assert.strictEqual(recorded, true);
  assert.strictEqual((await auditRepo.findByOrganizationId(SCHOOL)).length, 1);
});

test("a round route records the administrator's visit before it answers", async () => {
  resetVisitWindowForTests();
  const auditRepo = new InMemoryAuditLogRepository();

  const authorization = await authorizeManagerRound(
    await requestAs(administrator, []),
    DEMO_ROUND.id,
    new InMemoryOrganizationRepository([DEMO_ORGANIZATION]),
    new InMemoryRoundRepository([DEMO_ROUND]),
    auditRepo,
  );

  assert.strictEqual(authorization.ok, true);
  const [event] = await auditRepo.findByOrganizationId(SCHOOL);
  assert.strictEqual(event.action, ADMINISTRATOR_SCHOOL_VISIT);
  assert.strictEqual(event.roundId, DEMO_ROUND.id);
});

test("a round route refuses the read when the visit cannot be recorded", async () => {
  resetVisitWindowForTests();

  const authorization = await authorizeManagerRound(
    await requestAs(administrator, []),
    DEMO_ROUND.id,
    new InMemoryOrganizationRepository([DEMO_ORGANIZATION]),
    new InMemoryRoundRepository([DEMO_ROUND]),
    brokenAuditRepo,
  );

  assert.strictEqual(authorization.ok, false);
  assert.strictEqual(authorization.ok ? 0 : authorization.response.status, 503);
});

test("a school user's own round is answered even when the audit store is broken", async () => {
  resetVisitWindowForTests();

  const authorization = await authorizeManagerRound(
    await requestAs(schoolUser, [schoolMembership]),
    DEMO_ROUND.id,
    new InMemoryOrganizationRepository([DEMO_ORGANIZATION]),
    new InMemoryRoundRepository([DEMO_ROUND]),
    brokenAuditRepo,
  );

  assert.strictEqual(authorization.ok, true);
});
