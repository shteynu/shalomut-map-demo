import assert from "node:assert";
import test from "node:test";
import {
  InMemoryOrganizationRepository,
  InMemoryRoundRepository,
  InMemorySurveyRepository,
} from "@/lib/repositories";
import {
  ManagerContextService,
  isSelectedRoundSuperseded,
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
    rounds: [],
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

test("a requested round is what the context selects, not the active one", async () => {
  const activeRound = round("active", "active", "2026-07-20T00:00:00.000Z");
  const closedRound = round("closed", "closed", "2026-03-01T00:00:00.000Z");

  const context = await ManagerContextService.load(
    new InMemoryOrganizationRepository([organization]),
    new InMemoryRoundRepository([activeRound, closedRound]),
    new InMemorySurveyRepository(),
    undefined,
    closedRound.id,
  );

  assert.strictEqual(context.state, "round-ready");
  assert.strictEqual(context.selectedRound?.id, closedRound.id);
  assert.strictEqual(context.analytics?.roundId, closedRound.id);
});

test("the context offers the school's rounds in reading order, active first", async () => {
  const activeRound = round("active", "active", "2026-03-01T00:00:00.000Z");
  const newerClosed = round("closed-new", "closed", "2026-07-01T00:00:00.000Z");
  const olderClosed = round("closed-old", "closed", "2026-01-01T00:00:00.000Z");

  const context = await ManagerContextService.load(
    new InMemoryOrganizationRepository([organization]),
    new InMemoryRoundRepository([olderClosed, newerClosed, activeRound]),
    new InMemorySurveyRepository(),
  );

  assert.deepStrictEqual(
    context.rounds.map((entry) => entry.id),
    [activeRound.id, newerClosed.id, olderClosed.id],
  );
  assert.strictEqual(context.selectedRound?.id, context.rounds[0].id);
});

test("an unknown round is reported instead of falling back to the active one", async () => {
  const activeRound = round("active", "active", "2026-07-20T00:00:00.000Z");

  const context = await ManagerContextService.load(
    new InMemoryOrganizationRepository([organization]),
    new InMemoryRoundRepository([activeRound]),
    new InMemorySurveyRepository(),
    undefined,
    "round-that-does-not-exist",
  );

  assert.strictEqual(context.state, "round-not-found");
  assert.strictEqual(context.selectedRound, null);
  assert.strictEqual(context.analytics, null);
  assert.strictEqual(context.responseCount, 0);
});

test("a round belonging to another school is unknown, not readable", async () => {
  const ownRound = round("own", "active", "2026-07-20T00:00:00.000Z");
  const foreignRound = round(
    "foreign",
    "active",
    "2026-07-20T00:00:00.000Z",
    otherOrganization.id,
  );

  const context = await ManagerContextService.load(
    new InMemoryOrganizationRepository([organization]),
    new InMemoryRoundRepository([ownRound, foreignRound]),
    new InMemorySurveyRepository(),
    organization.id,
    foreignRound.id,
  );

  assert.strictEqual(context.state, "round-not-found");
  assert.strictEqual(context.selectedRound, null);
  assert.deepStrictEqual(
    context.rounds.map((entry) => entry.id),
    [ownRound.id],
  );
});

function response(id: string, roundId: string): SurveyResponseRecord {
  return {
    id,
    roundId,
    answers: [],
    submittedAt: new Date("2026-07-21T00:00:00.000Z"),
  };
}

test("the numbers are the selected round's, not those of the round beside it", async () => {
  const activeRound = round("active", "active", "2026-07-20T00:00:00.000Z");
  const earlierRound = round("earlier", "closed", "2026-03-01T00:00:00.000Z");

  const context = await ManagerContextService.load(
    new InMemoryOrganizationRepository([organization]),
    new InMemoryRoundRepository([activeRound, earlierRound]),
    new InMemorySurveyRepository([
      response("response-1", activeRound.id),
      response("response-2", activeRound.id),
      response("response-3", earlierRound.id),
    ]),
    organization.id,
    earlierRound.id,
  );

  assert.strictEqual(context.selectedRound?.id, earlierRound.id);
  assert.strictEqual(context.responseCount, 1);
  assert.strictEqual(context.analytics?.roundId, earlierRound.id);
  assert.strictEqual(context.analytics?.totalResponses, 1);
});

test("another school's answers are not in this school's numbers", async () => {
  const ownRound = round("own", "active", "2026-07-20T00:00:00.000Z");
  const foreignRound = round(
    "foreign",
    "active",
    "2026-07-20T00:00:00.000Z",
    otherOrganization.id,
  );

  const context = await ManagerContextService.load(
    new InMemoryOrganizationRepository([organization, otherOrganization]),
    new InMemoryRoundRepository([ownRound, foreignRound]),
    new InMemorySurveyRepository([
      response("response-1", foreignRound.id),
      response("response-2", foreignRound.id),
    ]),
    organization.id,
  );

  assert.strictEqual(context.selectedRound?.id, ownRound.id);
  assert.strictEqual(context.responseCount, 0);
  assert.strictEqual(context.analytics?.roundId, ownRound.id);
  assert.strictEqual(context.analytics?.totalResponses, 0);
});

/**
 * A superseded round is one the school has moved past. The screen says so and
 * takes away the controls that would rewrite what the round measured, so the
 * question of which rounds are superseded is the question of which rounds a
 * manager can still work on.
 */
async function contextFor(rounds: SurveyRound[], requestedRoundId?: string) {
  return ManagerContextService.load(
    new InMemoryOrganizationRepository([organization]),
    new InMemoryRoundRepository(rounds),
    new InMemorySurveyRepository(),
    organization.id,
    requestedRoundId,
  );
}

test("a draft the manager just opened is not a round the school has moved past", async () => {
  // The bug this test exists for: opening a round while another one is still
  // collecting creates a draft, drafts sort behind the active round, and the
  // screen read that position as "superseded". The manager was told the school
  // had moved past a round they had opened a minute earlier, and lost the
  // controls for preparing it.
  const active = round("active", "active", "2026-07-01T00:00:00.000Z");
  const draft = round("draft", "draft", "2026-07-20T00:00:00.000Z");

  const context = await contextFor([active, draft], draft.id);

  assert.strictEqual(context.selectedRound?.id, draft.id);
  assert.notStrictEqual(context.rounds[0]?.id, draft.id);
  assert.strictEqual(isSelectedRoundSuperseded(context), false);
});

test("the round a school moved past is superseded", async () => {
  const active = round("active", "active", "2026-07-20T00:00:00.000Z");
  const previous = round("previous", "closed", "2026-07-01T00:00:00.000Z");

  const context = await contextFor([active, previous], previous.id);

  assert.strictEqual(isSelectedRoundSuperseded(context), true);
});

test("an archived round is superseded too", async () => {
  const active = round("active", "active", "2026-07-20T00:00:00.000Z");
  const filed = round("filed", "archived", "2026-07-01T00:00:00.000Z");

  assert.strictEqual(
    isSelectedRoundSuperseded(await contextFor([active, filed], filed.id)),
    true,
  );
});

test("the round the school is working on is never superseded", async () => {
  const active = round("active", "active", "2026-07-20T00:00:00.000Z");
  const previous = round("previous", "closed", "2026-07-01T00:00:00.000Z");

  assert.strictEqual(
    isSelectedRoundSuperseded(await contextFor([active, previous], active.id)),
    false,
  );
});

test("a closed round is not superseded while it is the newest one", async () => {
  // A school that closed its round and has not opened the next one is still
  // reading that round, and closing then refreshing the analysis is how a round
  // ends.
  const onlyRound = round("only", "closed", "2026-07-20T00:00:00.000Z");

  assert.strictEqual(
    isSelectedRoundSuperseded(await contextFor([onlyRound], onlyRound.id)),
    false,
  );
});

test("a school with no round has nothing to supersede", async () => {
  assert.strictEqual(isSelectedRoundSuperseded(await contextFor([])), false);
});
