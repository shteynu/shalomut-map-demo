/**
 * How many times the administrator overview asks the database anything, and how
 * much each of those questions is allowed to bring back.
 *
 * It used to ask three questions per school inside a loop, each awaited before
 * the next: the school's memberships, the school's rounds, and a response count.
 * The deployed database answers in roughly 180 ms, so a hundred schools was
 * around 300 round trips in sequence — some 54 seconds, past the function
 * timeout, on the only administration screen there is.
 *
 * Fixing that made the count constant. It did not make the answers bounded:
 * every one of those constant queries still read a whole table — every school,
 * every manager, every membership — and rendered all of it into one page. So
 * these tests now pin both halves. A constant number of unbounded queries is
 * the same screen with a slower failure.
 *
 * They count calls rather than measuring time. What the screen says is
 * `administrator-school-overview.test.ts`; that it still says it while asking a
 * fixed number of bounded questions is here.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  InMemoryOrganizationRepository,
  InMemoryRoundRepository,
  InMemorySurveyRepository,
} from "@/lib/repositories";
import type { OrganizationPageQuery } from "@/lib/repositories/interfaces";
import type {
  Organization,
  SurveyResponseRecord,
  SurveyRound,
} from "@/lib/types/backend";
import { InMemoryManagerRepository } from "../domain-contract";
import {
  DEFAULT_SCHOOL_PAGE_SIZE,
  ManagerAdministrationService,
  type AdministrationPageQuery,
} from "../manager-administration-service";

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

  async findPage(query: OrganizationPageQuery) {
    return record("orgRepo.findPage", await super.findPage(query));
  }
}

class CountingManagerRepository extends InMemoryManagerRepository {
  async findManagersByIds(ids: readonly string[]) {
    return record(
      "managerRepo.findManagersByIds",
      await super.findManagersByIds(ids),
    );
  }

  async findPlatformAdministrators(limit: number) {
    return record(
      "managerRepo.findPlatformAdministrators",
      await super.findPlatformAdministrators(limit),
    );
  }

  async findManagersWithoutStandingMembership(limit: number) {
    return record(
      "managerRepo.findManagersWithoutStandingMembership",
      await super.findManagersWithoutStandingMembership(limit),
    );
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

async function overviewOf(
  schoolCount: number,
  query: AdministrationPageQuery = {},
) {
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
    query,
  );

  return { overview, calls: [...calls] };
}

test("the number of queries does not grow with the number of schools", async () => {
  const one = await overviewOf(1);
  const many = await overviewOf(300);

  assert.deepEqual(many.calls, one.calls);
});

test("neither does the number of schools on the screen", async () => {
  const { overview } = await overviewOf(300);

  // The half the constant-query fix did not address. Three hundred schools used
  // to be three hundred cards in one response.
  assert.equal(overview.schools.length, DEFAULT_SCHOOL_PAGE_SIZE);
  // And the heading still says how many there are, which is why the count is
  // asked for separately rather than read off the page.
  assert.equal(overview.page.total, 300);
  assert.equal(overview.page.pageCount, 15);
});

test("the last page is short and is still the last page", async () => {
  const { overview } = await overviewOf(25, { page: 2 });

  assert.equal(overview.schools.length, 5);
  assert.equal(overview.page.page, 2);
  assert.equal(overview.page.pageCount, 2);
});

test("a page past the end is empty rather than an error", async () => {
  // `page` comes off the address bar, so a number nobody offered is reachable
  // by typing. An empty page is the honest answer; a throw here would be a 500
  // on a URL an administrator can produce with the keyboard.
  const { overview } = await overviewOf(25, { page: 9 });

  assert.equal(overview.schools.length, 0);
  assert.equal(overview.page.total, 25);
});

test("a page cannot be widened past the maximum from the outside", async () => {
  const { overview } = await overviewOf(300, { pageSize: 100_000 });

  assert.equal(overview.schools.length, 100);
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
    "managerRepo.findManagersByIds",
    "managerRepo.findManagersWithoutStandingMembership",
    "managerRepo.findMembershipsByOrganizationIds",
    "managerRepo.findPlatformAdministrators",
    "orgRepo.findPage",
    "roundRepo.findSummariesByOrganizationIds",
    "surveyRepo.countResponsesByRoundIds",
  ]);

  // The one that is gone rather than replaced. `findAll` returned every school
  // in the platform to render twenty of them, and it is still on the repository
  // for the seed and the scripts.
  assert.equal(made.includes("orgRepo.findAll"), false);
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
  // Seven is the ceiling, not seven round trips: `findManagersByIds` and
  // `countResponsesByRoundIds` are both handed an empty list here and the
  // durable repositories return without asking the database. The call is
  // counted anyway, because what this test defends is the shape of the read.
  assert.equal(calls.length, 7);
});
