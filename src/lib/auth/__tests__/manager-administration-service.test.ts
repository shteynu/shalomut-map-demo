import assert from "node:assert/strict";
import test from "node:test";
import {
  InMemoryOrganizationRepository,
  InMemoryRoundRepository,
  InMemorySurveyRepository,
} from "@/lib/repositories";
import type { Organization } from "@/lib/types/backend";
import { InMemoryManagerRepository } from "../domain-contract";
import { ManagerAdministrationService } from "../manager-administration-service";
import { ManagerDirectoryService } from "../manager-directory-service";

const SCHOOL: Organization = {
  id: "org-school",
  name: "בית ספר שלום",
  city: "חיפה",
  schoolType: "יסודי",
  totalStaffCount: 40,
  createdAt: new Date("2026-08-20T00:00:00.000Z"),
};

function repos() {
  return {
    managerRepo: new InMemoryManagerRepository(),
    orgRepo: new InMemoryOrganizationRepository([SCHOOL]),
    roundRepo: new InMemoryRoundRepository(),
    surveyRepo: new InMemorySurveyRepository(),
  };
}

test("an invitation creates the person and an entitlement nobody has used yet", async () => {
  const { managerRepo, orgRepo } = repos();

  const result = await ManagerAdministrationService.inviteSchoolUser(
    managerRepo,
    orgRepo,
    { email: "  Principal@School.AC.il ", organizationId: SCHOOL.id },
  );

  assert.strictEqual(result.ok, true);
  if (!result.ok) return;
  // The address is the identity, so it is stored the way every lookup spells it.
  assert.strictEqual(result.value.manager.email, "principal@school.ac.il");
  assert.strictEqual(result.value.manager.isPlatformAdministrator, false);
  assert.strictEqual(result.value.membership.status, "invited");
  // A reader. This used to be `admin` — everything today's manager does inside
  // one school — and the owner decided otherwise on 2026-08-23 (ADR-042). This
  // is the only place a school membership is created, so the value here is what
  // decides whether phase 6's gate has anyone to refuse: with `admin` it had
  // nobody, and the whole restriction was unreachable.
  assert.strictEqual(result.value.membership.role, "manager");
});

test("an invited person signs in, and the invitation becomes the school", async () => {
  const { managerRepo, orgRepo } = repos();
  await ManagerAdministrationService.inviteSchoolUser(managerRepo, orgRepo, {
    email: "principal@school.ac.il",
    organizationId: SCHOOL.id,
  });

  const signIn = await ManagerDirectoryService.resolveSignIn(
    managerRepo,
    "principal@school.ac.il",
    {},
  );

  assert.strictEqual(signIn.ok, true);
  assert.strictEqual(
    signIn.ok ? signIn.activeOrganizationId : null,
    SCHOOL.id,
  );
});

test("a school has one user: a second invitation is refused while the first stands", async () => {
  const { managerRepo, orgRepo } = repos();
  await ManagerAdministrationService.inviteSchoolUser(managerRepo, orgRepo, {
    email: "first@school.ac.il",
    organizationId: SCHOOL.id,
  });

  const second = await ManagerAdministrationService.inviteSchoolUser(
    managerRepo,
    orgRepo,
    { email: "second@school.ac.il", organizationId: SCHOOL.id },
  );

  assert.deepStrictEqual(second, {
    ok: false,
    reason: "SCHOOL_ALREADY_HAS_SOMEBODY",
  });
});

test("replacing a school's person is revoke, then invite", async () => {
  const { managerRepo, orgRepo } = repos();
  const first = await ManagerAdministrationService.inviteSchoolUser(
    managerRepo,
    orgRepo,
    { email: "first@school.ac.il", organizationId: SCHOOL.id },
  );
  assert.ok(first.ok);

  const revoked = await ManagerAdministrationService.setMembershipStatus(
    managerRepo,
    SCHOOL.id,
    first.value.membership.id,
    "suspended",
  );
  assert.strictEqual(revoked.ok, true);

  const second = await ManagerAdministrationService.inviteSchoolUser(
    managerRepo,
    orgRepo,
    { email: "second@school.ac.il", organizationId: SCHOOL.id },
  );
  assert.strictEqual(second.ok, true);

  // And the person who was revoked cannot sign in, while the new one can.
  assert.deepStrictEqual(
    await ManagerDirectoryService.resolveSignIn(
      managerRepo,
      "first@school.ac.il",
      {},
    ),
    { ok: false, reason: "NO_ACTIVE_MEMBERSHIP" },
  );
  assert.strictEqual(
    (
      await ManagerDirectoryService.resolveSignIn(
        managerRepo,
        "second@school.ac.il",
        {},
      )
    ).ok,
    true,
  );
});

test("giving a revoked person their school back is refused while somebody else has it", async () => {
  const { managerRepo, orgRepo } = repos();
  const first = await ManagerAdministrationService.inviteSchoolUser(
    managerRepo,
    orgRepo,
    { email: "first@school.ac.il", organizationId: SCHOOL.id },
  );
  assert.ok(first.ok);
  await ManagerAdministrationService.setMembershipStatus(
    managerRepo,
    SCHOOL.id,
    first.value.membership.id,
    "suspended",
  );
  await ManagerAdministrationService.inviteSchoolUser(managerRepo, orgRepo, {
    email: "second@school.ac.il",
    organizationId: SCHOOL.id,
  });

  const restored = await ManagerAdministrationService.setMembershipStatus(
    managerRepo,
    SCHOOL.id,
    first.value.membership.id,
    "active",
  );

  assert.deepStrictEqual(restored, {
    ok: false,
    reason: "SCHOOL_ALREADY_HAS_SOMEBODY",
  });
});

