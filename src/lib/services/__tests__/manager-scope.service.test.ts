import assert from "node:assert";
import test from "node:test";
import { InMemoryOrganizationRepository } from "@/lib/repositories";
import {
  ManagerScopeRequiredError,
  ManagerScopeService,
} from "@/lib/services/manager-scope.service";
import type { Organization } from "@/lib/types/backend";

function school(id: string, name: string): Organization {
  return {
    id,
    name,
    city: "חיפה",
    schoolType: "יסודי",
    totalStaffCount: 30,
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
  };
}

const first = school("org-1", "בית ספר ראשון");
const second = school("org-2", "בית ספר שני");

test("a chosen school is what the request is read inside", async () => {
  const orgRepo = new InMemoryOrganizationRepository([first, second]);

  assert.strictEqual(
    await ManagerScopeService.resolveOrganizationId(orgRepo, second.id),
    second.id,
  );
});

test("one school needs no choosing", async () => {
  const orgRepo = new InMemoryOrganizationRepository([first]);

  assert.strictEqual(
    await ManagerScopeService.resolveOrganizationId(orgRepo),
    first.id,
  );
});

test("a school that no longer exists is not a choice, and one school is still read", async () => {
  const orgRepo = new InMemoryOrganizationRepository([first]);

  assert.strictEqual(
    await ManagerScopeService.resolveOrganizationId(orgRepo, "org-deleted"),
    first.id,
  );
});

test("a school that no longer exists leaves several schools asking to be chosen", async () => {
  const orgRepo = new InMemoryOrganizationRepository([first, second]);

  await assert.rejects(
    () => ManagerScopeService.resolveOrganizationId(orgRepo, "org-deleted"),
    ManagerScopeRequiredError,
  );
});

test("several schools and no choice is a question, not a school", async () => {
  const orgRepo = new InMemoryOrganizationRepository([first, second]);

  await assert.rejects(
    () => ManagerScopeService.resolveOrganizationId(orgRepo),
    ManagerScopeRequiredError,
  );
});

test("an empty system adopts the configured id for the school it is about to create", async () => {
  const orgRepo = new InMemoryOrganizationRepository();

  assert.strictEqual(
    await ManagerScopeService.resolveOrganizationId(orgRepo, "org-configured"),
    "org-configured",
  );
});

test("a round is never reached from another school", async () => {
  const orgRepo = new InMemoryOrganizationRepository([first, second]);
  const roundRepo = {
    findById: async (id: string) =>
      id === "round-1"
        ? ({ id, organizationId: first.id } as never)
        : null,
  } as never;

  assert.strictEqual(
    await ManagerScopeService.findRound("round-1", orgRepo, roundRepo, second.id),
    null,
  );
});

test("a school the session is not a member of is not a school it can be read inside", async () => {
  const orgRepo = new InMemoryOrganizationRepository([first, second]);

  assert.strictEqual(
    await ManagerScopeService.resolveOrganizationId(orgRepo, second.id, [
      first.id,
    ]),
    first.id,
  );
});

test("one membership needs no choosing, however many schools the system has", async () => {
  const orgRepo = new InMemoryOrganizationRepository([first, second]);

  assert.strictEqual(
    await ManagerScopeService.resolveOrganizationId(orgRepo, undefined, [
      second.id,
    ]),
    second.id,
  );
});

test("two memberships and no choice is a question, not a school", async () => {
  const orgRepo = new InMemoryOrganizationRepository([first, second]);

  await assert.rejects(
    () =>
      ManagerScopeService.resolveOrganizationId(orgRepo, undefined, [
        first.id,
        second.id,
      ]),
    ManagerScopeRequiredError,
  );
});

test("a session with no membership is read inside no school at all", async () => {
  const orgRepo = new InMemoryOrganizationRepository([first, second]);

  assert.strictEqual(
    await ManagerScopeService.resolveOrganizationId(orgRepo, first.id, []),
    null,
  );
});

test("an empty system adopts the id of the school the session is a member of", async () => {
  const orgRepo = new InMemoryOrganizationRepository();

  assert.strictEqual(
    await ManagerScopeService.resolveOrganizationId(orgRepo, "org-configured", [
      "org-configured",
    ]),
    "org-configured",
  );
});

test("an empty system does not adopt an id the session has no membership for", async () => {
  const orgRepo = new InMemoryOrganizationRepository();

  assert.strictEqual(
    await ManagerScopeService.resolveOrganizationId(orgRepo, "org-someone-else", [
      "org-configured",
    ]),
    "org-configured",
  );
});

test("a round is never reached from a school the session is not a member of", async () => {
  const orgRepo = new InMemoryOrganizationRepository([first, second]);
  const roundRepo = {
    findById: async (id: string) =>
      id === "round-2" ? ({ id, organizationId: second.id } as never) : null,
  } as never;

  assert.strictEqual(
    await ManagerScopeService.findRound(
      "round-2",
      orgRepo,
      roundRepo,
      second.id,
      [first.id],
    ),
    null,
  );
});
