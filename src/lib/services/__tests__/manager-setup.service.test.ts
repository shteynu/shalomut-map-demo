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

test("ManagerSetupService creates an organization and a canonical survey round", async () => {
  const orgRepo = new InMemoryOrganizationRepository();
  const roundRepo = new InMemoryRoundRepository();

  const result = await ManagerSetupService.save(
    setupInput(),
    orgRepo,
    roundRepo,
  );

  assert.strictEqual((await orgRepo.findAll()).length, 1);
  assert.strictEqual(result.round.organizationId, result.organization.id);
  assert.strictEqual(result.round.surveyDefinition?.questions.length, 24);
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
