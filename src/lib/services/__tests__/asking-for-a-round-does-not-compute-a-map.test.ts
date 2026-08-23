/**
 * Asking which round a school is on does not cost a map.
 *
 * `ManagerContextService.load` computed `AnalyticsService.getAnalyticsForRound`
 * for every caller, and most callers never rendered it. The 2026-08-21 audit
 * anchored the worst one — `GET /api/rounds` answers with a single round object
 * and was paying a full analysis to produce it — but seven manager screens were
 * doing the same, and on a closed round whose basis of calculation had changed,
 * "a full analysis" means loading every response, recomputing, and *writing*
 * the result. From a GET.
 *
 * These tests do not time anything. They watch which repository methods are
 * reached, because that is what the cost actually is, and it is the only claim
 * that stays true on a database nobody is running here.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  InMemoryOrganizationRepository,
  InMemoryRoundRepository,
  InMemorySurveyRepository,
} from "@/lib/repositories";
import {
  ManagerContextService,
  isSelectedRoundSuperseded,
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

const closedRound: SurveyRound = {
  id: "round-closed",
  organizationId: organization.id,
  title: "סבב שנסגר",
  status: "closed",
  shareCode: "SHALOM-CLOSEDROUND",
  privacyThreshold: 1,
  startDate: new Date("2026-07-01T00:00:00.000Z"),
  createdAt: new Date("2026-07-01T00:00:00.000Z"),
};

function responses(count: number): SurveyResponseRecord[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `response-${index}`,
    roundId: closedRound.id,
    answers: [],
    submittedAt: new Date("2026-07-21T00:00:00.000Z"),
  }));
}

/**
 * A repository that answers exactly as it did and says which methods were
 * asked. A `Proxy` rather than an object of wrapped functions, because these
 * repositories carry their methods on a prototype and spreading one silently
 * produces a repository with none of them.
 */
function counting<T extends object>(target: T): [T, Record<string, number>] {
  const calls: Record<string, number> = {};
  const watched = new Proxy(target, {
    get(base, key) {
      const value = Reflect.get(base, key, base);
      if (typeof value !== "function") return value;

      return (...args: unknown[]) => {
        calls[String(key)] = (calls[String(key)] ?? 0) + 1;
        return (value as (...rest: unknown[]) => unknown).apply(base, args);
      };
    },
  });

  return [watched, calls];
}

function stores(responseCount = 3) {
  const [orgRepo] = counting(new InMemoryOrganizationRepository([organization]));
  const [roundRepo, roundCalls] = counting(
    new InMemoryRoundRepository([closedRound]),
  );
  const [surveyRepo, surveyCalls] = counting(
    new InMemorySurveyRepository(responses(responseCount)),
  );

  return { orgRepo, roundRepo, roundCalls, surveyRepo, surveyCalls };
}

test("a caller that declines the analysis is not handed one", async () => {
  const { orgRepo, roundRepo, surveyRepo } = stores();

  const context = await ManagerContextService.load(
    orgRepo,
    roundRepo,
    surveyRepo,
    organization.id,
    undefined,
    undefined,
    { withAnalytics: false },
  );

  assert.equal(context.state, "round-ready");
  assert.equal(context.selectedRound?.id, closedRound.id);
  // Absent, not null. `null` is what a round with no numbers returns, so a
  // screen that later starts reading the field would be handed something that
  // looks like an answer instead of failing to compile.
  assert.equal("analytics" in context, false);
});

test("declining the analysis reads the round once, and nothing about its numbers", async () => {
  const { orgRepo, roundRepo, roundCalls, surveyRepo, surveyCalls } = stores();

  await ManagerContextService.load(
    orgRepo,
    roundRepo,
    surveyRepo,
    organization.id,
    undefined,
    undefined,
    { withAnalytics: false },
  );

  /*
   * One whole-round read, and it is the only one.
   *
   * This assertion used to say `undefined`, because the school's round list
   * arrived as whole rounds and `load` picked the selected one out of it —
   * making `getAnalyticsForRound`'s own lookup a duplicate, which is what
   * ADR-045 removed. ADR-051 made the list summaries, so the round on screen is
   * now read deliberately and exactly once. The duplicate is still refused:
   * `getAnalyticsForLoadedRound` takes the round rather than looking it up
   * again, which the negative control below pins.
   */
  assert.equal(roundCalls.findById, 1);
  assert.equal(roundCalls.findPublishedAnalytics, undefined);
  assert.equal(surveyCalls.findResponsesByRoundId, undefined);
  // One indexed count, which is the whole remaining cost.
  assert.equal(surveyCalls.getResponseCount, 1);
});

