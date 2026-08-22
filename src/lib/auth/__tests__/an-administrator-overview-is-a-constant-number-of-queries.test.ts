/**
 * How many times the administrator overview asks the database anything.
 *
 * It used to ask three questions per school inside a loop, each awaited before
 * the next: the school's memberships, the school's rounds, and a response count.
 * The deployed database answers in roughly 180 ms, so a hundred schools was
 * around 300 round trips in sequence — some 54 seconds, past the function
 * timeout, on the only administration screen there is.
 *
 * So this test counts calls rather than measuring time. What the screen says is
 * `administrator-school-overview.test.ts`; that it still says it while asking a
 * fixed number of questions is here.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  InMemoryOrganizationRepository,
  InMemoryRoundRepository,
  InMemorySurveyRepository,
} from "@/lib/repositories";
import type {
  Organization,
  SurveyResponseRecord,
  SurveyRound,
} from "@/lib/types/backend";
import { InMemoryManagerRepository } from "../domain-contract";
import { ManagerAdministrationService } from "../manager-administration-service";

/** Every repository call the overview makes, in order. */
let calls: string[] = [];

function record<T>(name: string, value: T): T {
  calls.push(name);
  return value;
}

class CountingOrganizationRepository extends InMemoryOrganizationRepository {
  async findAll() {
    return record("orgRepo.findAll", await super.findAll());
  }
}

class CountingManagerRepository extends InMemoryManagerRepository {
  async findAllManagers() {
    return record("managerRepo.findAllManagers", await super.findAllManagers());
  }

  async findMembershipsByOrganizationId(organizationId: string) {
    return record(
      "managerRepo.findMembershipsByOrganizationId",
      await super.findMembershipsByOrganizationId(organizationId),
    );
  }

  async findMembershipsByOrganizationIds(organizationIds: readonly string[]) {
    return record(
      "managerRepo.findMembershipsByOrganizationIds",
      await super.findMembershipsByOrganizationIds(organizationIds),
    );
  }
}

class CountingRoundRepository extends InMemoryRoundRepository {
  async findByOrganizationId(organizationId: string) {
    return record(
      "roundRepo.findByOrganizationId",
      await super.findByOrganizationId(organizationId),
    );
  }

  async findSummariesByOrganizationIds(organizationIds: readonly string[]) {
    return record(
      "roundRepo.findSummariesByOrganizationIds",
      await super.findSummariesByOrganizationIds(organizationIds),
    );
  }
}

class CountingSurveyRepository extends InMemorySurveyRepository {
  async getResponseCount(roundId: string) {
    return record(
      "surveyRepo.getResponseCount",
      await super.getResponseCount(roundId),
    );
  }

  async countResponsesByRoundIds(roundIds: readonly string[]) {
    return record(
      "surveyRepo.countResponsesByRoundIds",
      await super.countResponsesByRoundIds(roundIds),
    );
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

function activeRound(organizationId: string): SurveyRound {
  return {
    id: `round-${organizationId}`,
    organizationId,
    title: "סבב פעיל",
    status: "active",
    shareCode: `CODE-${organizationId}`,
    privacyThreshold: 10,
    startDate: new Date("2026-08-02T00:00:00.000Z"),
    createdAt: new Date("2026-08-02T00:00:00.000Z"),
  };
}

function responsesFor(roundId: string, count: number): SurveyResponseRecord[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `${roundId}-${index}`,
    roundId,
    answers: [],
    submittedAt: new Date("2026-08-10T00:00:00.000Z"),
  }));
}

async function overviewOf(schoolCount: number) {
  const organizations = Array.from({ length: schoolCount }, (_, index) =>
    school(index),
  );
  const rounds = organizations.map((organization) =>
    activeRound(organization.id),
  );
  const responses = rounds.flatMap((round) => responsesFor(round.id, 3));

  calls = [];
  const overview = await ManagerAdministrationService.loadOverview(
    new CountingOrganizationRepository(organizations),
    new CountingManagerRepository(),
    new CountingRoundRepository(rounds),
    new CountingSurveyRepository(responses),
  );

  return { overview, calls: [...calls] };
}

test("the number of queries does not grow with the number of schools", async () => {
  const one = await overviewOf(1);
  const many = await overviewOf(25);

  assert.deepEqual(many.calls, one.calls);
  assert.equal(many.overview.schools.length, 25);
});

test("nothing is asked about one school at a time", async () => {
  const { calls: made } = await overviewOf(25);

  // The three that used to sit inside the loop. Their single-subject forms are
  // still on the repositories — other callers legitimately ask about one
  // school — so what this pins is that this screen does not.
  for (const perSchool of [
    "managerRepo.findMembershipsByOrganizationId",
    "roundRepo.findByOrganizationId",
    "surveyRepo.getResponseCount",
  ]) {
    assert.equal(
      made.includes(perSchool),
      false,
      `${perSchool} is asked once per school`,
    );
  }

  assert.deepEqual(made.slice().sort(), [
    "managerRepo.findAllManagers",
    "managerRepo.findMembershipsByOrganizationIds",
    "orgRepo.findAll",
    "roundRepo.findSummariesByOrganizationIds",
    "surveyRepo.countResponsesByRoundIds",
  ]);
});

test("a school with nothing open still costs nothing extra", async () => {
  // The count query is asked for the rounds the screen names, so a screen that
  // names none must not ask it with an empty list and must not ask it per
  // school either.
  calls = [];
  const overview = await ManagerAdministrationService.loadOverview(
    new CountingOrganizationRepository([school(0), school(1)]),
    new CountingManagerRepository(),
    new CountingRoundRepository([]),
    new CountingSurveyRepository([]),
  );

  assert.equal(overview.schools.length, 2);
  assert.equal(overview.schools[0].currentRound, null);
  assert.equal(calls.length, 5);
});
