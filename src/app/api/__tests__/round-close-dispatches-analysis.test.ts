/**
 * Closing a round is what asks for its analysis.
 *
 * The module that dispatches is tested on its own; what these tests hold is the
 * wiring — that the status write and the dispatch are the same manager action,
 * and that the dispatch cannot cost the close. A round the manager meant to
 * close must end up closed even when nothing could be queued, because
 * collection has ended either way and the re-analysis button is the way back.
 */
import assert from 'node:assert/strict';
import test, { after, before, beforeEach } from 'node:test';

import { PATCH as patchRound } from '../rounds/[roundId]/route';
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
let aiAnalysisRunRepo: InMemoryAiAnalysisRunRepository;

function responses(count: number): SurveyResponseRecord[] {
  return Array.from({ length: count }, (_unused, index) => ({
    id: `response-${index}`,
    roundId: ROUND_ID,
    answers: [],
    submittedAt: new Date('2026-08-17T09:00:00.000Z'),
  }));
}

function install({
  status = 'active' as RoundStatus,
  responseCount = MINIMUM_PRIVACY_THRESHOLD,
} = {}) {
  aiAnalysisRunRepo = new InMemoryAiAnalysisRunRepository();
  overrideCoreRepositories({
    aiAnalysisRunRepo,
    orgRepo: new InMemoryOrganizationRepository([DEMO_ORGANIZATION]),
    roundRepo: new InMemoryRoundRepository([{ ...DEMO_ROUND, status }]),
    roundGoalRepo: new InMemoryRoundGoalRepository(),
    surveyRepo: new InMemorySurveyRepository(responses(responseCount)),
    aiInsightsRepo: new InMemoryAiInsightsRepository(),
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
  install();
});

function patch(status: RoundStatus) {
  return patchRound(
    new Request(`http://localhost/api/rounds/${ROUND_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    }),
    params(),
  );
}

test('closing a round above the threshold queues exactly one analysis run', async () => {
  const response = await patch('closed');
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.round.status, 'closed');
  assert.equal(body.analysis, 'enqueued');

  const runs = await aiAnalysisRunRepo.findByRoundId(ROUND_ID);
  assert.equal(runs.length, 1);
  assert.equal(runs[0].trigger, 'closure');
});

test('closing a round short of the threshold closes it and queues nothing', async () => {
  install({ responseCount: MINIMUM_PRIVACY_THRESHOLD - 1 });

  const response = await patch('closed');
  const body = await response.json();

  assert.equal(body.round.status, 'closed');
  assert.equal(body.analysis, 'below_threshold');
  assert.deepEqual(await aiAnalysisRunRepo.findByRoundId(ROUND_ID), []);
});

test('a round that cannot queue its analysis is still closed', async () => {
  install();
  aiAnalysisRunRepo.enqueue = async () => {
    throw new Error('the queue is unreachable');
  };

  const response = await patch('closed');
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.round.status, 'closed');
  assert.equal(body.analysis, 'not_dispatched');
});

test('archiving a round dispatches nothing, because only closing asks', async () => {
  const response = await patch('archived');
  const body = await response.json();

  assert.equal(body.round.status, 'archived');
  assert.equal(body.analysis, undefined);
  assert.deepEqual(await aiAnalysisRunRepo.findByRoundId(ROUND_ID), []);
});

test('reopening a closed round dispatches nothing on the way back', async () => {
  install({ status: 'closed' });

  const response = await patch('active');
  const body = await response.json();

  assert.equal(body.round.status, 'active');
  assert.deepEqual(await aiAnalysisRunRepo.findByRoundId(ROUND_ID), []);
});
