/**
 * A school's list of rounds costs a list, not its whole history.
 *
 * The 2026-08-21 audit's record about `survey_rounds` was closed in the part
 * about the index and left open in this part: `findByOrganizationId` selects
 * every column, so every entry in a school's round list arrived carrying that
 * round's whole questionnaire and whole Stone Map. Eight rounds on the 126-item
 * instrument is roughly a quarter of a megabyte, fetched, shipped and parsed on
 * the way to a screen that renders a list of titles.
 *
 * The summary read already existed — it was written for the administrator
 * console listing many schools — and one school's own list is the same
 * projection. So this suite watches which read the context reaches for, and
 * pins the one full-round read that stays: the round on screen.
 *
 * One caller was left behind by that pass and closed on 2026-08-25: the sweep
 * that closes a school's other active round when a round is activated. It reads
 * two fields of each sibling and was paying the same quarter of a megabyte for
 * them, on a write path rather than a render.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  InMemoryOrganizationRepository,
  InMemoryRoundRepository,
  InMemorySurveyRepository,
} from '@/lib/repositories';
import { ManagerContextService } from '@/lib/services/manager-context.service';
import { RoundService } from '@/lib/services/round.service';
import { createCanonicalSurveyDefinition } from '@/lib/survey-definition';
import type { Organization, SurveyRound } from '@/lib/types/backend';

const organization: Organization = {
  id: 'org-1',
  name: 'בית ספר בדיקה',
  city: 'חיפה',
  schoolType: 'יסודי',
  totalStaffCount: 30,
  createdAt: new Date('2026-07-01T00:00:00.000Z'),
};

/** Eight rounds, each carrying the questionnaire this read is about. */
function history(): SurveyRound[] {
  return Array.from({ length: 8 }, (_unused, index) => ({
    id: `round-${index}`,
    organizationId: organization.id,
    title: `סבב ${index}`,
    status: index === 7 ? ('active' as const) : ('closed' as const),
    shareCode: `SHALOM-ROUND${index}`,
    privacyThreshold: 1,
    startDate: new Date(2026, 0, index + 1),
    createdAt: new Date(2026, 0, index + 1),
    surveyDefinition: createCanonicalSurveyDefinition(`סבב ${index}`, 10),
  }));
}

function counting<T extends object>(target: T): [T, Record<string, number>] {
  const calls: Record<string, number> = {};
  const watched = new Proxy(target, {
    get(base, key) {
      const value = Reflect.get(base, key, base);
      if (typeof value !== 'function') return value;
      return (...args: unknown[]) => {
        calls[String(key)] = (calls[String(key)] ?? 0) + 1;
        return (value as (...rest: unknown[]) => unknown).apply(base, args);
      };
    },
  });
  return [watched, calls];
}

function stores() {
  const [orgRepo] = counting(new InMemoryOrganizationRepository([organization]));
  const [roundRepo, roundCalls] = counting(new InMemoryRoundRepository(history()));
  const [surveyRepo] = counting(new InMemorySurveyRepository([]));
  return { orgRepo, roundRepo, roundCalls, surveyRepo };
}

function load(
  repos: ReturnType<typeof stores>,
  requestedRoundId?: string,
) {
  return ManagerContextService.load(
    repos.orgRepo,
    repos.roundRepo,
    repos.surveyRepo,
    organization.id,
    requestedRoundId,
    undefined,
    { withAnalytics: false },
  );
}

test('the school list is read as summaries, and the whole-round read is not used', async () => {
  const repos = stores();

  await load(repos);

  assert.equal(repos.roundCalls.findSummariesByOrganizationIds, 1);
  assert.equal(
    repos.roundCalls.findByOrganizationId,
    undefined,
    'that read selects every column of every round the school has ever run',
  );
});

test('exactly one round is read whole, and it is the one on screen', async () => {
  const repos = stores();

  const context = await load(repos, 'round-3');

  assert.equal(repos.roundCalls.findById, 1);
  assert.equal(context.selectedRound?.id, 'round-3');
  // Whole: the screen it is for renders the questionnaire, so the narrowing
  // must not have reached it.
  assert.ok(context.selectedRound?.surveyDefinition);
  assert.equal(context.selectedRound?.shareCode, 'SHALOM-ROUND3');
});

test('no entry in the list carries a questionnaire or a map', async () => {
  // The type says so, which is the guard that survives an edit. This pins that
  // the store agrees at runtime, so a list serialised into a server component's
  // payload cannot start shipping eight questionnaires to the browser.
  const repos = stores();

  const context = await load(repos);

  assert.equal(context.rounds.length, 8);
  for (const round of context.rounds) {
    assert.ok(!('surveyDefinition' in round), 'a list entry carries no questionnaire');
    assert.ok(!('aiInsights' in round));
    assert.ok(!('shareCode' in round), 'nor the code that opens the questionnaire');
  }
});

test('the list is still the manager order, and still the whole history', async () => {
  // Without this the assertions above would pass on a context that had stopped
  // listing rounds, or listed them in the store's order rather than the
  // manager's — active first, then newest.
  const repos = stores();

  const context = await load(repos);

  assert.equal(context.rounds[0].id, 'round-7');
  assert.equal(context.rounds[0].status, 'active');
  assert.deepEqual(
    context.rounds.slice(1).map((round) => round.id),
    ['round-6', 'round-5', 'round-4', 'round-3', 'round-2', 'round-1', 'round-0'],
  );
});

test('a round asked for by an id the school does not have is still refused', async () => {
  // The lookup moved from a list of whole rounds to a list of summaries, and it
  // is the same guard: an id belonging to another school reads as unknown
  // rather than opening its results.
  const repos = stores();

  const context = await load(repos, 'round-belonging-to-another-school');

  assert.equal(context.state, 'round-not-found');
  assert.equal(context.selectedRound, null);
  assert.equal(
    repos.roundCalls.findById,
    undefined,
    'and the refusal costs no read at all',
  );
});

test('activating a round sweeps the school with summaries, not with its history', async () => {
  const repos = stores();
  const rounds = history();
  const draft = { ...rounds[0], id: 'round-0', status: 'draft' as const };

  const closed = await RoundService.closeOtherActiveRounds(draft, repos.roundRepo);

  // Round 7 is the school's active one, and it is what the sweep closes.
  assert.deepEqual(
    closed.map((round) => round.id),
    ['round-7'],
  );
  assert.equal(repos.roundCalls.findSummariesByOrganizationIds, 1);
  assert.equal(
    repos.roundCalls.findByOrganizationId,
    undefined,
    'the sweep reads two fields per sibling; that read selects every column',
  );
});

test('the sweep leaves the round being activated alone', async () => {
  const repos = stores();
  const active = history()[7];

  const closed = await RoundService.closeOtherActiveRounds(active, repos.roundRepo);

  assert.deepEqual(closed, [], 'a round does not close itself on its way to active');
});
