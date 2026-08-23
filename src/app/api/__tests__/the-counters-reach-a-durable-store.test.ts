/**
 * The counters stop dying with the container.
 *
 * The audit of 2026-08-21 found every operational counter and all of this
 * product's error tracking emitting `console` lines with no collector, no
 * retention and no alert. This is the first half of the answer: that real
 * product work reaches a durable store, that a caught error does too, and that
 * neither can cost the work it describes.
 *
 * Asserted through a real route rather than by calling the sink, because the
 * wiring is what was missing. A test that installed the sink itself would pass
 * on a composition root that installs nothing.
 */
import assert from 'node:assert/strict';
import test, { after, before, beforeEach } from 'node:test';

import { PATCH as patchRound } from '../rounds/[roundId]/route';
import {
  InMemoryAiAnalysisRunRepository,
  InMemoryAiInsightsRepository,
  InMemoryOperationalEventRepository,
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
import { uninstallObservabilitySinks } from '@/lib/server/observability-sinks';
import { reportRequestError } from '@/lib/server/request-error-report';
import { MINIMUM_PRIVACY_THRESHOLD } from '@/lib/survey-definition';
import type { SurveyResponseRecord } from '@/lib/types/backend';
import {
  DEMO_ORGANIZATION,
  DEMO_ROUND,
} from '@/lib/repositories/__fixtures__/demo-records';

const ROUND_ID = DEMO_ROUND.id;

let operationalEventRepo: InMemoryOperationalEventRepository;
let previousDatabaseUrl: string | undefined;

function responses(count: number): SurveyResponseRecord[] {
  return Array.from({ length: count }, (_unused, index) => ({
    id: `response-${index}`,
    roundId: ROUND_ID,
    answers: [],
    submittedAt: new Date('2026-08-23T09:00:00.000Z'),
  }));
}

function install() {
  operationalEventRepo = new InMemoryOperationalEventRepository();
  overrideCoreRepositories({
    aiAnalysisRunRepo: new InMemoryAiAnalysisRunRepository(),
    aiInsightsRepo: new InMemoryAiInsightsRepository(),
    operationalEventRepo,
    orgRepo: new InMemoryOrganizationRepository([DEMO_ORGANIZATION]),
    roundRepo: new InMemoryRoundRepository([{ ...DEMO_ROUND, status: 'active' }]),
    roundGoalRepo: new InMemoryRoundGoalRepository(),
    surveyRepo: new InMemorySurveyRepository(responses(MINIMUM_PRIVACY_THRESHOLD)),
  });
}

/**
 * The durable write is scheduled off the response path — `after()` on a
 * deployed runtime, a floating promise anywhere else. Outside a request scope
 * there is nothing to await, so the test gives the scheduled write a turn.
 */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

before(() => {
  previousDatabaseUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
});

after(() => {
  resetCoreRepositories();
  uninstallObservabilitySinks();
  if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = previousDatabaseUrl;
});

beforeEach(() => install());

test('a counter emitted by real work reaches the durable store', async () => {
  // Closing a round queues its analysis, and queueing emits `ai_jobs_queued`.
  // Nothing in this test touches the sink: the composition root installs it,
  // which is the part that did not exist.
  const response = await patchRound(
    new Request(`http://localhost/api/rounds/${ROUND_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'closed' }),
    }),
    { params: Promise.resolve({ roundId: ROUND_ID }) } as never,
  );
  assert.equal(response.status, 200);

  await settle();

  const queued = operationalEventRepo
    .all()
    .filter((event) => event.name === 'ai_jobs_queued');
  assert.equal(queued.length, 1);
  assert.equal(queued[0].kind, 'metric');
  assert.equal(queued[0].unit, 'count');
  assert.equal(queued[0].roundId, ROUND_ID);
});

test('a caught request error is stored with its digest and route', async () => {
  resolveCoreRepositories();
  const error = Object.assign(new Error('the connection dropped'), {
    digest: '1734829384',
  });

  reportRequestError(error, { path: '/dashboard', method: 'GET' });
  await settle();

  const [stored] = operationalEventRepo
    .all()
    .filter((event) => event.kind === 'request_error');
  assert.ok(stored, 'expected the error to be stored');
  assert.equal(stored.name, 'Error');
  assert.equal(stored.detail?.digest, '1734829384');
  assert.equal(stored.detail?.path, '/dashboard');
});

test('a sink that cannot write does not break the work it observes', async () => {
  operationalEventRepo.record = async () => {
    throw new Error('the events table is unreachable');
  };

  const response = await patchRound(
    new Request(`http://localhost/api/rounds/${ROUND_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'closed' }),
    }),
    { params: Promise.resolve({ roundId: ROUND_ID }) } as never,
  );
  await settle();

  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.round.status, 'closed');
  assert.equal(body.analysis, 'enqueued');
});
