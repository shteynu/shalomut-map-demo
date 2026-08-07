import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { middleware } from "../../../middleware";
import { JwtSessionProvider } from "@/lib/auth/jwt-session-provider";
import {
  MANAGER_ORGANIZATION_HEADER,
  MANAGER_SCHOOL_COOKIE,
} from "../manager-scope";
import type { Manager, OrganizationMembership } from "@/lib/auth/types";

const SESSION_SCHOOL = "org-session-school";

const manager: Manager = {
  id: "mgr-test-scope",
  email: "principal@shalom-school.ac.il",
  name: "Principal Cohen",
  createdAt: new Date("2026-07-01T00:00:00.000Z"),
};

const membership: OrganizationMembership = {
  id: "mbs-test-scope",
  managerId: manager.id,
  organizationId: SESSION_SCHOOL,
  role: "manager",
  status: "active",
  createdAt: new Date("2026-07-01T00:00:00.000Z"),
};

async function sessionCookie() {
  const provider = new JwtSessionProvider();
  const { token } = await provider.createSession(manager, SESSION_SCHOOL, [
    membership,
  ]);

  return `shalomut_session=${token}`;
}

function injectedSchool(response: Response) {
  return (
    response.headers.get(
      "x-middleware-request-x-shalomut-manager-organization-id",
    ) || response.headers.get(MANAGER_ORGANIZATION_HEADER)
  );
}

test("a school chosen on the setup screen scopes the request and is remembered", async () => {
  const request = new NextRequest(
    "http://localhost:3000/setup?school=org-second-school",
    { headers: { cookie: await sessionCookie() } },
  );

  const response = await middleware(request);

  assert.strictEqual(injectedSchool(response), "org-second-school");
  assert.strictEqual(
    response.cookies.get(MANAGER_SCHOOL_COOKIE)?.value,
    "org-second-school",
  );
});

test("the remembered school scopes screens that carry no school in their URL", async () => {
  const request = new NextRequest("http://localhost:3000/dashboard", {
    headers: {
      cookie: `${await sessionCookie()}; ${MANAGER_SCHOOL_COOKIE}=org-second-school`,
    },
  });

  const response = await middleware(request);

  assert.strictEqual(injectedSchool(response), "org-second-school");
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
      cookie: `${await sessionCookie()}; ${MANAGER_SCHOOL_COOKIE}=org-second-school`,
    },
  });

  const response = await middleware(request);

  assert.strictEqual(injectedSchool(response), "org-second-school");
  assert.strictEqual(response.cookies.get(MANAGER_SCHOOL_COOKIE), undefined);
});

test("a respondent route is scoped to no school at all", async () => {
  const request = new NextRequest(
    "http://localhost:3000/answer/SHALOM-TEST1?school=org-second-school",
    {
      headers: {
        cookie: `${MANAGER_SCHOOL_COOKIE}=org-second-school`,
        [MANAGER_ORGANIZATION_HEADER]: "org-attacker-injected",
      },
    },
  );

  const response = await middleware(request);

  assert.strictEqual(injectedSchool(response), null);
});
