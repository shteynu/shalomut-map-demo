import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { InMemoryAuditLogRepository, InMemoryManagerRepository } from "@/lib/auth/domain-contract";
import { JwtSessionProvider } from "@/lib/auth/jwt-session-provider";
import { PLATFORM_SCOPE } from "@/lib/auth/manager-audit-service";
import type { Manager } from "@/lib/auth/types";
import {
  overrideCoreRepositories,
  resetCoreRepositories,
} from "@/lib/composition-root";
import { InMemoryOrganizationRepository } from "@/lib/repositories";
import type { Organization } from "@/lib/types/backend";
import { POST as createSchool } from "../schools/route";
import { POST as invite } from "../people/route";
import { PATCH as changeMembership } from "../memberships/[membershipId]/route";

const SCHOOL: Organization = {
  id: "org-school",
  name: "בית ספר שלום",
  city: "חיפה",
  schoolType: "יסודי",
  totalStaffCount: 40,
  createdAt: new Date("2026-08-20T00:00:00.000Z"),
};

const administrator: Manager = {
  id: "mgr-platform",
  email: "platform@shalomut.example",
  name: "Platform",
  isPlatformAdministrator: true,
  createdAt: new Date("2026-08-20T00:00:00.000Z"),
};

const schoolUser: Manager = {
  id: "mgr-principal",
  email: "principal@school.ac.il",
  name: "Principal",
  isPlatformAdministrator: false,
  createdAt: new Date("2026-08-20T00:00:00.000Z"),
};

let previousDatabaseUrl: string | undefined;

before(() => {
  previousDatabaseUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
});

after(() => {
  if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = previousDatabaseUrl;
  resetCoreRepositories();
});

async function cookieFor(manager: Manager, organizationId: string | null) {
  const { token } = await new JwtSessionProvider().createSession(
    manager,
    organizationId,
    organizationId
      ? [
          {
            id: "mbs-1",
            managerId: manager.id,
            organizationId,
            role: "admin",
            status: "active",
            createdAt: new Date(),
          },
        ]
      : [],
  );
  return `shalomut_session=${token}`;
}

function install() {
  const auditLogRepo = new InMemoryAuditLogRepository();
  const managerRepo = new InMemoryManagerRepository([administrator]);
  const orgRepo = new InMemoryOrganizationRepository([SCHOOL]);
  overrideCoreRepositories({ auditLogRepo, managerRepo, orgRepo });
  return { auditLogRepo, managerRepo, orgRepo };
}

function post(url: string, body: unknown, cookie?: string) {
  return new Request(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });
}

test("the administrator area answers 404 to a school user, and to nobody at all", async () => {
  install();
  const stranger = await cookieFor(schoolUser, SCHOOL.id);

  for (const cookie of [undefined, stranger]) {
    const created = await createSchool(
      post("http://localhost/api/admin/schools", { name: "x" }, cookie),
    );
    assert.strictEqual(created.status, 404);

    const invited = await invite(
      post(
        "http://localhost/api/admin/people",
        { email: "somebody@school.ac.il", organizationId: SCHOOL.id },
        cookie,
      ),
    );
    assert.strictEqual(invited.status, 404);
  }
});

test("an administrator opens a school, and the school is audited into being", async () => {
  const { auditLogRepo, orgRepo } = install();

  const response = await createSchool(
    post(
      "http://localhost/api/admin/schools",
      {
        name: "בית ספר חדש",
        city: "ירושלים",
        schoolType: "תיכון",
        totalStaffCount: 45,
      },
      await cookieFor(administrator, null),
    ),
  );

  assert.strictEqual(response.status, 201);
  const { organization } = await response.json();
  assert.strictEqual(organization.name, "בית ספר חדש");
  assert.strictEqual((await orgRepo.findAll()).length, 2);

  const [event] = await auditLogRepo.findByOrganizationId(organization.id);
  assert.strictEqual(event.action, "SCHOOL_CREATED");
  assert.strictEqual(event.managerId, administrator.id);
});

