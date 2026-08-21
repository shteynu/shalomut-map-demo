import assert from "node:assert/strict";
import test from "node:test";
import {
  InMemoryOrganizationRepository,
  InMemoryRoundRepository,
  InMemorySurveyRepository,
} from "@/lib/repositories";
import { MINIMUM_PRIVACY_THRESHOLD } from "@/lib/survey-definition";
import type {
  Organization,
  RoundStatus,
  SurveyResponseRecord,
  SurveyRound,
} from "@/lib/types/backend";
import { InMemoryManagerRepository } from "../domain-contract";
import { ManagerAdministrationService } from "../manager-administration-service";

const NORTH: Organization = {
  id: "org-north",
  name: "בית ספר צפון",
  city: "חיפה",
  schoolType: "יסודי",
  totalStaffCount: 40,
  createdAt: new Date("2026-08-01T00:00:00.000Z"),
};

const SOUTH: Organization = {
  id: "org-south",
  name: "בית ספר דרום",
  city: "באר שבע",
  schoolType: "על-יסודי",
  totalStaffCount: 60,
  createdAt: new Date("2026-08-02T00:00:00.000Z"),
};

function round(
  id: string,
  organizationId: string,
  status: RoundStatus,
  createdAt: string,
  privacyThreshold = MINIMUM_PRIVACY_THRESHOLD,
): SurveyRound {
  return {
    id,
    organizationId,
    title: `סבב ${id}`,
    status,
    shareCode: `CODE-${id}`,
    privacyThreshold,
    startDate: new Date(createdAt),
    createdAt: new Date(createdAt),
  };
}

function responses(roundId: string, count: number): SurveyResponseRecord[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `${roundId}-response-${index}`,
    roundId,
    answers: [],
    submittedAt: new Date("2026-08-10T00:00:00.000Z"),
  }));
}

function overview(
  organizations: Organization[],
  rounds: SurveyRound[],
  responseRecords: SurveyResponseRecord[] = [],
) {
  return ManagerAdministrationService.loadOverview(
    new InMemoryOrganizationRepository(organizations),
    new InMemoryManagerRepository(),
    new InMemoryRoundRepository(rounds),
    new InMemorySurveyRepository(responseRecords),
  );
}

test("a school that has never opened a round says so rather than reading as empty", async () => {
  const result = await overview([NORTH], []);

  assert.strictEqual(result.schools.length, 1);
  assert.strictEqual(result.schools[0].roundCount, 0);
  assert.strictEqual(result.schools[0].currentRound, null);
});

test("the current round is the open one, whatever else the school has run", async () => {
  const result = await overview(
    [NORTH],
    [
      round("r-old", NORTH.id, "closed", "2026-08-03T00:00:00.000Z"),
      round("r-open", NORTH.id, "active", "2026-08-04T00:00:00.000Z"),
      // Newer than the open one, and still not the answer: a school runs one
      // round at a time, and the one taking answers is what it is about.
      round("r-draft", NORTH.id, "draft", "2026-08-05T00:00:00.000Z"),
    ],
  );

  assert.strictEqual(result.schools[0].roundCount, 3);
  assert.strictEqual(result.schools[0].currentRound?.id, "r-open");
  assert.strictEqual(result.schools[0].currentRound?.status, "active");
});

test("with nothing open, the most recent round is what the school last did", async () => {
  const result = await overview(
    [NORTH],
    [
      round("r-first", NORTH.id, "closed", "2026-08-03T00:00:00.000Z"),
      round("r-last", NORTH.id, "closed", "2026-08-06T00:00:00.000Z"),
    ],
  );

  assert.strictEqual(result.schools[0].currentRound?.id, "r-last");
});

test("a school whose only round is archived has run one, not none", async () => {
  // Archiving takes a round out of the school's own list and out of nothing
  // else. Treating it as no round would tell an administrator the school never
  // started.
  const result = await overview(
    [NORTH],
    [round("r-archived", NORTH.id, "archived", "2026-08-03T00:00:00.000Z")],
  );

  assert.strictEqual(result.schools[0].roundCount, 1);
  assert.strictEqual(result.schools[0].currentRound?.id, "r-archived");
});

