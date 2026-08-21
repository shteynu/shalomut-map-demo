import assert from "node:assert/strict";
import test from "node:test";
import { InMemoryManagerRepository } from "../domain-contract";
import { ManagerDirectoryService } from "../manager-directory-service";
import type { Manager, OrganizationMembership } from "../types";

const ADMIN_EMAIL = "platform@shalomut.edu.il";

function manager(overrides: Partial<Manager> = {}): Manager {
  return {
    id: "mgr-cohen",
    email: "principal@school.ac.il",
    name: "Principal Cohen",
    isPlatformAdministrator: false,
    createdAt: new Date("2026-08-20T00:00:00.000Z"),
    ...overrides,
  };
}

function membership(
  overrides: Partial<OrganizationMembership> = {},
): OrganizationMembership {
  return {
    id: "mbs-1",
    managerId: "mgr-cohen",
    organizationId: "org-school",
    role: "manager",
    status: "active",
    createdAt: new Date("2026-08-20T00:00:00.000Z"),
    ...overrides,
  };
}

test("an address with no row is refused however it authenticated", async () => {
  const repo = new InMemoryManagerRepository();

  const result = await ManagerDirectoryService.resolveSignIn(
    repo,
    "stranger@school.ac.il",
    { MANAGER_ADMIN_EMAIL: ADMIN_EMAIL },
  );

  assert.deepStrictEqual(result, { ok: false, reason: "USER_NOT_FOUND" });
});

test("a school user signs in to their own school", async () => {
  const repo = new InMemoryManagerRepository([manager()], [membership()]);

  const result = await ManagerDirectoryService.resolveSignIn(
    repo,
    "Principal@School.ac.il",
    {},
  );

  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.ok && result.activeOrganizationId, "org-school");
});

test("a suspended membership is not a school to land in", async () => {
  const repo = new InMemoryManagerRepository(
    [manager()],
    [membership({ status: "suspended" })],
  );

  const result = await ManagerDirectoryService.resolveSignIn(
    repo,
    "principal@school.ac.il",
    {},
  );

  assert.deepStrictEqual(result, { ok: false, reason: "NO_ACTIVE_MEMBERSHIP" });
});

test("arriving is how an invitation is accepted", async () => {
  const repo = new InMemoryManagerRepository(
    [manager()],
    [membership({ status: "invited" })],
  );

  const result = await ManagerDirectoryService.resolveSignIn(
    repo,
    "principal@school.ac.il",
    {},
  );

  assert.strictEqual(result.ok, true);
  assert.strictEqual(
    result.ok ? result.activeOrganizationId : null,
    "org-school",
  );

  // And it stays accepted: the row was written, not merely treated as active
  // for one sign-in.
  const stored = await repo.findMembershipsByManagerId("mgr-cohen");
  assert.strictEqual(stored[0].status, "active");
});


test("a platform administrator signs in without belonging to a school", async () => {
  const repo = new InMemoryManagerRepository([
    manager({
      id: "mgr-platform",
      email: ADMIN_EMAIL,
      isPlatformAdministrator: true,
    }),
  ]);

  const result = await ManagerDirectoryService.resolveSignIn(repo, ADMIN_EMAIL, {});

  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.ok && result.activeOrganizationId, null);
});

test("the first administrator is created the first time the configured address signs in", async () => {
  const repo = new InMemoryManagerRepository();

  const first = await ManagerDirectoryService.resolveSignIn(repo, ADMIN_EMAIL, {
    MANAGER_ADMIN_EMAIL: ADMIN_EMAIL,
  });
  assert.strictEqual(first.ok, true);
  assert.strictEqual(first.ok && first.manager.isPlatformAdministrator, true);
  assert.strictEqual(await repo.countPlatformAdministrators(), 1);

  const second = await ManagerDirectoryService.resolveSignIn(repo, ADMIN_EMAIL, {
    MANAGER_ADMIN_EMAIL: ADMIN_EMAIL,
  });
  assert.strictEqual(second.ok, true);
  assert.strictEqual(
    second.ok && first.ok && second.manager.id,
    first.ok ? first.manager.id : "",
  );
  assert.strictEqual(await repo.countPlatformAdministrators(), 1);
});

test("the bootstrap creates nobody but the configured address", async () => {
  const repo = new InMemoryManagerRepository();

  const result = await ManagerDirectoryService.resolveSignIn(
    repo,
    "someone-else@shalomut.edu.il",
    { MANAGER_ADMIN_EMAIL: ADMIN_EMAIL },
  );

  assert.deepStrictEqual(result, { ok: false, reason: "USER_NOT_FOUND" });
  assert.strictEqual(await repo.countPlatformAdministrators(), 0);
});

test("the bootstrap stops existing once an administrator does", async () => {
  const repo = new InMemoryManagerRepository([
    manager({
      id: "mgr-platform",
      email: "first@shalomut.edu.il",
      isPlatformAdministrator: true,
    }),
  ]);

  // The variable now names somebody else — a rotated operator address, or a
  // typo. It must not mint a second administrator behind the first one's back.
  const result = await ManagerDirectoryService.resolveSignIn(repo, ADMIN_EMAIL, {
    MANAGER_ADMIN_EMAIL: ADMIN_EMAIL,
  });

  assert.deepStrictEqual(result, { ok: false, reason: "USER_NOT_FOUND" });
  assert.strictEqual(await repo.countPlatformAdministrators(), 1);
});

test("with no configured address there is no bootstrap at all", async () => {
  const repo = new InMemoryManagerRepository();

  const result = await ManagerDirectoryService.resolveSignIn(repo, ADMIN_EMAIL, {});

  assert.deepStrictEqual(result, { ok: false, reason: "USER_NOT_FOUND" });
  assert.strictEqual(await repo.countPlatformAdministrators(), 0);
});
