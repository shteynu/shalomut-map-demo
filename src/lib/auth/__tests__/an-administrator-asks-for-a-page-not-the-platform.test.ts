/**
 * What the administrator console asks for, once it stops asking for everything.
 *
 * The 2026-08-21 audit's remainder listed this screen as the last one with no
 * ceiling: it read every school, every manager and every membership, and
 * rendered all of them into one page of cards. An earlier fix made the number
 * of queries constant, which removed the timeout and left the size of each
 * answer exactly where it was.
 *
 * The interesting part is not the paging. It is what paging breaks. Two of the
 * three lists on that screen were **derived by subtraction** — everybody, minus
 * everybody the memberships accounted for — and subtraction only works while
 * both operands are complete. The moment the schools arrive twenty at a time,
 * a person attached to a school on page four looks exactly like a person
 * attached to nothing. So most of what is asserted here is not "the page has
 * twenty rows" but "the answers about people are still about the platform".
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  InMemoryOrganizationRepository,
  InMemoryRoundRepository,
  InMemorySurveyRepository,
} from "@/lib/repositories";
import type { Organization } from "@/lib/types/backend";
import { InMemoryManagerRepository } from "../domain-contract";
import type { Manager, OrganizationMembership } from "../types";
import {
  DEFAULT_SCHOOL_PAGE_SIZE,
  MAXIMUM_LISTED_PEOPLE,
  MAXIMUM_SCHOOL_PAGE_SIZE,
  ManagerAdministrationService,
  readAdministrationPageQuery,
  type AdministrationPageQuery,
} from "../manager-administration-service";

/**
 * Schools with distinct creation instants, newest last in this array.
 *
 * Distinct on purpose: the order is `createdAt` descending, and a fixture whose
 * rows all share one timestamp would pass a paging test by accident of the
 * tie-break rather than by the ordering being real.
 */
function schools(count: number, name = (index: number) => `בית ספר ${index}`) {
  return Array.from({ length: count }, (_, index) => ({
    id: `org-${String(index).padStart(3, "0")}`,
    name: name(index),
    city: "חיפה",
    schoolType: "יסודי",
    totalStaffCount: 40,
    createdAt: new Date(Date.UTC(2026, 0, 1) + index * 86_400_000),
  })) satisfies Organization[];
}

function manager(index: number, overrides: Partial<Manager> = {}): Manager {
  return {
    id: `mgr-${String(index).padStart(3, "0")}`,
    email: `person${index}@school.ac.il`,
    name: `אדם ${index}`,
    isPlatformAdministrator: false,
    createdAt: new Date(Date.UTC(2026, 0, 1) + index * 3_600_000),
    ...overrides,
  };
}

function membership(
  managerId: string,
  organizationId: string,
  status: OrganizationMembership["status"] = "active",
): OrganizationMembership {
  return {
    id: `membership-${managerId}`,
    managerId,
    organizationId,
    role: "manager",
    status,
    createdAt: new Date(Date.UTC(2026, 0, 1)),
  };
}

function load(
  organizations: Organization[],
  managers: Manager[] = [],
  memberships: OrganizationMembership[] = [],
  query: AdministrationPageQuery = {},
) {
  return ManagerAdministrationService.loadOverview(
    new InMemoryOrganizationRepository(organizations),
    new InMemoryManagerRepository(managers, memberships),
    new InMemoryRoundRepository([]),
    new InMemorySurveyRepository([]),
    query,
  );
}

test("the pages together are every school, each exactly once", async () => {
  // The property a pager either has or does not. An unstable order shows a
  // school twice and hides another, and neither is visible from one page.
  const all = schools(45);
  const seen: string[] = [];

  for (const page of [1, 2, 3]) {
    const overview = await load(all, [], [], { page });
    seen.push(...overview.schools.map((school) => school.organization.id));
  }

  assert.equal(seen.length, 45);
  assert.equal(new Set(seen).size, 45);
  assert.deepEqual(
    seen,
    // Newest first, which is the order the whole list had before it was paged.
    all
      .slice()
      .reverse()
      .map((school) => school.id),
  );
});

test("a search matches the name or the city, in either case", async () => {
  const all = [
    ...schools(3),
    {
      id: "org-gordon",
      name: "Gordon",
      city: "תל אביב",
      schoolType: "יסודי",
      totalStaffCount: 30,
      createdAt: new Date(Date.UTC(2026, 5, 1)),
    },
  ];

  const byName = await load(all, [], [], { search: "gordon" });
  assert.deepEqual(
    byName.schools.map((school) => school.organization.id),
    ["org-gordon"],
  );

  const byCity = await load(all, [], [], { search: "תל" });
  assert.deepEqual(
    byCity.schools.map((school) => school.organization.id),
    ["org-gordon"],
  );

  // The total is what matched, not what fitted on the page — it is the number
  // in the heading, and on a search it is the only honest one.
  assert.equal(byName.page.total, 1);
});

test("a pattern character in the search is a character", async () => {
  /*
   * The in-memory store cannot get this wrong: `String.includes` has no
   * pattern language. The durable one can — `contains` compiles to `ILIKE` and
   * escapes nothing inside the value — and `postgres-organization-pages` walks
   * exactly this case against a real database.
   *
   * It is asserted on both because the two stores have to agree on the answer,
   * and this is the answer: a `%` typed into a search box matches schools with
   * a `%` in the name, of which there are none.
   */
  const found = await load(schools(5), [], [], { search: "%" });

  assert.equal(found.schools.length, 0);
  assert.equal(found.page.total, 0);
});