test("the count is still the school's real count", async () => {
  // Without this the test above would pass on a version that returned zero and
  // asked nothing at all — which would be cheap and wrong.
  const { orgRepo, roundRepo, surveyRepo } = stores(7);

  const context = await ManagerContextService.load(
    orgRepo,
    roundRepo,
    surveyRepo,
    organization.id,
    undefined,
    undefined,
    { withAnalytics: false },
  );

  assert.equal(context.responseCount, 7);
});

test("a GET that declines the analysis does not write one", async () => {
  // The sharp end of the finding. This round is closed and has no published
  // copy, so the default path loads every response, recomputes, and stores the
  // result — a write performed while answering a read.
  const declined = stores();
  await ManagerContextService.load(
    declined.orgRepo,
    declined.roundRepo,
    declined.surveyRepo,
    organization.id,
    undefined,
    undefined,
    { withAnalytics: false },
  );
  assert.equal(declined.roundCalls.savePublishedAnalytics, undefined);

  const asked = stores();
  await ManagerContextService.load(
    asked.orgRepo,
    asked.roundRepo,
    asked.surveyRepo,
    organization.id,
  );
  assert.equal(
    asked.roundCalls.savePublishedAnalytics,
    1,
    "the default path must still publish what it computed — otherwise the " +
      "assertion above is about a product that no longer analyses anything",
  );
});

test("asking for the analysis still gets the analysis", async () => {
  // The negative control for all of the above.
  const { orgRepo, roundRepo, roundCalls, surveyRepo, surveyCalls } = stores();

  const context = await ManagerContextService.load(
    orgRepo,
    roundRepo,
    surveyRepo,
    organization.id,
  );

  assert.equal(context.analytics?.roundId, closedRound.id);
  assert.equal(context.responseCount, 3);
  // Still one, with the analysis. The round is read once by `load` and handed
  // to the analysis rather than looked up a second time — if this ever reads 2,
  // the duplicate ADR-045 removed has come back.
  assert.equal(roundCalls.findById, 1);
  assert.equal(surveyCalls.findResponsesByRoundId, 1);
});

test("a school with no round costs nothing either way", async () => {
  // The states that return before a round is selected have no analysis to
  // decline, and the option changes neither what they say nor what they read.
  for (const withoutAnalytics of [true, false]) {
    const [orgRepo] = counting(new InMemoryOrganizationRepository([]));
    const [roundRepo, roundCalls] = counting(new InMemoryRoundRepository([]));
    const [surveyRepo, surveyCalls] = counting(new InMemorySurveyRepository([]));

    const context = withoutAnalytics
      ? await ManagerContextService.load(
          orgRepo,
          roundRepo,
          surveyRepo,
          undefined,
          undefined,
          undefined,
          { withAnalytics: false },
        )
      : await ManagerContextService.load(orgRepo, roundRepo, surveyRepo);

    assert.equal(context.state, "needs-organization");
    assert.equal(context.responseCount, 0);
    assert.equal(roundCalls.findPublishedAnalytics, undefined);
    assert.equal(surveyCalls.getResponseCount, undefined);
  }
});

test("the round screen can still tell whether the school moved past this round", async () => {
  // `isSelectedRoundSuperseded` is the one shared helper the declining screens
  // still call, and it reads the round list rather than the analysis. The round
  // screen passes it a context that no longer has one.
  const newer: SurveyRound = {
    ...closedRound,
    id: "round-newer",
    shareCode: "SHALOM-NEWERROUND",
    status: "active",
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
  };
  const [orgRepo] = counting(new InMemoryOrganizationRepository([organization]));
  const [roundRepo] = counting(
    new InMemoryRoundRepository([closedRound, newer]),
  );
  const [surveyRepo] = counting(new InMemorySurveyRepository([]));

  const context = await ManagerContextService.load(
    orgRepo,
    roundRepo,
    surveyRepo,
    organization.id,
    closedRound.id,
    undefined,
    { withAnalytics: false },
  );

  assert.equal(context.selectedRound?.id, closedRound.id);
  assert.equal(isSelectedRoundSuperseded(context), true);
});
