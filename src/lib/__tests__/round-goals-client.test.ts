import assert from 'node:assert';
import test from 'node:test';

import {
  createRoundGoal,
  loadRoundGoals,
  removeRoundGoal,
  updateRoundGoalStatus,
} from '../round-goals-client';

const GOAL = {
  id: 'goal-1',
  roundId: 'round-1',
  dimensionId: 'balance',
  title: 'יום ללא ישיבות',
  body: 'לקבוע יום קבוע בשבוע.',
  status: 'selected' as const,
  createdAt: '2026-08-04T09:00:00.000Z',
  updatedAt: '2026-08-04T09:00:00.000Z',
};

function respondWith(status: number, body: unknown) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetcher = (async (url: any, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  }) as unknown as typeof fetch;

  return { fetcher, calls };
}

test('the goals of a round are read from the round-scoped path', async () => {
  const { fetcher, calls } = respondWith(200, {
    roundId: 'round-1',
    goals: [GOAL],
  });

  const result = await loadRoundGoals('round-1', fetcher);

  assert.strictEqual(result.status, 'ready');
  assert.strictEqual(result.status === 'ready' && result.goals.length, 1);
  assert.strictEqual(calls[0].url, '/api/rounds/round-1/goals');
});

test('a failed read reports the failure instead of an empty list', async () => {
  const { fetcher } = respondWith(500, { error: 'boom' });

  const result = await loadRoundGoals('round-1', fetcher);

  assert.deepStrictEqual(result, { status: 'error', error: 'boom' });
});

test('a second choice of the same recommendation resolves to the goal that exists', async () => {
  // The endpoint answers 409 and returns the goal, so a double-tapped button
  // reconciles to the truth rather than showing an error the manager caused
  // nothing to produce.
  const { fetcher } = respondWith(409, {
    error: 'already',
    code: 'goal_already_exists',
    goal: GOAL,
  });

  const result = await createRoundGoal(
    'round-1',
    { dimensionId: 'balance', title: GOAL.title, body: GOAL.body },
    fetcher,
  );

  assert.strictEqual(result.status, 'duplicate');
  assert.strictEqual(result.status === 'duplicate' && result.goal.id, 'goal-1');
});

test('a created goal comes back as created', async () => {
  const { fetcher, calls } = respondWith(201, { goal: GOAL });

  const result = await createRoundGoal(
    'round-1',
    { dimensionId: 'balance', title: GOAL.title, body: GOAL.body },
    fetcher,
  );

  assert.strictEqual(result.status, 'created');
  assert.strictEqual(calls[0].init?.method, 'POST');
});

test('a rejected status change is reported and carries no goal', async () => {
  const { fetcher } = respondWith(404, { error: 'Goal not found for this round.' });

  const result = await updateRoundGoalStatus('round-1', 'goal-1', 'done', fetcher);

  assert.deepStrictEqual(result, {
    status: 'error',
    error: 'Goal not found for this round.',
  });
});

test('a status change that succeeded returns the stored goal', async () => {
  const { fetcher, calls } = respondWith(200, {
    goal: { ...GOAL, status: 'in_progress' },
  });

  const result = await updateRoundGoalStatus(
    'round-1',
    'goal-1',
    'in_progress',
    fetcher,
  );

  assert.strictEqual(result.status, 'ok');
  assert.strictEqual(result.status === 'ok' && result.goal.status, 'in_progress');
  assert.strictEqual(calls[0].init?.method, 'PATCH');
  assert.strictEqual(calls[0].url, '/api/rounds/round-1/goals/goal-1');
});

test('removing a goal reports whether the server actually removed it', async () => {
  const removed = respondWith(200, { deleted: true });
  assert.deepStrictEqual(await removeRoundGoal('round-1', 'goal-1', removed.fetcher), {
    status: 'ok',
  });
  assert.strictEqual(removed.calls[0].init?.method, 'DELETE');

  const missing = respondWith(404, { error: 'Goal not found for this round.' });
  assert.deepStrictEqual(
    await removeRoundGoal('round-1', 'goal-1', missing.fetcher),
    { status: 'error', error: 'Goal not found for this round.' },
  );
});