test("a school without a name, a city, a type or a staff count is not a school", async () => {
  const { orgRepo } = install();
  const cookie = await cookieFor(administrator, null);

  for (const body of [
    { city: "חיפה", schoolType: "יסודי", totalStaffCount: 10 },
    { name: "ש", schoolType: "יסודי", totalStaffCount: 10 },
    { name: "ש", city: "חיפה", totalStaffCount: 10 },
    { name: "ש", city: "חיפה", schoolType: "יסודי", totalStaffCount: 0 },
    { name: "ש", city: "חיפה", schoolType: "יסודי", totalStaffCount: "many" },
  ]) {
    const response = await createSchool(
      post("http://localhost/api/admin/schools", body, cookie),
    );
    assert.strictEqual(response.status, 400, JSON.stringify(body));
  }

  assert.strictEqual((await orgRepo.findAll()).length, 1);
});

test("inviting a school's user records who was invited, against that school", async () => {
  const { auditLogRepo, managerRepo } = install();

  const response = await invite(
    post(
      "http://localhost/api/admin/people",
      { email: "principal@school.ac.il", organizationId: SCHOOL.id },
      await cookieFor(administrator, null),
    ),
  );

  assert.strictEqual(response.status, 201);
  const { membership } = await response.json();
  assert.strictEqual(membership.status, "invited");

  const [event] = await auditLogRepo.findByOrganizationId(SCHOOL.id);
  assert.strictEqual(event.action, "MEMBER_INVITED");
  assert.strictEqual(event.details?.email, "principal@school.ac.il");

  const [stored] = await managerRepo.findMembershipsByOrganizationId(SCHOOL.id);
  assert.strictEqual(stored.organizationId, SCHOOL.id);
});

test("inviting an administrator names no school, because there is none", async () => {
  const { auditLogRepo } = install();

  const response = await invite(
    post(
      "http://localhost/api/admin/people",
      { email: "second@shalomut.example" },
      await cookieFor(administrator, null),
    ),
  );

  assert.strictEqual(response.status, 201);
  const [event] = await auditLogRepo.findByOrganizationId(PLATFORM_SCOPE);
  assert.strictEqual(event.action, "ADMINISTRATOR_INVITED");
});

test("a second invitation to an occupied school is refused with the reason", async () => {
  install();
  const cookie = await cookieFor(administrator, null);
  await invite(
    post(
      "http://localhost/api/admin/people",
      { email: "first@school.ac.il", organizationId: SCHOOL.id },
      cookie,
    ),
  );

  const response = await invite(
    post(
      "http://localhost/api/admin/people",
      { email: "second@school.ac.il", organizationId: SCHOOL.id },
      cookie,
    ),
  );

  assert.strictEqual(response.status, 409);
  assert.match((await response.json()).error, /one user/);
});

test("revoking a membership is audited and takes the school away", async () => {
  const { auditLogRepo, managerRepo } = install();
  const cookie = await cookieFor(administrator, null);
  const invited = await (
    await invite(
      post(
        "http://localhost/api/admin/people",
        { email: "principal@school.ac.il", organizationId: SCHOOL.id },
        cookie,
      ),
    )
  ).json();

  const response = await changeMembership(
    new Request(
      `http://localhost/api/admin/memberships/${invited.membership.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json", cookie },
        body: JSON.stringify({
          organizationId: SCHOOL.id,
          status: "suspended",
        }),
      },
    ),
    { params: Promise.resolve({ membershipId: invited.membership.id }) },
  );

  assert.strictEqual(response.status, 200);
  const [stored] = await managerRepo.findMembershipsByOrganizationId(SCHOOL.id);
  assert.strictEqual(stored.status, "suspended");

  const actions = (await auditLogRepo.findByOrganizationId(SCHOOL.id)).map(
    (event) => event.action,
  );
  assert.ok(actions.includes("MEMBER_REVOKED"));
});

test("a membership change that does not name its school is refused", async () => {
  install();

  const response = await changeMembership(
    new Request("http://localhost/api/admin/memberships/mbs-1", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        cookie: await cookieFor(administrator, null),
      },
      body: JSON.stringify({ status: "suspended" }),
    }),
    { params: Promise.resolve({ membershipId: "mbs-1" }) },
  );

  assert.strictEqual(response.status, 400);
});
