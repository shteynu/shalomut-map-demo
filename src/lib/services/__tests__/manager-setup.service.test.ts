import assert from "node:assert";
import test from "node:test";
import {
  InMemoryOrganizationRepository,
  InMemoryRoundRepository,
} from "@/lib/repositories";
import { ManagerSetupService } from "@/lib/services/manager-setup.service";

function setupInput() {
  return {
    organization: {
      name: "בית ספר חדש",
      city: "ירושלים",
      schoolType: "יסודי",
      totalStaffCount: 28,
    },
    round: {
      title: "סבב תשפ״ז",
      privacyThreshold: 10,
      startDate: new Date("2026-09-01T00:00:00.000Z"),
      backgroundContext: {
        notes: "",
        audience: "all-staff",
        sicknessDaysThisQuarter: 0,
        newStaffMembers: 0,
        studentCount: 350,
        socioEconomicIndex: 5,
        classesPerGrade: { א: 2 },
      },
    },
  };
}

test("ManagerSetupService creates an organization and an empty draft survey round", async () => {
  const orgRepo = new InMemoryOrganizationRepository();
  const roundRepo = new InMemoryRoundRepository();

  const result = await ManagerSetupService.save(
    setupInput(),
    orgRepo,
    roundRepo,
  );

  assert.strictEqual((await orgRepo.findAll()).length, 1);
  assert.strictEqual(result.round.organizationId, result.organization.id);
  // Setup no longer pre-fills the canonical template: the manager builds the
  // questionnaire in the builder, and only then can the round go live.
  assert.strictEqual(result.round.surveyDefinition?.questions.length, 0);
  assert.strictEqual(result.round.status, "draft");
});

test("ManagerSetupService derives the questionnaire audience from the setup screen", async () => {
  const orgRepo = new InMemoryOrganizationRepository();
  const roundRepo = new InMemoryRoundRepository();

  const created = await ManagerSetupService.save(
    {
      ...setupInput(),
      round: {
        ...setupInput().round,
        backgroundContext: {
          ...setupInput().round.backgroundContext,
          audience: "teachers",
        },
      },
    },
    orgRepo,
    roundRepo,
  );

  // Setup owns the audience; the questionnaire copy mirrors it so the two
  // screens can never show a different target group.
  assert.strictEqual(created.round.surveyDefinition?.audience, "צוות הוראה בלבד");

  const updated = await ManagerSetupService.save(
    {
      organization: {
        ...setupInput().organization,
        id: created.organization.id,
      },
      round: {
        ...setupInput().round,
        id: created.round.id,
        backgroundContext: {
          ...setupInput().round.backgroundContext,
          audience: "administration",
        },
      },
    },
    orgRepo,
    roundRepo,
  );

  assert.strictEqual(updated.round.surveyDefinition?.audience, "צוות מינהלה");
});

test("ManagerSetupService updates the existing records without creating duplicates", async () => {
  const orgRepo = new InMemoryOrganizationRepository();
  const roundRepo = new InMemoryRoundRepository();
  const created = await ManagerSetupService.save(
    setupInput(),
    orgRepo,
    roundRepo,
  );

  const updated = await ManagerSetupService.save(
    {
      organization: {
        ...setupInput().organization,
        id: created.organization.id,
        totalStaffCount: 32,
      },
      round: {
        ...setupInput().round,
        id: created.round.id,
        privacyThreshold: 12,
      },
    },
    orgRepo,
    roundRepo,
  );

  assert.strictEqual((await orgRepo.findAll()).length, 1);
  assert.strictEqual(
    (await roundRepo.findByOrganizationId(created.organization.id)).length,
    1,
  );
  assert.strictEqual(updated.organization.totalStaffCount, 32);
  assert.strictEqual(updated.round.privacyThreshold, 12);
  assert.strictEqual(updated.round.surveyDefinition?.minimumResponses, 12);
});

test("a saved round carries the moment it reached the database", async () => {
  const orgRepo = new InMemoryOrganizationRepository();
  const roundRepo = new InMemoryRoundRepository();
  const created = await ManagerSetupService.save(
    setupInput(),
    orgRepo,
    roundRepo,
  );

  assert.ok(created.round.updatedAt instanceof Date);

  const updated = await ManagerSetupService.save(
    {
      organization: { ...setupInput().organization, id: created.organization.id },
      round: { ...setupInput().round, id: created.round.id, privacyThreshold: 14 },
    },
    orgRepo,
    roundRepo,
  );

  // The setup screen reports this value as its save time, so a second save has
  // to move it; a stale one would tell the manager their edit was already
  // stored.
  assert.ok(updated.round.updatedAt instanceof Date);
  assert.ok(
    updated.round.updatedAt.getTime() >= created.round.updatedAt.getTime(),
  );

  // And it is what a reload reads, not something the save response invented.
  const reloaded = await roundRepo.findById(created.round.id);
  assert.strictEqual(
    reloaded?.updatedAt?.getTime(),
    updated.round.updatedAt.getTime(),
  );
});