test("somebody attached to a school on another page is not somebody with no school", async () => {
  // The regression the whole change turns on. `unattached` used to be every
  // manager minus every manager named by a membership the screen had loaded,
  // and page one loads twenty schools' worth of memberships.
  const all = schools(40);
  const distant = manager(1);
  const overview = await load(
    all,
    [distant],
    // `org-000` is the oldest school, so it sits on the last page.
    [membership(distant.id, "org-000")],
    { page: 1 },
  );

  assert.equal(
    overview.schools.some((school) => school.organization.id === "org-000"),
    false,
    "the fixture must put this school off the first page or it proves nothing",
  );
  assert.deepEqual(overview.unattached.people, []);
});

test("a revoked membership is somebody with no school, from any page", async () => {
  // The negative control for the test above: the question really is being
  // answered, rather than answered `[]`.
  const all = schools(40);
  const revoked = manager(2);
  const overview = await load(
    all,
    [revoked],
    [membership(revoked.id, "org-000", "suspended")],
    { page: 1 },
  );

  assert.deepEqual(
    overview.unattached.people.map((person) => person.id),
    [revoked.id],
  );
});

test("an administrator is listed as an administrator and never as unattached", async () => {
  const administrator = manager(3, { isPlatformAdministrator: true });
  const overview = await load(schools(2), [administrator], []);

  assert.deepEqual(
    overview.administrators.people.map((person) => person.id),
    [administrator.id],
  );
  // They have no membership by design. Reading that as a lost school would put
  // every administrator into the list of rows that need cleaning up.
  assert.deepEqual(overview.unattached.people, []);
});

test("the page's cards name only the page's people", async () => {
  const all = schools(40);
  const here = manager(4);
  const elsewhere = manager(5);
  const overview = await load(
    all,
    [here, elsewhere],
    [
      // `org-039` is the newest school and sits first on page one.
      membership(here.id, "org-039"),
      membership(elsewhere.id, "org-000"),
    ],
    { page: 1 },
  );

  const people = overview.schools.flatMap((school) =>
    school.people.map(({ manager: person }) => person.id),
  );
  assert.deepEqual(people, [here.id]);
});

test("both people lists stop at the cap and say that they did", async () => {
  const crowd = Array.from({ length: MAXIMUM_LISTED_PEOPLE + 5 }, (_, index) =>
    manager(100 + index),
  );
  const overview = await load(schools(1), crowd, []);

  assert.equal(overview.unattached.people.length, MAXIMUM_LISTED_PEOPLE);
  assert.equal(overview.unattached.truncated, true);
  // Exactly the cap, not the cap plus the row that was read to detect the tail.
  assert.equal(
    overview.unattached.people.length,
    MAXIMUM_LISTED_PEOPLE,
    "the extra row read to detect the tail must not be rendered",
  );
});

test("a list that fits is not reported as cut short", async () => {
  const overview = await load(schools(1), [manager(6)], []);

  assert.equal(overview.unattached.people.length, 1);
  assert.equal(overview.unattached.truncated, false);
  assert.equal(overview.administrators.truncated, false);
});

test("an empty platform has one page rather than none", async () => {
  // `page 1 of 0` is what `Math.ceil(0 / 20)` reads as on the screen.
  const overview = await load([], [], []);

  assert.equal(overview.page.total, 0);
  assert.equal(overview.page.pageCount, 1);
  assert.equal(overview.schools.length, 0);
});

test("what the address bar carries is clamped rather than refused", async () => {
  // Every one of these is reachable by typing, so none of them may be an error
  // screen — and none of them may widen the read.
  assert.deepEqual(readAdministrationPageQuery({}), { search: "", page: 1 });
  assert.deepEqual(readAdministrationPageQuery({ page: "0" }), {
    search: "",
    page: 1,
  });
  assert.deepEqual(readAdministrationPageQuery({ page: "-3" }), {
    search: "",
    page: 1,
  });
  assert.deepEqual(readAdministrationPageQuery({ page: "כלום" }), {
    search: "",
    page: 1,
  });
  // Next.js hands a repeated parameter over as an array. The first one wins,
  // rather than `["2","3"]` reaching `parseInt` as a stringified array.
  assert.deepEqual(readAdministrationPageQuery({ page: ["2", "3"] }), {
    search: "",
    page: 2,
  });
  assert.deepEqual(readAdministrationPageQuery({ q: ["  צפון  "] }), {
    search: "צפון",
    page: 1,
  });
});

test("a page size from the outside cannot exceed the maximum", async () => {
  const overview = await load(schools(200), [], [], {
    pageSize: Number.MAX_SAFE_INTEGER,
  });

  assert.equal(overview.schools.length, MAXIMUM_SCHOOL_PAGE_SIZE);
});

test("the default page is the default page size", async () => {
  // Stated so the constant and the behaviour cannot drift apart silently.
  const overview = await load(schools(DEFAULT_SCHOOL_PAGE_SIZE + 1), [], []);

  assert.equal(overview.schools.length, DEFAULT_SCHOOL_PAGE_SIZE);
  assert.equal(overview.page.pageSize, DEFAULT_SCHOOL_PAGE_SIZE);
});
