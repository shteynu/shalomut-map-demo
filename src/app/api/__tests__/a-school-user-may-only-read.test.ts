/**
 * What a school user may ask the API to do, which is read.
 *
 * Owner decision, 2026-08-23: every action on a round — building its
 * questionnaire, starting it, analysing it, resetting it, and the goals chosen
 * from its results — belongs to an administrator. Phase 6 of
 * `docs/multi-tenancy-plan-2026-08-20.md`, whose text said the restrictions
 * existed in principle and their content was undecided.
 *
 * The role table has been written since 2026-08-20 with zero production
 * callers. This is the test that it now has them, and it is deliberately a list
 * of every write the manager API has rather than a sample: a route added later
 * without a permission check is exactly the failure this file exists to catch,
 * and `authorizeManagerRound` refusing to compile without an action is the
 * other half of the same guard.
 */
import assert from 'node:assert/strict';
import test, { after, before, beforeEach } from 'node:test';

import { PUT as putSetup } from '../manager/setup/route';
import { POST as suggestQuestion } from '../manager/question-suggestion/route';
import { GET as listRounds, POST as createRound } from '../rounds/route';
import { PATCH as patchRound } from '../rounds/[roundId]/route';
import { POST as resetRound } from '../rounds/[roundId]/reset/route';
import { POST as triggerAi } from '../rounds/[roundId]/trigger-ai/route';
import {
  GET as readSurveyDefinition,
  PUT as saveSurveyDefinition,
} from '../rounds/[roundId]/survey-definition/route';
import { GET as listGoals, POST as createGoal } from '../rounds/[roundId]/goals/route';
import {
  DELETE as deleteGoal,
  PATCH as patchGoal,
} from '../rounds/[roundId]/goals/[goalId]/route';
import { GET as readAnalytics } from '../rounds/[roundId]/analytics/route';
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
import { MANAGER_ROLE_HEADER } from '@/lib/server/manager-scope';
import {
  DEMO_ORGANIZATION,
  DEMO_ROUND,
} from '@/lib/repositories/__fixtures__/demo-records';

const ROUND_ID = DEMO_ROUND.id;
const GOAL_ID = 'goal-the-school-may-not-touch';

/** The header the middleware writes. A caller cannot send its own — see
 * `middleware-school-scope.test.ts`, which proves the stripping. */
let schoolUser = true;

function asSchoolUser(init: RequestInit = {}): RequestInit {
  return {
    ...init,
    headers: {
      ...(init.headers as Record<string, string>),
      [MANAGER_ROLE_HEADER]: schoolUser ? 'manager' : 'admin',
    },
  };
}

function request(path: string, init: RequestInit = {}) {
  return new Request(`http://localhost${path}`, asSchoolUser(init));
}

const roundParams = { params: Promise.resolve({ roundId: ROUND_ID }) };
const goalParams = {
  params: Promise.resolve({ roundId: ROUND_ID, goalId: GOAL_ID }),
};

let previousDatabaseUrl: string | undefined;

before(() => {
  previousDatabaseUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
});

after(() => {
  resetCoreRepositories();
  if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = previousDatabaseUrl;
});

beforeEach(() => {
  overrideCoreRepositories({
    aiAnalysisRunRepo: new InMemoryAiAnalysisRunRepository(),
    aiInsightsRepo: new InMemoryAiInsightsRepository(),
    auditLogRepo: new InMemoryAuditLogRepository(),
    orgRepo: new InMemoryOrganizationRepository([DEMO_ORGANIZATION]),
    roundGoalRepo: new InMemoryRoundGoalRepository(),
    roundRepo: new InMemoryRoundRepository([{ ...DEMO_ROUND, status: 'active' }]),
    surveyRepo: new InMemorySurveyRepository([]),
    surveyDefinitionVersionRepo: new InMemorySurveyDefinitionVersionRepository(),
  });
});

