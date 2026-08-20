import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { middleware } from "../../../middleware";
import { JwtSessionProvider } from "@/lib/auth/jwt-session-provider";
import {
  MANAGER_MEMBER_SCHOOLS_HEADER,
  MANAGER_ORGANIZATION_HEADER,
  MANAGER_SCHOOL_COOKIE,
} from "../manager-scope";
import type {
  Manager,
  MembershipStatus,
  OrganizationMembership,
} from "@/lib/auth/types";

const SESSION_SCHOOL = "org-session-school";
const SECOND_SCHOOL = "org-second-school";
const FOREIGN_SCHOOL = "org-someone-elses-school";

const manager: Manager = {
  id: "mgr-test-scope",
  email: "principal@shalom-school.ac.il",
  name: "Principal Cohen",
  isPlatformAdministrator: false,
  createdAt: new Date("2026-07-01T00:00:00.000Z"),
};

function membership(
  organizationId: string,
  status: MembershipStatus = "active",
): OrganizationMembership {
  return {
    id: `mbs-${organizationId}`,
    managerId: manager.id,
    organizationId,
    role: "manager",
    status,
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
  };
}

/**
 * A manager of two schools, which is the only session that can exercise the
 * switcher at all. The deployment has one membership per session today; the
 * boundary is about what happens when it does not.
 */
async function sessionCookie(
  memberships: OrganizationMembership[] = [
    membership(SESSION_SCHOOL),
    membership(SECOND_SCHOOL),
  ],
) {
  const provider = new JwtSessionProvider();
  const { token } = await provider.createSession(
    manager,
    SESSION_SCHOOL,
    memberships,
  );

  return `shalomut_session=${token}`;
}

function injectedSchool(response: Response) {
  return (
    response.headers.get(
      `x-middleware-request-${MANAGER_ORGANIZATION_HEADER}`,
    ) || response.headers.get(MANAGER_ORGANIZATION_HEADER)
  );
}

function injectedMemberSchools(response: Response) {
  return (
    response.headers.get(
      `x-middleware-request-${MANAGER_MEMBER_SCHOOLS_HEADER}`,
    ) ?? response.headers.get(MANAGER_MEMBER_SCHOOLS_HEADER)
  );
}

test("a school chosen on the setup screen scopes the request and is remembered", async () => {
  const request = new NextRequest(
    `http://localhost:3000/setup?school=${SECOND_SCHOOL}`,
    { headers: { cookie: await sessionCookie() } },
  );

  const response = await middleware(request);

  assert.strictEqual(injectedSchool(response), SECOND_SCHOOL);
  assert.strictEqual(
    response.cookies.get(MANAGER_SCHOOL_COOKIE)?.value,
    SECOND_SCHOOL,
  );
});

test("the remembered school scopes screens that carry no school in their URL", async () => {
  const request = new NextRequest("http://localhost:3000/dashboard", {
    headers: {
      cookie: `${await sessionCookie()}; ${MANAGER_SCHOOL_COOKIE}=${SECOND_SCHOOL}`,
    },
  });

  const response = await middleware(request);

  assert.strictEqual(injectedSchool(response), SECOND_SCHOOL);
});

test("without a chosen school the session's school is the one a manager lands on", async () => {
  const request = new NextRequest("http://localhost:3000/dashboard", {
    headers: { cookie: await sessionCookie() },
  });

  const response = await middleware(request);

  assert.strictEqual(injectedSchool(response), SESSION_SCHOOL);
});

test("opening a school that does not exist yet keeps reading the current one", async () => {
  const request = new NextRequest("http://localhost:3000/setup?school=new", {
    headers: {
      cookie: `${await sessionCookie()}; ${MANAGER_SCHOOL_COOKIE}=${SECOND_SCHOOL}`,
    },
  });

  const response = await middleware(request);

  assert.strictEqual(injectedSchool(response), SECOND_SCHOOL);
  assert.strictEqual(response.cookies.get(MANAGER_SCHOOL_COOKIE), undefined);
});

test("a respondent route is scoped to no school at all", async () => {
  const request = new NextRequest(
    `http://localhost:3000/answer/SHALOM-TEST1?school=${SECOND_SCHOOL}`,
    {
      headers: {
        cookie: `${MANAGER_SCHOOL_COOKIE}=${SECOND_SCHOOL}`,
        [MANAGER_ORGANIZATION_HEADER]: "org-attacker-injected",
        [MANAGER_MEMBER_SCHOOLS_HEADER]: "org-attacker-injected",
      },
    },
  );

  const response = await middleware(request);

  assert.strictEqual(injectedSchool(response), null);
  assert.strictEqual(injectedMemberSchools(response), null);
});

