import assert from "node:assert";
import test from "node:test";
import {
  InMemoryOrganizationRepository,
  InMemoryRoundRepository,
  InMemorySurveyRepository,
} from "@/lib/repositories";
import {
  ManagerContextService,
  selectActiveRound,
} from "@/lib/services/manager-context.service";
import type {
  Organization,
  SurveyResponseRecord,
  SurveyRound,
} from "@/lib/types/backend";

const organization: Organization = {
  id: "org-1",
  name: "בית ספר בדיקה",
  city: "חיפה",
  schoolType: "יסודי",
  totalStaffCount: 30,
  createdAt: new Date("2026-07-01T00:00:00.000Z"),
};

const otherOrganization: Organization = {
  id: "org-2",
  name: "בית ספר אחר",
  city: "ירושלים",
  schoolType: "תיכון",
  totalStaffCount: 45,
  createdAt: new Date("2026-07-20T00:00:00.000Z"),
};

function round(
  id: string,
  status: SurveyRound["status"],
  createdAt: string,
  organizationId = organization.id,
): SurveyRound {
  return {
    id,
    organizationId,
    title: id,
    status,
    shareCode: `SHALOM-${id.toUpperCase()}`,
    privacyThreshold: 10,
    startDate: new Date(createdAt),
    createdAt: new Date(createdAt),
  };
}

test("ManagerContextService returns organization onboarding for empty persistence", async () => {
  const context = await ManagerContextService.load(
    new InMemoryOrganizationRepository(),
    new InMemoryRoundRepository(),
    new InMemorySurveyRepository(),
  );

  assert.deepStrictEqual(context, {
    state: "needs-organization",
    organization: null,
    selectedRound: null,
    responseCount: 0,
    analytics: null,
  });
});

test("ManagerContextService returns round onboarding when the school has no rounds", async () => {
  const context = await ManagerContextService.load(
    new InMemoryOrganizationRepository([organization]),
    new InMemoryRoundRepository(),
    new InMemorySurveyRepository(),
  );

  assert.strictEqual(context.state, "needs-round");
  assert.strictEqual(context.organization?.id, organization.id);
  assert.strictEqual(context.selectedRound, null);
  assert.strictEqual(context.responseCount, 0);
  assert.strictEqual(context.analytics, null);
});

test("ManagerContextService selects the active round and returns its aggregate response count", async () => {
  const activeRound = round("active", "active", "2026-07-01T00:00:00.000Z");
  const newerDraft = round("draft", "draft", "2026-07-20T00:00:00.000Z");
  const response: SurveyResponseRecord = {
    id: "response-1",
    roundId: activeRound.id,
    answers: [],
    submittedAt: new Date("2026-07-21T00:00:00.000Z"),
  };

  const context = await ManagerContextService.load(
    new InMemoryOrganizationRepository([organization]),
    new InMemoryRoundRepository([newerDraft, activeRound]),
    new InMemorySurveyRepository([response]),
  );

  assert.strictEqual(context.state, "round-ready");
  assert.strictEqual(context.selectedRound?.id, activeRound.id);
  assert.strictEqual(context.responseCount, 1);
  assert.strictEqual(context.analytics?.isLocked, true);
});

test("selectActiveRound uses the newest round within the same status", () => {
  const older = round("older", "closed", "2026-06-01T00:00:00.000Z");
  const newer = round("newer", "closed", "2026-07-01T00:00:00.000Z");

  assert.strictEqual(selectActiveRound([older, newer])?.id, newer.id);
});

test("ManagerContextService uses the explicitly scoped organization instead of the newest school", async () => {
  const scopedRound = round(
    "scoped-round",
    "active",
    "2026-07-02T00:00:00.000Z",
    organization.id,
  );
  const otherRound = round(
    "other-round",
    "active",
    "2026-07-21T00:00:00.000Z",
    otherOrganization.id,
  );

  const context = await ManagerContextService.load(
    new InMemoryOrganizationRepository([organization, otherOrganization]),
    new InMemoryRoundRepository([scopedRound, otherRound]),
    new InMemorySurveyRepository(),
    organization.id,
  );

  assert.strictEqual(context.organization?.id, organization.id);
  assert.strictEqual(context.selectedRound?.id, scopedRound.id);
});

test("ManagerContextService fails closed when multiple schools exist without a scope", async () => {
  const context = await ManagerContextService.load(
    new InMemoryOrganizationRepository([organization, otherOrganization]),
    new InMemoryRoundRepository(),
    new InMemorySurveyRepository(),
  );

  assert.strictEqual(context.state, "scope-required");
  assert.strictEqual(context.organization, null);
  assert.strictEqual(context.selectedRound, null);
  assert.strictEqual(context.analytics, null);
});
