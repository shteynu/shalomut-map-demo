import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import {
  InMemoryAuditLogRepository,
  InMemoryManagerRepository,
  type IAuditLogRepository,
} from "@/lib/auth/domain-contract";
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

/**
 * What the database does when it cannot take the record: it says so, and the
 * write that was supposed to be recorded with it must not stand.
 *
 * A `Proxy` rather than a spread of the repository, because these repositories
 * carry their methods on a prototype and spreading one yields an object with
 * none of them.
 */
function refusingToRecord(base: IAuditLogRepository): IAuditLogRepository {
  return new Proxy(base, {
    get(target, key) {
      if (key === "recordEvent") {
        return () => {
          throw new Error("audit_events is unreachable: connection terminated");
        };
      }
      const value = Reflect.get(target, key, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  }) as IAuditLogRepository;
}

function install(auditFails = false) {
  const recorded = new InMemoryAuditLogRepository();
  const auditLogRepo = auditFails ? refusingToRecord(recorded) : recorded;
  const managerRepo = new InMemoryManagerRepository([administrator]);
  const orgRepo = new InMemoryOrganizationRepository([SCHOOL]);
  overrideCoreRepositories({ auditLogRepo, managerRepo, orgRepo });
  // `recorded` and not `auditLogRepo`: a test that made the recording fail
  // still needs to read what did get through, which is nothing.
  return { auditLogRepo: recorded, managerRepo, orgRepo };
}

function patch(membershipId: string, body: unknown, cookie: string) {
  return changeMembership(
    new Request(`http://localhost/api/admin/memberships/${membershipId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ membershipId }) },
  );
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

test("an administrative write nobody could record answers that it failed", async () => {
  // The owner's decision of 2026-08-23: these audits are mandatory. Until then
  // each of these three routes wrote first and recorded afterwards, so a failing
  // audit insert left the write standing and answered 500 — the administrator
  // read a failure while the row disagreed with them.
  const cookie = await cookieFor(administrator, null);

  const attempts: Array<[string, () => Promise<Response>]> = [
    [
      "opening a school",
      async () =>
        createSchool(
          post(
            "http://localhost/api/admin/schools",
            {
              name: "בית ספר חדש",
              city: "ירושלים",
              schoolType: "תיכון",
              totalStaffCount: 45,
            },
            cookie,
          ),
        ),
    ],
    [
      "inviting a school's user",
      async () =>
        invite(
          post(
            "http://localhost/api/admin/people",
            { email: "principal@school.ac.il", organizationId: SCHOOL.id },
            cookie,
          ),
        ),
    ],
    [
      "inviting an administrator",
      async () =>
        invite(
          post(
            "http://localhost/api/admin/people",
            { email: "second@shalomut.example" },
            cookie,
          ),
        ),
    ],
  ];

  for (const [what, attempt] of attempts) {
    install(true);
    const response = await attempt();
    assert.strictEqual(response.status, 500, what);

    const { error } = await response.json();
    // The constant, and only the constant. The thrown message names a table and
    // a connection state, and the caller of this endpoint is a browser: it can
    // act on "this did not happen" and cannot act on the rest.
    assert.doesNotMatch(error, /connection terminated|audit_events/, what);
  }
});

test("a membership change nobody could record answers that it failed", async () => {
  const cookie = await cookieFor(administrator, null);
  // Invited while the recording still works, so the change below is the only
  // thing the failing audit is being asked about.
  install();
  const invited = await (
    await invite(
      post(
        "http://localhost/api/admin/people",
        { email: "principal@school.ac.il", organizationId: SCHOOL.id },
        cookie,
      ),
    )
  ).json();

  // Only the audit store is swapped. A second `install` would replace the
  // manager store too, and the change would be refused as "not found" — a 404
  // that looks like this test passing for the wrong reason.
  overrideCoreRepositories({
    auditLogRepo: refusingToRecord(new InMemoryAuditLogRepository()),
  });

  const response = await patch(
    invited.membership.id,
    { organizationId: SCHOOL.id, status: "suspended" },
    cookie,
  );

  assert.strictEqual(response.status, 500);
  assert.doesNotMatch(
    (await response.json()).error,
    /connection terminated|audit_events/,
  );
});

test("a refusal is not a failed audit: it keeps its own status and records nothing", async () => {
  // The refusals return out of the transaction rather than throwing, because
  // nothing was written and there is nothing to roll back or to record. Were
  // they thrown, every "not found" would arrive as a 500.
  const { auditLogRepo } = install();
  const cookie = await cookieFor(administrator, null);

  const missing = await patch(
    "mbs-nobody-has",
    { organizationId: SCHOOL.id, status: "suspended" },
    cookie,
  );
  assert.strictEqual(missing.status, 404);

  await invite(
    post(
      "http://localhost/api/admin/people",
      { email: "first@school.ac.il", organizationId: SCHOOL.id },
      cookie,
    ),
  );
  const second = await invite(
    post(
      "http://localhost/api/admin/people",
      { email: "second@school.ac.il", organizationId: SCHOOL.id },
      cookie,
    ),
  );
  assert.strictEqual(second.status, 409);

  // Exactly one event: the invitation that succeeded. Neither refusal wrote one.
  const actions = (await auditLogRepo.findByOrganizationId(SCHOOL.id)).map(
    (event) => event.action,
  );
  assert.deepStrictEqual(actions, ["MEMBER_INVITED"]);
});

test("the in-memory wiring reports the failure but cannot undo the write", async () => {
  // Deliberately asserting the divergence rather than hiding it. `runInTransaction`
  // with no database calls the work with the ephemeral repositories, and a `Map`
  // has nothing to roll back — so here the school exists despite the 500. That
  // is the whole reason the rollback is proved against PostgreSQL instead, in
  // `src/lib/repositories/__dbtests__/postgres-administrative-audit.test.ts`.
  const { orgRepo } = install(true);

  const response = await createSchool(
    post(
      "http://localhost/api/admin/schools",
      {
        name: "בית ספר שנוצר בכל זאת",
        city: "ירושלים",
        schoolType: "תיכון",
        totalStaffCount: 45,
      },
      await cookieFor(administrator, null),
    ),
  );

  assert.strictEqual(response.status, 500);
  assert.strictEqual((await orgRepo.findAll()).length, 2);
});
