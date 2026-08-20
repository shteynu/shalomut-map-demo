/**
 * What the manual analysis trigger refuses.
 *
 * Two rules, added together and for the same reason: this route is reachable
 * without the screens that offer it, so neither rule may live in a `disabled`
 * attribute.
 *
 * Until this suite existed, it refused nothing: the route checked
 * authorization and the archive, and the only thing between nine responses and
 * a dispatched analysis was `disabled` on a button
 * (`round-controls.tsx`). The threshold was verified on the automatic path
 * alone — the one that runs after a respondent submission — so a request made
 * without the screen was never measured against it.
 *
 * These tests are that door, closed, and the threshold half was written before
 * the automatic path was removed so the invariant was never briefly unguarded.
 *
 * The second rule arrived with the move: closing a round is what asks for its
 * analysis, so this route is the second opinion on a round already closed, and
 * a round still collecting has not asked for a first one.
 */
import assert from 'node:assert/strict';
import test, { after, before, beforeEach } from 'node:test';

import { POST as triggerAi } from '../rounds/[roundId]/trigger-ai/route';
import {
  InMemoryAiAnalysisRunRepository,
  InMemoryAiInsightsRepository,
  InMemoryOrganizationRepository,
  InMemoryRoundGoalRepository,
  InMemoryRoundRepository,
  InMemorySurveyRepository,
} from '@/lib/repositories';
import {
  overrideCoreRepositories,
  resetCoreRepositories,
} from '@/lib/composition-root';
import { MINIMUM_PRIVACY_THRESHOLD } from '@/lib/survey-definition';
import type { RoundStatus, SurveyResponseRecord } from '@/lib/types/backend';
import {
  DEMO_ORGANIZATION,
  DEMO_ROUND,
} from '@/lib/repositories/__fixtures__/demo-records';

const ROUND_ID = DEMO_ROUND.id;
const params = () => ({ params: Promise.resolve({ roundId: ROUND_ID }) }) as any;

let previousDatabaseUrl: string | undefined;

/**
 * Only the count is load-bearing here, so the answers stay empty. A response
 * carrying invented answers would suggest this decision reads them.
 */
function responses(count: number): SurveyResponseRecord[] {
  return Array.from({ length: count }, (_unused, index) => ({
    id: `response-${index}`,
    roundId: ROUND_ID,
    answers: [],
    submittedAt: new Date('2026-08-17T09:00:00.000Z'),
  }));
}

function install({
  responseCount,
  privacyThreshold = MINIMUM_PRIVACY_THRESHOLD,
  status = 'closed' as RoundStatus,
}: {
  responseCount: number;
  privacyThreshold?: number;
  status?: RoundStatus;
}) {
  overrideCoreRepositories({
    orgRepo: new InMemoryOrganizationRepository([DEMO_ORGANIZATION]),
    roundRepo: new InMemoryRoundRepository([
      { ...DEMO_ROUND, status, privacyThreshold },
    ]),
    roundGoalRepo: new InMemoryRoundGoalRepository(),
    surveyRepo: new InMemorySurveyRepository(responses(responseCount)),
    aiInsightsRepo: new InMemoryAiInsightsRepository(),
    aiAnalysisRunRepo: new InMemoryAiAnalysisRunRepository(),
  });
}

before(() => {
  previousDatabaseUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
});

after(() => {
  resetCoreRepositories();
  if (previousDatabaseUrl === undefined) {
    delete process.env.DATABASE_URL;
  } else {
    process.env.DATABASE_URL = previousDatabaseUrl;
  }
});

beforeEach(() => {
  resetCoreRepositories();
});

function post() {
  return new Request(
    `http://localhost/api/rounds/${ROUND_ID}/trigger-ai`,
    { method: 'POST' },
  );
}

test('a round still collecting refuses, because closing is what asks for the analysis', async () => {
  install({ responseCount: MINIMUM_PRIVACY_THRESHOLD * 3, status: 'active' });

  const response = await triggerAi(post(), params());
  const body = await response.json();

  assert.equal(response.status, 409);
  assert.equal(body.code, 'round_not_closed');
});

test('a draft round refuses too, so the rule is about being closed and not about being open', async () => {
  install({ responseCount: MINIMUM_PRIVACY_THRESHOLD, status: 'draft' });

  const response = await triggerAi(post(), params());

  assert.equal((await response.json()).code, 'round_not_closed');
});

test('being closed is not on its own enough — the threshold still decides', async () => {
  install({ responseCount: MINIMUM_PRIVACY_THRESHOLD - 1 });

  const response = await triggerAi(post(), params());

  assert.equal((await response.json()).code, 'below_privacy_threshold');
});

test('a round one response short of the threshold refuses to dispatch an analysis', async () => {
  install({ responseCount: MINIMUM_PRIVACY_THRESHOLD - 1 });

  const response = await triggerAi(post(), params());
  const body = await response.json();

  assert.equal(response.status, 409);
  assert.equal(body.code, 'below_privacy_threshold');
});

test('the refusal leaves no run behind, so a retry is not a queue', async () => {
  install({ responseCount: 1 });
  const { aiAnalysisRunRepo } = (
    await import('@/lib/composition-root')
  ).resolveCoreRepositories();

  await triggerAi(post(), params());
  await triggerAi(post(), params());

  assert.deepEqual(await aiAnalysisRunRepo.findByRoundId(ROUND_ID), []);
});

test('a round at the threshold dispatches, so the guard refuses the case it is about and no other', async () => {
  install({ responseCount: MINIMUM_PRIVACY_THRESHOLD });

  const response = await triggerAi(post(), params());

  assert.equal(response.status, 202);
});

test('a manager who raised the threshold is held to their own number, not to the minimum', async () => {
  install({ responseCount: 12, privacyThreshold: 15 });

  const response = await triggerAi(post(), params());
  const body = await response.json();

  assert.equal(response.status, 409);
  assert.equal(body.code, 'below_privacy_threshold');
  assert.match(body.error, /15/);
});

test('a stored threshold below the minimum cannot lower the floor', async () => {
  install({ responseCount: 5, privacyThreshold: 3 });

  const response = await triggerAi(post(), params());

  assert.equal(response.status, 409);
});