test("the count of answers is reported against the threshold that would unlock them", async () => {
  const open = round("r-open", NORTH.id, "active", "2026-08-04T00:00:00.000Z");
  const result = await overview([NORTH], [open], responses(open.id, 4));

  const current = result.schools[0].currentRound;
  assert.strictEqual(current?.responseCount, 4);
  assert.strictEqual(current?.privacyThreshold, MINIMUM_PRIVACY_THRESHOLD);
  assert.strictEqual(current?.isUnlocked, false);
});

test("a school's own raised threshold is the one reported, not the platform minimum", async () => {
  const open = round(
    "r-open",
    NORTH.id,
    "active",
    "2026-08-04T00:00:00.000Z",
    25,
  );
  const result = await overview([NORTH], [open], responses(open.id, 12));

  const current = result.schools[0].currentRound;
  // Twelve answers is above the platform minimum of ten and below this school's
  // own choice of twenty-five. The school's choice wins: a manager may raise the
  // threshold and never lower it, and the administrator's screen must not report
  // a round as readable that the school itself has locked.
  assert.strictEqual(current?.privacyThreshold, 25);
  assert.strictEqual(current?.isUnlocked, false);
});

test("reaching the threshold is what unlocks it, and the boundary is inclusive", async () => {
  const open = round("r-open", NORTH.id, "active", "2026-08-04T00:00:00.000Z");
  const result = await overview(
    [NORTH],
    [open],
    responses(open.id, MINIMUM_PRIVACY_THRESHOLD),
  );

  assert.strictEqual(result.schools[0].currentRound?.isUnlocked, true);
});

test("each school is counted on its own, and nothing is summed across them", async () => {
  // The k-anonymity limit of the 2026-08-20 model, pinned rather than trusted.
  // Two schools whose small groups are each suppressed become readable when
  // added together, so the overview offers no place to add them: each school
  // carries its own numbers and the object holds no total of any kind.
  const northRound = round(
    "r-north",
    NORTH.id,
    "active",
    "2026-08-04T00:00:00.000Z",
  );
  const southRound = round(
    "r-south",
    SOUTH.id,
    "active",
    "2026-08-05T00:00:00.000Z",
  );

  const result = await overview(
    [NORTH, SOUTH],
    [northRound, southRound],
    [...responses(northRound.id, 6), ...responses(southRound.id, 7)],
  );

  const north = result.schools.find((s) => s.organization.id === NORTH.id);
  const south = result.schools.find((s) => s.organization.id === SOUTH.id);

  assert.strictEqual(north?.currentRound?.responseCount, 6);
  assert.strictEqual(south?.currentRound?.responseCount, 7);
  // Neither is unlocked on its own, and thirteen is not a number this object
  // knows how to produce.
  assert.strictEqual(north?.currentRound?.isUnlocked, false);
  assert.strictEqual(south?.currentRound?.isUnlocked, false);

  const keys = Object.keys(result);
  assert.deepStrictEqual(
    keys.sort(),
    ["administrators", "schools", "unattached"],
    "the overview gained a platform-wide field; a total across schools is refused",
  );
});

test("the summary carries no score, and no field that could hold one", async () => {
  // The other half of the same limit. How many answered is a count of people;
  // what they answered is the thing an administrator reads inside one school,
  // on that school's own screens, under that school's own suppression. A score
  // on this summary would be that fact rendered once per school in a list.
  const open = round("r-open", NORTH.id, "active", "2026-08-04T00:00:00.000Z");
  const result = await overview(
    [NORTH],
    [open],
    responses(open.id, MINIMUM_PRIVACY_THRESHOLD),
  );

  assert.deepStrictEqual(
    Object.keys(result.schools[0].currentRound ?? {}).sort(),
    [
      "id",
      "isUnlocked",
      "privacyThreshold",
      "responseCount",
      "status",
      "title",
    ],
  );
});