test("a membership belonging to another school is not found by this one", async () => {
  const { managerRepo, orgRepo } = repos();
  const invited = await ManagerAdministrationService.inviteSchoolUser(
    managerRepo,
    orgRepo,
    { email: "principal@school.ac.il", organizationId: SCHOOL.id },
  );
  assert.ok(invited.ok);

  const result = await ManagerAdministrationService.setMembershipStatus(
    managerRepo,
    "org-somebody-elses",
    invited.value.membership.id,
    "suspended",
  );

  assert.deepStrictEqual(result, {
    ok: false,
    reason: "MEMBERSHIP_NOT_FOUND",
  });
});

test("an invitation into a school that does not exist is refused", async () => {
  const { managerRepo, orgRepo } = repos();

  assert.deepStrictEqual(
    await ManagerAdministrationService.inviteSchoolUser(managerRepo, orgRepo, {
      email: "principal@school.ac.il",
      organizationId: "org-imaginary",
    }),
    { ok: false, reason: "SCHOOL_NOT_FOUND" },
  );
});

test("something that is not an address is refused before anything is written", async () => {
  const { managerRepo, orgRepo } = repos();

  for (const email of ["", "  ", "principal", "principal@school", "a b@c.il"]) {
    const result = await ManagerAdministrationService.inviteSchoolUser(
      managerRepo,
      orgRepo,
      { email, organizationId: SCHOOL.id },
    );
    assert.deepStrictEqual(result, { ok: false, reason: "INVALID_EMAIL" }, email);
  }

  assert.deepStrictEqual(await managerRepo.findAllManagers(), []);
});

test("an administrator is invited without a school, and is one immediately", async () => {
  const { managerRepo } = repos();

  const result = await ManagerAdministrationService.inviteAdministrator(
    managerRepo,
    { email: "second@shalomut.example" },
  );

  assert.strictEqual(result.ok, true);
  if (!result.ok) return;
  assert.strictEqual(result.value.isPlatformAdministrator, true);
  assert.deepStrictEqual(
    await managerRepo.findMembershipsByManagerId(result.value.id),
    [],
  );
  // Nothing to accept: they sign in and the flag is already there.
  const signIn = await ManagerDirectoryService.resolveSignIn(
    managerRepo,
    "second@shalomut.example",
    {},
  );
  assert.strictEqual(signIn.ok, true);
  assert.strictEqual(signIn.ok ? signIn.activeOrganizationId : "x", null);
});

test("promoting an existing school user keeps their id, and refuses a second time", async () => {
  const { managerRepo, orgRepo } = repos();
  const invited = await ManagerAdministrationService.inviteSchoolUser(
    managerRepo,
    orgRepo,
    { email: "principal@school.ac.il", organizationId: SCHOOL.id },
  );
  assert.ok(invited.ok);

  const promoted = await ManagerAdministrationService.inviteAdministrator(
    managerRepo,
    { email: "principal@school.ac.il" },
  );
  assert.ok(promoted.ok);
  // The same person, not a second row — the membership they already have is
  // still theirs.
  assert.strictEqual(promoted.value.id, invited.value.manager.id);

  assert.deepStrictEqual(
    await ManagerAdministrationService.inviteAdministrator(managerRepo, {
      email: "principal@school.ac.il",
    }),
    { ok: false, reason: "ALREADY_AN_ADMINISTRATOR" },
  );
});

test("the overview names every school, its people, and the people with nowhere to go", async () => {
  const { managerRepo, orgRepo, roundRepo, surveyRepo } = repos();
  await ManagerAdministrationService.inviteAdministrator(managerRepo, {
    email: "platform@shalomut.example",
  });
  const invited = await ManagerAdministrationService.inviteSchoolUser(
    managerRepo,
    orgRepo,
    { email: "principal@school.ac.il", organizationId: SCHOOL.id },
  );
  assert.ok(invited.ok);

  const before = await ManagerAdministrationService.loadOverview(
    orgRepo,
    managerRepo,
    roundRepo,
    surveyRepo,
  );
  assert.strictEqual(before.schools.length, 1);
  assert.strictEqual(before.schools[0].people.length, 1);
  assert.strictEqual(before.administrators.length, 1);
  assert.deepStrictEqual(before.unattached, []);

  await ManagerAdministrationService.setMembershipStatus(
    managerRepo,
    SCHOOL.id,
    invited.value.membership.id,
    "suspended",
  );

  const after = await ManagerAdministrationService.loadOverview(
    orgRepo,
    managerRepo,
    roundRepo,
    surveyRepo,
  );
  // The revoked person is still listed under the school — the row is what says
  // who had it — and is also named as somebody who can no longer sign in.
  assert.strictEqual(after.schools[0].people[0].membership.status, "suspended");
  assert.deepStrictEqual(
    after.unattached.map((manager) => manager.email),
    ["principal@school.ac.il"],
  );
});