/** Every write the manager API has, and the call that reaches it. */
const writes: [string, () => Promise<Response>][] = [
  [
    'PUT /api/manager/setup',
    () =>
      putSetup(
        request('/api/manager/setup', {
          method: 'PUT',
          body: JSON.stringify({}),
        }),
      ),
  ],
  [
    'POST /api/manager/question-suggestion',
    () =>
      suggestQuestion(
        request('/api/manager/question-suggestion', {
          method: 'POST',
          body: JSON.stringify({ dimensionId: 'balance' }),
        }),
      ),
  ],
  [
    'POST /api/rounds',
    () =>
      createRound(
        request('/api/rounds', {
          method: 'POST',
          body: JSON.stringify({
            organizationId: DEMO_ORGANIZATION.id,
            title: 'סבב חדש',
          }),
        }),
      ),
  ],
  [
    'PATCH /api/rounds/:id',
    () =>
      patchRound(
        request(`/api/rounds/${ROUND_ID}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'closed' }),
        }),
        roundParams,
      ),
  ],
  [
    'PUT /api/rounds/:id/survey-definition',
    () =>
      saveSurveyDefinition(
        request(`/api/rounds/${ROUND_ID}/survey-definition`, {
          method: 'PUT',
          body: JSON.stringify({}),
        }),
        roundParams,
      ),
  ],
  [
    'POST /api/rounds/:id/reset',
    () =>
      resetRound(
        request(`/api/rounds/${ROUND_ID}/reset`, { method: 'POST' }),
        roundParams,
      ),
  ],
  [
    'POST /api/rounds/:id/trigger-ai',
    () =>
      triggerAi(
        request(`/api/rounds/${ROUND_ID}/trigger-ai`, { method: 'POST' }),
        roundParams,
      ),
  ],
  [
    'POST /api/rounds/:id/goals',
    () =>
      createGoal(
        request(`/api/rounds/${ROUND_ID}/goals`, {
          method: 'POST',
          body: JSON.stringify({
            dimensionId: 'balance',
            title: 'יעד',
            body: 'תיאור',
          }),
        }),
        roundParams,
      ),
  ],
  [
    'PATCH /api/rounds/:id/goals/:goalId',
    () =>
      patchGoal(
        request(`/api/rounds/${ROUND_ID}/goals/${GOAL_ID}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'done' }),
        }),
        goalParams,
      ),
  ],
  [
    'DELETE /api/rounds/:id/goals/:goalId',
    () =>
      deleteGoal(
        request(`/api/rounds/${ROUND_ID}/goals/${GOAL_ID}`, {
          method: 'DELETE',
        }),
        goalParams,
      ),
  ],
];

for (const [name, call] of writes) {
  test(`${name} is refused to a school user`, async () => {
    const response = await call();
    const body = await response.json();

    assert.equal(response.status, 403, name);
    assert.equal(body.code, 'FORBIDDEN_FOR_ROLE', name);
    // The message names no round, no school and no person. It says what the
    // reader may do instead, which is the only thing they can act on.
    assert.match(body.error, /administrator/i);
  });
}

test('a refused write changes nothing', async () => {
  // The refusals above are answers; this is the state behind them. A `403` that
  // arrived after the round had already closed would be a worse defect than no
  // check at all.
  await Promise.all(writes.map(([, call]) => call()));

  const { roundRepo, roundGoalRepo } = (
    await import('@/lib/composition-root')
  ).resolveCoreRepositories();

  assert.equal((await roundRepo.findById(ROUND_ID))?.status, 'active');
  assert.deepEqual(await roundGoalRepo.findByRoundId(ROUND_ID), []);
});

test('the same writes are not refused to an administrator', async () => {
  // The negative control. Every refusal above would also pass if the gate
  // refused everybody, and a permission model that locks the product is a
  // worse failure than one that never fires.
  for (const [name, call] of writes) {
    // Every other write here stops at a repository. This one reaches the
    // provider, and letting an administrator through it is how a test run with
    // a real key in the environment would quietly spend money. The refusal
    // above is the half that matters for this route.
    if (name.includes('question-suggestion')) continue;

    schoolUser = false;
    const response = await call();
    schoolUser = true;

    assert.notEqual(response.status, 403, name);
  }
});

/** Everything a school user is there for. */
const reads: [string, () => Promise<Response>][] = [
  ['GET /api/rounds', () => listRounds(request('/api/rounds'))],
  [
    'GET /api/rounds/:id/analytics',
    () =>
      readAnalytics(
        request(`/api/rounds/${ROUND_ID}/analytics`),
        roundParams,
      ),
  ],
  [
    'GET /api/rounds/:id/survey-definition',
    () =>
      readSurveyDefinition(
        request(`/api/rounds/${ROUND_ID}/survey-definition`),
        roundParams,
      ),
  ],
  [
    'GET /api/rounds/:id/goals',
    () => listGoals(request(`/api/rounds/${ROUND_ID}/goals`), roundParams),
  ],
];

for (const [name, call] of reads) {
  test(`${name} is still a school user's to read`, async () => {
    const response = await call();

    assert.notEqual(response.status, 403, name);
    assert.ok(response.status < 500, `${name} answered ${response.status}`);
  });
}
