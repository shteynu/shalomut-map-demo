import assert from 'node:assert';
import test, { after, before, beforeEach } from 'node:test';

import {
  DELETE as deleteGoal,
  PATCH as patchGoal,
} from '../rounds/[roundId]/goals/[goalId]/route';
import { GET as listGoals, POST as createGoal } from '../rounds/[roundId]/goals/route';
import { POST as resetRound } from '../rounds/[roundId]/reset/route';
import {
  DEMO_ORGANIZATION,
  DEMO_ROUND,
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

const ROUND_ID = DEMO_ROUND.id;

const RECOMMENDATION = {
  dimensionId: 'balance',
  title: 'יום ללא ישיבות',
  body: 'לקבוע יום קבוע בשבוע ללא ישיבות צוות.',
};

let previousDatabaseUrl: string | undefined;

function request(body?: unknown) {
  return new Request('http://localhost/api/rounds/goals', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
}

function params(goalId?: string) {
  return {
    params: Promise.resolve(
      goalId ? { roundId: ROUND_ID, goalId } : ({ roundId: ROUND_ID } as any),
    ),
  } as any;
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
  overrideCoreRepositories({
    orgRepo: new InMemoryOrganizationRepository([DEMO_ORGANIZATION]),
    roundRepo: new InMemoryRoundRepository([DEMO_ROUND]),
    roundGoalRepo: new InMemoryRoundGoalRepository(),
    surveyRepo: new InMemorySurveyRepository(),
  });
});

async function trackRecommendation() {
  const response = await createGoal(request(RECOMMENDATION), params());
  const payload = await response.json();
  return { response, goal: payload.goal };
}

test('POST creates a goal from a recommendation and starts it as selected', async () => {
  const { response, goal } = await trackRecommendation();

  assert.strictEqual(response.status, 201);
  assert.strictEqual(goal.status, 'selected');
  assert.strictEqual(goal.dimensionId, 'balance');
  assert.strictEqual(goal.title, RECOMMENDATION.title);
  assert.ok(goal.createdAt, 'the wire shape carries an ISO timestamp');
});

test('GET lists the goals of the round', async () => {
  await trackRecommendation();

  const response = await listGoals(request(), params());
  assert.strictEqual(response.status, 200);

  const payload = await response.json();
  assert.strictEqual(payload.roundId, ROUND_ID);
  assert.strictEqual(payload.goals.length, 1);
});

test('a second POST for the same recommendation answers 409 with the existing goal', async () => {
  const first = await trackRecommendation();
  const response = await createGoal(request(RECOMMENDATION), params());

  assert.strictEqual(response.status, 409);
  const payload = await response.json();
  assert.strictEqual(payload.code, 'goal_already_exists');
  assert.strictEqual(payload.goal.id, first.goal.id);
});

test('POST refuses a dimension outside the eight', async () => {
  const response = await createGoal(
    request({ ...RECOMMENDATION, dimensionId: 'morale' }),
    params(),
  );

  assert.strictEqual(response.status, 400);
  assert.strictEqual((await response.json()).code, 'dimension_unknown');
});

test('PATCH moves a goal to another status', async () => {
  const { goal } = await trackRecommendation();

  const response = await patchGoal(
    request({ status: 'in_progress' }),
    params(goal.id),
  );

  assert.strictEqual(response.status, 200);
  assert.strictEqual((await response.json()).goal.status, 'in_progress');
});

test('PATCH refuses a status outside the tracked three', async () => {
  const { goal } = await trackRecommendation();

  const response = await patchGoal(
    request({ status: 'archived' }),
    params(goal.id),
  );

  assert.strictEqual(response.status, 400);
  assert.strictEqual((await response.json()).code, 'status_unknown');
});

test('PATCH and DELETE answer 404 for a goal this round does not hold', async () => {
  const missing = '00000000-0000-0000-0000-000000000000';

  assert.strictEqual(
    (await patchGoal(request({ status: 'done' }), params(missing))).status,
    404,
  );
  assert.strictEqual(
    (await deleteGoal(request(), params(missing))).status,
    404,
  );
});

test('DELETE stops tracking the goal', async () => {
  const { goal } = await trackRecommendation();

  const response = await deleteGoal(request(), params(goal.id));
  assert.strictEqual(response.status, 200);
  assert.strictEqual((await response.json()).deleted, true);

  const listed = await (await listGoals(request(), params())).json();
  assert.deepStrictEqual(listed.goals, []);
});

test('a round that is reset keeps no goals, because it measured nothing', async () => {
  // Goals outlive a re-run analysis on purpose. Reset is the other thing: it
  // erases the measurement the goals were chosen from.
  await trackRecommendation();

  const response = await resetRound(request(), params());
  assert.strictEqual(response.status, 200);

  const listed = await (await listGoals(request(), params())).json();
  assert.deepStrictEqual(listed.goals, []);
});
