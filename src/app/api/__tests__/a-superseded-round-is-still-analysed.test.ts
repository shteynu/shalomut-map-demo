/**
 * A round its successor closed is still a closed round.
 *
 * Closing a round is what asks for its analysis (owner decision 2026-08-17),
 * and one school runs one round at a time (owner decision 2026-08-03). Those
 * two met badly: publishing the next questionnaire closes the round the school
 * was running, and that close asked for nothing. The round could never ask
 * again either — `closed → closed` is not a transition — so the map of a
 * finished round was lost to an action taken on a different round.
 *
 * These hold the builder path to the same rule the PATCH route already keeps:
 * a confirmed close dispatches, the threshold still decides, and the dispatch
 * cannot cost the activation.
 */
import assert from 'node:assert/strict';
import test, { after, before, beforeEach } from 'node:test';

import { PUT as saveSurveyDefinition } from '../rounds/[roundId]/survey-definition/route';
import {
  InMemoryAiAnalysisRunRepository,
  InMemoryAiInsightsRepository,
  InMemoryOrganizationRepository,
  InMemoryRoundGoalRepository,
  InMemoryRoundRepository,
  InMemorySurveyDefinitionVersionRepository,
  InMemorySurveyRepository,
} from '@/lib/repositories';
import { InMemoryAuditLogRepository } from '@/lib/auth/domain-contract';
import {
  overrideCoreRepositories,
  resetCoreRepositories,
} from '@/lib/composition-root';
import {
  MINIMUM_PRIVACY_THRESHOLD,
  createCanonicalSurveyDefinition,
} from '@/lib/survey-definition';
import type { SurveyResponseRecord, SurveyRound } from '@/lib/types/backend';
import {
  DEMO_ORGANIZATION,
  DEMO_ROUND,
} from '@/lib/repositories/__fixtures__/demo-records';

/** The draft being published, and the round it takes over from. */
const NEXT_ID = DEMO_ROUND.id;
const RUNNING_ID = 'round-the-school-is-running';

const DEFINITION = createCanonicalSurveyDefinition('רבעון ב׳', 10);

let aiAnalysisRunRepo: InMemoryAiAnalysisRunRepository;
let roundRepo: InMemoryRoundRepository;
let previousDatabaseUrl: string | undefined;

/** Answers belonging to the running round — the one about to be superseded. */
function responses(count: number): SurveyResponseRecord[] {
  return Array.from({ length: count }, (_unused, index) => ({
    id: `response-${index}`,
    roundId: RUNNING_ID,
    answers: [],
    submittedAt: new Date('2026-08-23T09:00:00.000Z'),
  }));
}

function running(): SurveyRound {
  return {
    ...DEMO_ROUND,
    id: RUNNING_ID,
    title: 'סבב שכבר רץ',
    shareCode: 'SHALOM-RUNNING',
    status: 'active',
  };
}

function install({ responseCount = MINIMUM_PRIVACY_THRESHOLD } = {}) {
  aiAnalysisRunRepo = new InMemoryAiAnalysisRunRepository();
  roundRepo = new InMemoryRoundRepository([
    { ...DEMO_ROUND, status: 'draft', surveyDefinition: undefined },
    running(),
  ]);

  overrideCoreRepositories({
    aiAnalysisRunRepo,
    aiInsightsRepo: new InMemoryAiInsightsRepository(),
    auditLogRepo: new InMemoryAuditLogRepository(),
    orgRepo: new InMemoryOrganizationRepository([DEMO_ORGANIZATION]),
    roundRepo,
    roundGoalRepo: new InMemoryRoundGoalRepository(),
    surveyRepo: new InMemorySurveyRepository(responses(responseCount)),
    surveyDefinitionVersionRepo: new InMemorySurveyDefinitionVersionRepository(),
  });
}

before(() => {
  previousDatabaseUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
});

after(() => {
  resetCoreRepositories();
  if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = previousDatabaseUrl;
});

beforeEach(() => install());

/** Saving a complete questionnaire on a draft is what puts the round live. */
function publish() {
  return saveSurveyDefinition(
    new Request(`http://localhost/api/rounds/${NEXT_ID}/survey-definition`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(DEFINITION),
    }),
    { params: Promise.resolve({ roundId: NEXT_ID }) },
  );
}

test('publishing the next round queues the analysis of the one it replaced', async () => {
  const response = await publish();
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.deepEqual(body.closedRoundTitles, ['סבב שכבר רץ']);
  assert.equal((await roundRepo.findById(RUNNING_ID))?.status, 'closed');

  const runs = await aiAnalysisRunRepo.findByRoundId(RUNNING_ID);
  assert.equal(runs.length, 1);
  assert.equal(runs[0].trigger, 'closure');
});

test('the round that went live is not analysed, because it just started', async () => {
  await publish();

  assert.equal((await roundRepo.findById(NEXT_ID))?.status, 'active');
  assert.deepEqual(await aiAnalysisRunRepo.findByRoundId(NEXT_ID), []);
});

test('a superseded round short of its threshold queues nothing', async () => {
  install({ responseCount: MINIMUM_PRIVACY_THRESHOLD - 1 });

  const response = await publish();

  assert.equal(response.status, 200);
  assert.equal((await roundRepo.findById(RUNNING_ID))?.status, 'closed');
  assert.deepEqual(await aiAnalysisRunRepo.findByRoundId(RUNNING_ID), []);
});

test('a dispatch that could not be written does not cost the activation', async () => {
  aiAnalysisRunRepo.enqueue = async () => {
    throw new Error('the queue is unreachable');
  };

  const response = await publish();
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal((await roundRepo.findById(NEXT_ID))?.status, 'active');
});

test('an activation that was refused still analyses the round it closed', async () => {
  // The running round is closed before the next one goes live, so a refused
  // activation leaves a school with no live round and one round that really
  // did stop collecting. That round is finished either way, and it is the one
  // with the answers worth a map.
  roundRepo.updateStatus = async (id, status, expectedCurrent) =>
    status === 'active'
      ? { outcome: 'write_failed', reason: 'the connection dropped' }
      : InMemoryRoundRepository.prototype.updateStatus.call(
          roundRepo,
          id,
          status,
          expectedCurrent,
        );

  const response = await publish();
  const body = await response.json();

  assert.equal(response.status, 500);
  assert.deepEqual(body.closedRoundTitles, ['סבב שכבר רץ']);

  const runs = await aiAnalysisRunRepo.findByRoundId(RUNNING_ID);
  assert.equal(runs.length, 1);
  assert.equal(runs[0].trigger, 'closure');
});
