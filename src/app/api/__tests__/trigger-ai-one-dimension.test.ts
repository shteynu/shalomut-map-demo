/**
 * Asking for one dimension to be written again.
 *
 * The route has always meant "analyse this round". It now also accepts a list
 * of dimensions, and the interesting part is everything that does *not*
 * change: an absent body still means the whole round, every refusal above this
 * one still fires first, and what comes back from the service is still a whole
 * map. What this suite holds is the new door — which names are accepted, what
 * is stored when they are, and the one case where naming any of them is
 * refused.
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
  resolveCoreRepositories,
} from '@/lib/composition-root';
import { InMemoryAuditLogRepository } from '@/lib/auth/domain-contract';
import { setAuditLogRepositoryForTests } from '@/lib/server/manager-audit';
import { MINIMUM_PRIVACY_THRESHOLD } from '@/lib/survey-definition';
import type { SurveyResponseRecord } from '@/lib/types/backend';
import {
  DEMO_ORGANIZATION,
  DEMO_ROUND,
} from '@/lib/repositories/__fixtures__/demo-records';

const ROUND_ID = DEMO_ROUND.id;
const params = () => ({ params: Promise.resolve({ roundId: ROUND_ID }) }) as any;

let previousDatabaseUrl: string | undefined;

function responses(count: number): SurveyResponseRecord[] {
  return Array.from({ length: count }, (_unused, index) => ({
    id: `response-${index}`,
    roundId: ROUND_ID,
    answers: [],
    submittedAt: new Date('2026-08-19T09:00:00.000Z'),
  }));
}

/**
 * A round that has already been analysed, unless told otherwise: a partial run
 * amends a map, so most of these need one to exist.
 */
async function install({ analysed = true }: { analysed?: boolean } = {}) {
  const aiAnalysisRunRepo = new InMemoryAiAnalysisRunRepository();
  overrideCoreRepositories({
    orgRepo: new InMemoryOrganizationRepository([DEMO_ORGANIZATION]),
    roundRepo: new InMemoryRoundRepository([
      { ...DEMO_ROUND, status: 'closed' },
    ]),
    roundGoalRepo: new InMemoryRoundGoalRepository(),
    surveyRepo: new InMemorySurveyRepository(
      responses(MINIMUM_PRIVACY_THRESHOLD),
    ),
    aiInsightsRepo: new InMemoryAiInsightsRepository(),
    aiAnalysisRunRepo,
  });

  if (!analysed) return;

  const enqueued = await aiAnalysisRunRepo.enqueue(ROUND_ID, {
    requestKey: 'seed',
    trigger: 'closure',
  });
  const lease = await aiAnalysisRunRepo.claimNext({
    workerId: 'seed-worker',
    leaseMs: 60_000,
  });
  assert.ok(lease, 'the seeded run should be claimable');
  await aiAnalysisRunRepo.finish(enqueued.run.id, {
    state: 'succeeded',
    leaseToken: lease.leaseToken,
    result: { roundId: ROUND_ID, stones: {} },
  });
}

function post(body?: unknown) {
  return new Request(
    `http://localhost/api/rounds/${ROUND_ID}/trigger-ai`,
    body === undefined
      ? { method: 'POST' }
      : {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        },
  );
}