test("a school the session is not a member of is not a school it can ask for", async () => {
  const request = new NextRequest(
    `http://localhost:3000/setup?school=${FOREIGN_SCHOOL}`,
    { headers: { cookie: await sessionCookie() } },
  );

  const response = await middleware(request);

  assert.strictEqual(injectedSchool(response), SESSION_SCHOOL);
  assert.strictEqual(
    response.cookies.get(MANAGER_SCHOOL_COOKIE)?.value,
    undefined,
  );
});

test("a remembered school the session is not a member of is forgotten rather than refused again", async () => {
  const request = new NextRequest("http://localhost:3000/dashboard", {
    headers: {
      cookie: `${await sessionCookie()}; ${MANAGER_SCHOOL_COOKIE}=${FOREIGN_SCHOOL}`,
    },
  });

  const response = await middleware(request);

  assert.strictEqual(injectedSchool(response), SESSION_SCHOOL);
  assert.strictEqual(response.cookies.get(MANAGER_SCHOOL_COOKIE)?.value, "");
});

test("a suspended membership is not a school the session may open", async () => {
  const request = new NextRequest(
    `http://localhost:3000/setup?school=${SECOND_SCHOOL}`,
    {
      headers: {
        cookie: await sessionCookie([
          membership(SESSION_SCHOOL),
          membership(SECOND_SCHOOL, "suspended"),
        ]),
      },
    },
  );

  const response = await middleware(request);

  assert.strictEqual(injectedSchool(response), SESSION_SCHOOL);
  assert.strictEqual(injectedMemberSchools(response), SESSION_SCHOOL);
});

test("the schools a session may read travel with the request", async () => {
  const request = new NextRequest("http://localhost:3000/dashboard", {
    headers: { cookie: await sessionCookie() },
  });

  const response = await middleware(request);

  assert.strictEqual(
    injectedMemberSchools(response),
    `${SESSION_SCHOOL},${SECOND_SCHOOL}`,
  );
});

test("a request cannot carry its own scope past the middleware", async () => {
  const request = new NextRequest("http://localhost:3000/dashboard", {
    headers: {
      cookie: await sessionCookie(),
      [MANAGER_ORGANIZATION_HEADER]: FOREIGN_SCHOOL,
      [MANAGER_MEMBER_SCHOOLS_HEADER]: FOREIGN_SCHOOL,
    },
  });

  const response = await middleware(request);

  assert.strictEqual(injectedSchool(response), SESSION_SCHOOL);
  assert.strictEqual(
    injectedMemberSchools(response),
    `${SESSION_SCHOOL},${SECOND_SCHOOL}`,
  );
});

/**
 * The second branch of the same check. An administrator belongs to no school
 * and may open any, which is one condition in the middleware rather than an
 * exception spread through the scope service and the switcher.
 */
async function administratorCookie(
  memberships: OrganizationMembership[] = [],
  activeOrganizationId: string | null = null,
) {
  const provider = new JwtSessionProvider();
  const { token } = await provider.createSession(
    { ...manager, id: "mgr-platform", isPlatformAdministrator: true },
    activeOrganizationId,
    memberships,
  );

  return `shalomut_session=${token}`;
}

test("an administrator may open a school no membership names", async () => {
  const request = new NextRequest(
    `http://localhost:3000/setup?school=${FOREIGN_SCHOOL}`,
    { headers: { cookie: await administratorCookie() } },
  );

  const response = await middleware(request);

  assert.strictEqual(injectedSchool(response), FOREIGN_SCHOOL);
  assert.strictEqual(
    response.cookies.get(MANAGER_SCHOOL_COOKIE)?.value,
    FOREIGN_SCHOOL,
  );
});

test("an administrator's request is restricted to no school in particular", async () => {
  const request = new NextRequest("http://localhost:3000/setup", {
    headers: { cookie: await administratorCookie() },
  });

  const response = await middleware(request);

  // Every school, rather than a list of them: the number of schools must not
  // change what an administrator's session carries.
  assert.strictEqual(injectedMemberSchools(response), "*");
  assert.strictEqual(injectedSchool(response), null);
});

test("an administrator who has not chosen a school is scoped to none", async () => {
  const request = new NextRequest("http://localhost:3000/dashboard", {
    headers: { cookie: await administratorCookie() },
  });

  const response = await middleware(request);

  assert.strictEqual(injectedSchool(response), null);
});

test("a school user is still refused the school an administrator may open", async () => {
  const request = new NextRequest(
    `http://localhost:3000/setup?school=${FOREIGN_SCHOOL}`,
    { headers: { cookie: await sessionCookie() } },
  );

  const response = await middleware(request);

  assert.strictEqual(injectedSchool(response), SESSION_SCHOOL);
  assert.notStrictEqual(injectedMemberSchools(response), "*");
});
