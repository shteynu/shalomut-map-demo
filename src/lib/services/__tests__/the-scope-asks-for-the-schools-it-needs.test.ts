/**
 * What the scope resolver asks the database, and how the question grows.
 *
 * Every manager request passes through `resolveOrganizationId` — it is what
 * decides which school the request is read inside — and it used to answer by
 * reading the organizations table and discarding all but the session's own
 * schools. A manager of one school paid for every school in the system, on
 * every screen and every API call, and the bill grew with each school onboarded
 * while nothing about that manager changed.
 *
 * So this test counts calls and pins their arguments rather than measuring
 * time. What the resolver decides is `manager-scope.service.test.ts`; that it
 * decides it while asking a bounded question is here.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  InMemoryOrganizationRepository,
  InMemoryRoundRepository,
} from "@/lib/repositories";
import type { Organization } from "@/lib/types/backend";
import { ManagerScopeService } from "../manager-scope.service";

/** Every repository call the resolver makes, in order, with its argument. */
let calls: string[] = [];

class CountingOrganizationRepository extends InMemoryOrganizationRepository {
  async findAll() {
    calls.push("findAll");
    return super.findAll();
  }

  async findById(id: string) {
    calls.push(`findById(${id})`);
    return super.findById(id);
  }

  async findByIds(ids: readonly string[]) {
    calls.push(`findByIds(${ids.join(",")})`);
    return super.findByIds(ids);
  }

  async listIds(limit: number) {
    calls.push(`listIds(${limit})`);
    return super.listIds(limit);
  }
}

function school(index: number): Organization {
  return {
    id: `org-${index}`,
    name: `בית ספר ${index}`,
    city: "חיפה",
    schoolType: "יסודי",
    totalStaffCount: 40,
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
  };
}

function schools(count: number): Organization[] {
  return Array.from({ length: count }, (_, index) => school(index));
}

test("a session asks for its own schools and not for the table", async () => {
  calls = [];
  const orgRepo = new CountingOrganizationRepository(schools(500));

  const resolved = await ManagerScopeService.resolveOrganizationId(
    orgRepo,
    undefined,
    ["org-7"],
  );

  assert.equal(resolved, "org-7");
  assert.deepEqual(calls, ["findByIds(org-7)"]);
});

test("a remembered school is confirmed against the memberships alone", async () => {
  calls = [];
  const orgRepo = new CountingOrganizationRepository(schools(500));

  const resolved = await ManagerScopeService.resolveOrganizationId(
    orgRepo,
    "org-3",
    ["org-3", "org-9"],
  );

  assert.equal(resolved, "org-3");
  assert.deepEqual(calls, ["findByIds(org-3,org-9)"]);
});

test("the question does not grow with the number of schools", async () => {
  // The same session, the same answer, against a system fifty times larger.
  // Reading the table would have shown here as a bigger result and nothing
  // else, which is exactly why the old cost was invisible.
  const results: string[][] = [];
  for (const size of [10, 500]) {
    calls = [];
    const orgRepo = new CountingOrganizationRepository(schools(size));
    const resolved = await ManagerScopeService.resolveOrganizationId(
      orgRepo,
      undefined,
      ["org-4"],
    );
    assert.equal(resolved, "org-4");
    results.push(calls.slice());
  }

  assert.deepEqual(results[0], results[1]);
});

test("a platform administrator lands on a school without reading the table", async () => {
  // No memberships is every school in the system, and it is still not a reason
  // to read them: the decision needs one id to land on and a second only to
  // know there was a choice.
  calls = [];
  const orgRepo = new CountingOrganizationRepository(schools(500));

  await assert.rejects(
    () => ManagerScopeService.resolveOrganizationId(orgRepo),
    /scope is required/i,
  );
  assert.deepEqual(calls, ["listIds(2)"]);
});

test("an administrator's remembered school costs one lookup", async () => {
  calls = [];
  const orgRepo = new CountingOrganizationRepository(schools(500));

  const resolved = await ManagerScopeService.resolveOrganizationId(
    orgRepo,
    "org-11",
  );

  assert.equal(resolved, "org-11");
  assert.deepEqual(calls, ["findById(org-11)"]);
});

test("a round is found without the resolver reading the table", async () => {
  // `findRound` is the chokepoint the round routes go through, so the saving
  // has to survive the call it is actually made from.
  calls = [];
  const orgRepo = new CountingOrganizationRepository(schools(500));
  const roundRepo = new InMemoryRoundRepository();

  const round = await ManagerScopeService.findRound(
    "round-1",
    orgRepo,
    roundRepo,
    undefined,
    ["org-2"],
  );

  assert.equal(round, null);
  assert.deepEqual(calls, ["findByIds(org-2)"]);
});

test("the table is never read on any path this resolver takes", async () => {
  // A guard rather than a case: whichever branch is taken, `findAll` is not it.
  const orgRepo = new CountingOrganizationRepository(schools(3));
  calls = [];

  await ManagerScopeService.resolveOrganizationId(orgRepo, "org-0", ["org-0"]);
  await ManagerScopeService.resolveOrganizationId(orgRepo, undefined, ["org-1"]);
  await ManagerScopeService.resolveOrganizationId(orgRepo, "org-2");
  await ManagerScopeService.resolveOrganizationId(orgRepo, "unknown", [
    "gone-1",
  ]);

  assert.equal(
    calls.includes("findAll"),
    false,
    `the resolver read the table: ${calls.join(", ")}`,
  );
});
