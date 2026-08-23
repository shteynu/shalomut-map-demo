/**
 * "One school, one person" stops being something only the application believes.
 *
 * `inviteSchoolUser` and `setMembershipStatus` each read the school's
 * memberships, look for one that stands, and refuse if they find one. That is
 * check-then-write, and the 2026-08-21 audit named the consequence: two
 * requests that read before either writes both pass, and the school ends up
 * with two standing memberships and two answers to "who is this school's
 * person". The schema's own comment had already said only the database can
 * refuse it atomically.
 *
 * This file proves the refusal exists, that both callers report it as the
 * answer they already had a word for, and that it stops at exactly the rows it
 * should. It cannot prove the race — one process has no concurrency to lose —
 * and `__dbtests__/postgres-one-standing-membership.test.ts` runs two real
 * inserts at PostgreSQL to close that half.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { InMemoryOrganizationRepository } from "@/lib/repositories";
import type { Organization } from "@/lib/types/backend";
import {
  InMemoryManagerRepository,
  SchoolAlreadyHasSomebodyError,
  type IManagerRepository,
} from "../domain-contract";
import { ManagerAdministrationService } from "../manager-administration-service";
import type { OrganizationMembership } from "../types";

const SCHOOL: Organization = {
  id: "org-school",
  name: "בית ספר שלום",
  city: "חיפה",
  schoolType: "יסודי",
  totalStaffCount: 40,
  createdAt: new Date("2026-08-20T00:00:00.000Z"),
};

const OTHER_SCHOOL: Organization = { ...SCHOOL, id: "org-other", name: "בית ספר אחר" };

function repos() {
  return {
    managerRepo: new InMemoryManagerRepository(),
    orgRepo: new InMemoryOrganizationRepository([SCHOOL, OTHER_SCHOOL]),
  };
}

function membership(
  overrides: Partial<OrganizationMembership> & { id: string },
): OrganizationMembership {
  return {
    managerId: `mgr-${overrides.id}`,
    organizationId: SCHOOL.id,
    role: "manager",
    status: "invited",
    createdAt: new Date("2026-08-23T00:00:00.000Z"),
    ...overrides,
  };
}

test("the store itself refuses a second standing membership", async () => {
  // Written straight through the repository, past the read both services do.
  // That is the whole point: the read is not what refuses this.
  const { managerRepo } = repos();
  await managerRepo.saveMembership(membership({ id: "first" }));

  await assert.rejects(
    () => managerRepo.saveMembership(membership({ id: "second" })),
    SchoolAlreadyHasSomebodyError,
  );
});

test("a suspended row does not stand, and does not block the next person", async () => {
  // The negative control, and the product's own model: a school changes hands
  // by revoke-then-invite, so revoked rows accumulate and must not count.
  const { managerRepo } = repos();
  await managerRepo.saveMembership(
    membership({ id: "revoked", status: "suspended" }),
  );
  await managerRepo.saveMembership(
    membership({ id: "revoked-again", status: "suspended" }),
  );

  const next = await managerRepo.saveMembership(membership({ id: "current" }));
  assert.equal(next.status, "invited");
});

test("another school's person is not this school's second", async () => {
  const { managerRepo } = repos();
  await managerRepo.saveMembership(membership({ id: "here" }));

  const elsewhere = await managerRepo.saveMembership(
    membership({ id: "there", organizationId: OTHER_SCHOOL.id }),
  );
  assert.equal(elsewhere.organizationId, OTHER_SCHOOL.id);
});

test("an invitation being accepted is the same row, not a second one", async () => {
  // `invited` and `active` both stand, so a rule written carelessly would
  // refuse the one write that turns one into the other — which is what happens
  // every time an invited person signs in.
  const { managerRepo } = repos();
  const invited = await managerRepo.saveMembership(membership({ id: "accepts" }));

  const accepted = await managerRepo.saveMembership({
    ...invited,
    status: "active",
  });
  assert.equal(accepted.status, "active");
});

/**
 * A store that always refuses, to stand in for the race a single process cannot
 * have. What matters is what each caller does with the refusal, and that is the
 * same whether it came from a `Map`, from PostgreSQL, or from here.
 */
function alwaysRefusing(base: IManagerRepository): IManagerRepository {
  return {
    ...base,
    findById: (id) => base.findById(id),
    findByEmail: (email) => base.findByEmail(email),
    findMembershipsByManagerId: (id) => base.findMembershipsByManagerId(id),
    findMembershipsByOrganizationId: (id) =>
      base.findMembershipsByOrganizationId(id),
    findMembershipsByOrganizationIds: (ids) =>
      base.findMembershipsByOrganizationIds(ids),
    findAllManagers: () => base.findAllManagers(),
    saveManager: (manager) => base.saveManager(manager),
    countPlatformAdministrators: () => base.countPlatformAdministrators(),
    saveMembership: async () => {
      throw new SchoolAlreadyHasSomebodyError(SCHOOL.id);
    },
  };
}

test("an invitation that loses the race is refused, not thrown", async () => {
  const { managerRepo, orgRepo } = repos();

  const result = await ManagerAdministrationService.inviteSchoolUser(
    alwaysRefusing(managerRepo),
    orgRepo,
    { email: "principal@school.ac.il", organizationId: SCHOOL.id },
  );

  assert.equal(result.ok, false);
  if (result.ok) return;
  // The same reason the read gives, so the screen shows one message whichever
  // of the two decided it.
  assert.equal(result.reason, "SCHOOL_ALREADY_HAS_SOMEBODY");
});

test("a restore that loses the race is refused, not thrown", async () => {
  // The other way a school ends up with two: the read says there is room, and
  // an invitation issued in between takes it.
  const { managerRepo } = repos();
  const suspended = membership({ id: "coming-back", status: "suspended" });
  await managerRepo.saveMembership(suspended);

  const result = await ManagerAdministrationService.setMembershipStatus(
    alwaysRefusing(managerRepo),
    SCHOOL.id,
    suspended.id,
    "active",
  );

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.reason, "SCHOOL_ALREADY_HAS_SOMEBODY");
});

test("an ordinary invitation still succeeds", async () => {
  // Without this the two above would pass on a product that refused everyone.
  const { managerRepo, orgRepo } = repos();

  const result = await ManagerAdministrationService.inviteSchoolUser(
    managerRepo,
    orgRepo,
    { email: "principal@school.ac.il", organizationId: SCHOOL.id },
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value.membership.status, "invited");
});
