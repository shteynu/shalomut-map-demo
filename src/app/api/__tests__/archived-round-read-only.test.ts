/**
 * What an archived round refuses, and what it deliberately does not.
 *
 * `RoundService.isTransitionAllowed` called `archived` terminal long before
 * anything held it there: reset wrote the status directly, so resetting an
 * archived round returned it to `draft`. These tests are that door, closed.
 */
import assert from 'node:assert';
import test, { after, before, beforeEach } from 'node:test';

import { POST as resetRound } from '../rounds/[roundId]/reset/route';
import { POST as triggerAi } from '../rounds/[roundId]/trigger-ai/route';
import { PUT as saveSurveyDefinition } from '../rounds/[roundId]/survey-definition/route';
import { GET as listGoals, POST as createGoal } from '../rounds/[roundId]/goals/route';
import { PATCH as patchGoal } from '../rounds/[roundId]/goals/[goalId]/route';
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
import { InMemoryAuditLogRepository } from '@/lib/auth/domain-contract';
import { setAuditLogRepositoryForTests } from '@/lib/server/manager-audit';
import { createCanonicalSurveyDefinition } from '@/lib/survey-definition';
import type { RoundStatus } from '@/lib/types/backend';
import {
  DEMO_ORGANIZATION,
  DEMO_ROUND,
} from '@/lib/repositories/__fixtures__/demo-records';

const ROUND_ID = DEMO_ROUND.id;
const params = () => ({ params: Promise.resolve({ roundId: ROUND_ID }) }) as any;

let roundRepo: InMemoryRoundRepository;
let previousDatabaseUrl: string | undefined;

function install(status: RoundStatus) {
  roundRepo = new InMemoryRoundRepository([{ ...DEMO_ROUND, status }]);
  overrideCoreRepositories({
    orgRepo: new InMemoryOrganizationRepository([DEMO_ORGANIZATION]),
    roundRepo,
    roundGoalRepo: new InMemoryRoundGoalRepository(),
    surveyRepo: new InMemorySurveyRepository(),
    aiInsightsRepo: new InMemoryAiInsightsRepository(),
    aiAnalysisRunRepo: new InMemoryAiAnalysisRunRepository(),
  });
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
  install('archived');
});

function post(path: string) {
  return new Request(`http://localhost/api/rounds/${ROUND_ID}/${path}`, {
    method: 'POST',
  });
}

test('resetting an archived round is refused, so it cannot leave the archive', async () => {
  const response = await resetRound(post('reset'), params());

  assert.strictEqual(response.status, 409);
  assert.strictEqual((await response.json()).code, 'round_archived');

  const round = await roundRepo.findById(ROUND_ID);
  assert.strictEqual(round?.status, 'archived');
});

test('a closed round can still be reset, which is what made the leak invisible', async () => {
  install('closed');

  const response = await resetRound(post('reset'), params());

  assert.strictEqual(response.status, 200);
  assert.strictEqual((await roundRepo.findById(ROUND_ID))?.status, 'draft');
});

test('an archived round does not take a new analysis run', async () => {
  const response = await triggerAi(post('trigger-ai'), params());

  assert.strictEqual(response.status, 409);
  assert.strictEqual((await response.json()).code, 'round_archived');
});

test('an archived round does not take a new questionnaire', async () => {
  const response = await saveSurveyDefinition(
    new Request(`http://localhost/api/rounds/${ROUND_ID}/survey-definition`, {
      method: 'PUT',
      body: JSON.stringify(createCanonicalSurveyDefinition('שאלון חדש', 10)),
    }),
    params(),
  );

  assert.strictEqual(response.status, 409);
  assert.strictEqual((await response.json()).code, 'round_archived');
});

test('the goals of an archived round keep moving, because they are the school\'s work', async () => {
  // Owner decision 2026-08-05: the archive freezes the measurement, not what
  // the school decided to do about it. A goal chosen last spring can be
  // finished this autumn.
  const created = await createGoal(
    new Request(`http://localhost/api/rounds/${ROUND_ID}/goals`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        dimensionId: 'balance',
        title: 'יום ללא ישיבות',
        body: 'לקבוע יום קבוע בשבוע ללא ישיבות צוות.',
      }),
    }),
    params(),
  );
  assert.strictEqual(created.status, 201);
  const { goal } = await created.json();

  const patched = await patchGoal(
    new Request(`http://localhost/api/rounds/${ROUND_ID}/goals/${goal.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'done' }),
    }),
    { params: Promise.resolve({ roundId: ROUND_ID, goalId: goal.id }) } as any,
  );
  assert.strictEqual(patched.status, 200);

  const listed = await listGoals(
    new Request(`http://localhost/api/rounds/${ROUND_ID}/goals`),
    params(),
  );
  assert.strictEqual((await listed.json()).goals[0].status, 'done');
});