before(() => {
  previousDatabaseUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  setAuditLogRepositoryForTests(new InMemoryAuditLogRepository());
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

test('a request with no body still means the whole round', async () => {
  await install();

  const response = await triggerAi(post(), params());
  const body = await response.json();

  assert.equal(response.status, 202);
  assert.deepEqual(body.run.regenerateDimensionIds, []);
});

test('an empty list means the whole round too, and so does a null', async () => {
  // Three ways of saying "no dimensions in particular". They must not diverge:
  // a screen posting an empty array has not asked for a partial run.
  for (const body of [{}, { dimensionIds: [] }, { dimensionIds: null }]) {
    await install();

    const response = await triggerAi(post(body), params());

    assert.equal(response.status, 202, JSON.stringify(body));
    assert.deepEqual(
      (await response.json()).run.regenerateDimensionIds,
      [],
      JSON.stringify(body),
    );
  }
});

test('a named dimension is stored on the run, which is what the worker reads', async () => {
  await install();

  const response = await triggerAi(post({ dimensionIds: ['balance'] }), params());
  const runs = await resolveCoreRepositories().aiAnalysisRunRepo.findByRoundId(
    ROUND_ID,
  );

  assert.equal(response.status, 202);
  assert.deepEqual(
    (await response.json()).run.regenerateDimensionIds,
    ['balance'],
  );
  assert.deepEqual(runs.at(-1)?.regenerateDimensionIds, ['balance']);
});

test('the stored list is canonical, however the caller wrote it', async () => {
  // Repeats collapse and the order is the map's, so two requests asking for
  // the same work store the same thing.
  await install();

  await triggerAi(
    post({ dimensionIds: ['meaning', 'balance', 'balance'] }),
    params(),
  );
  const runs = await resolveCoreRepositories().aiAnalysisRunRepo.findByRoundId(
    ROUND_ID,
  );

  assert.deepEqual(runs.at(-1)?.regenerateDimensionIds, ['balance', 'meaning']);
});

test('a name that is not a dimension is refused, not quietly dropped', async () => {
  // Dropping it would turn a misunderstood request into a full round's worth
  // of provider calls that nobody asked for.
  await install();

  const response = await triggerAi(
    post({ dimensionIds: ['balance', 'not-a-dimension'] }),
    params(),
  );

  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /not-a-dimension/u);
  // The refusal queues nothing, so a caller retrying is not building a queue.
  // The seeded run this round already carries is finished and stays.
  const runs = await resolveCoreRepositories().aiAnalysisRunRepo.findByRoundId(
    ROUND_ID,
  );
  assert.deepEqual(
    runs.filter((run) => run.state === 'queued'),
    [],
  );
});

test('dimensionIds that is not a list of strings is refused', async () => {
  await install();

  const response = await triggerAi(post({ dimensionIds: 'balance' }), params());

  assert.equal(response.status, 400);
});

test('naming dimensions on a round with no stored analysis is refused', async () => {
  // There is nothing to amend. The manager reached this from a note about
  // paragraphs that exist, so an empty round means the state changed under
  // them — and the full-round button is still there to ask the first question.
  await install({ analysed: false });

  const response = await triggerAi(post({ dimensionIds: ['balance'] }), params());
  const body = await response.json();

  assert.equal(response.status, 409);
  assert.equal(body.code, 'no_previous_analysis');
  assert.deepEqual(
    await resolveCoreRepositories().aiAnalysisRunRepo.findByRoundId(ROUND_ID),
    [],
  );
});

test('the same round with no analysis still accepts a whole-round run', async () => {
  // The refusal above is about the partial request, not about the round.
  await install({ analysed: false });

  const response = await triggerAi(post(), params());

  assert.equal(response.status, 202);
});

test('every refusal the route already had still fires before this one', async () => {
  // A round still collecting is refused for being open, not for naming a
  // dimension — the new check must not have jumped the queue.
  overrideCoreRepositories({
    orgRepo: new InMemoryOrganizationRepository([DEMO_ORGANIZATION]),
    roundRepo: new InMemoryRoundRepository([
      { ...DEMO_ROUND, status: 'active' },
    ]),
    roundGoalRepo: new InMemoryRoundGoalRepository(),
    surveyRepo: new InMemorySurveyRepository(
      responses(MINIMUM_PRIVACY_THRESHOLD),
    ),
    aiInsightsRepo: new InMemoryAiInsightsRepository(),
    aiAnalysisRunRepo: new InMemoryAiAnalysisRunRepository(),
  });

  const response = await triggerAi(post({ dimensionIds: ['balance'] }), params());

  assert.equal((await response.json()).code, 'round_not_closed');
});
