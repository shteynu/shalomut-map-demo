import assert from 'node:assert';
import test, { beforeEach } from 'node:test';

import { InMemoryRoundGoalRepository } from '@/lib/repositories';
import { RoundGoalService } from '@/lib/services/round-goal.service';

const ROUND_ID = 'round-1';
const OTHER_ROUND_ID = 'round-2';

const RECOMMENDATION = {
  dimensionId: 'balance' as const,
  title: 'יום ללא ישיבות',
  body: 'לקבוע יום קבוע בשבוע ללא ישיבות צוות.',
};

let goalRepo: InMemoryRoundGoalRepository;

beforeEach(() => {
  goalRepo = new InMemoryRoundGoalRepository();
});

test('a parsed goal keeps the recommendation text and trims what surrounds it', () => {
  const parsed = RoundGoalService.parseCreateInput({
    dimensionId: 'balance',
    title: '  יום ללא ישיבות  ',
    body: '  לקבוע יום קבוע בשבוע.  ',
  });

  assert.ok(parsed.ok);
  assert.deepStrictEqual(parsed.input, {
    dimensionId: 'balance',
    title: 'יום ללא ישיבות',
    body: 'לקבוע יום קבוע בשבוע.',
  });
});

test('a goal must name one of the eight dimensions', () => {
  const parsed = RoundGoalService.parseCreateInput({
    ...RECOMMENDATION,
    dimensionId: 'wellbeing-in-general',
  });

  assert.deepStrictEqual(parsed, { ok: false, error: 'dimension_unknown' });
});

test('empty and oversized text are refused rather than truncated', () => {
  assert.deepStrictEqual(
    RoundGoalService.parseCreateInput({ ...RECOMMENDATION, title: '   ' }),
    { ok: false, error: 'title_required' },
  );
  assert.deepStrictEqual(
    RoundGoalService.parseCreateInput({ ...RECOMMENDATION, body: '' }),
    { ok: false, error: 'body_required' },
  );
  assert.deepStrictEqual(
    RoundGoalService.parseCreateInput({
      ...RECOMMENDATION,
      title: 'א'.repeat(201),
    }),
    { ok: false, error: 'title_too_long' },
  );
  assert.deepStrictEqual(
    RoundGoalService.parseCreateInput({
      ...RECOMMENDATION,
      body: 'א'.repeat(2001),
    }),
    { ok: false, error: 'body_too_long' },
  );
});

test('only the three tracked statuses are accepted', () => {
  assert.deepStrictEqual(RoundGoalService.parseStatus({ status: 'done' }), {
    ok: true,
    status: 'done',
  });
  assert.deepStrictEqual(RoundGoalService.parseStatus({ status: 'dropped' }), {
    ok: false,
    error: 'status_unknown',
  });
  assert.deepStrictEqual(RoundGoalService.parseStatus(null), {
    ok: false,
    error: 'status_unknown',
  });
});

test('a new goal starts as selected', async () => {
  const result = await RoundGoalService.createGoal(
    ROUND_ID,
    RECOMMENDATION,
    goalRepo,
  );

  assert.strictEqual(result.outcome, 'created');
  assert.strictEqual(result.goal.status, 'selected');
  assert.strictEqual(result.goal.roundId, ROUND_ID);
  assert.strictEqual(result.goal.title, RECOMMENDATION.title);
});

test('choosing the same recommendation twice returns the goal that exists', async () => {
  const first = await RoundGoalService.createGoal(
    ROUND_ID,
    RECOMMENDATION,
    goalRepo,
  );
  const second = await RoundGoalService.createGoal(
    ROUND_ID,
    RECOMMENDATION,
    goalRepo,
  );

  assert.strictEqual(second.outcome, 'duplicate');
  assert.strictEqual(second.goal.id, first.goal.id);
  assert.strictEqual((await RoundGoalService.listGoals(ROUND_ID, goalRepo)).length, 1);
});

test('the same recommendation may be tracked separately by another round', async () => {
  await RoundGoalService.createGoal(ROUND_ID, RECOMMENDATION, goalRepo);
  const other = await RoundGoalService.createGoal(
    OTHER_ROUND_ID,
    RECOMMENDATION,
    goalRepo,
  );

  assert.strictEqual(other.outcome, 'created');
});

test('a goal moves through the three statuses and keeps its text', async () => {
  const { goal } = await RoundGoalService.createGoal(
    ROUND_ID,
    RECOMMENDATION,
    goalRepo,
  );

  const started = await RoundGoalService.setStatus(
    ROUND_ID,
    goal.id,
    'in_progress',
    goalRepo,
  );
  assert.strictEqual(started?.status, 'in_progress');

  const finished = await RoundGoalService.setStatus(
    ROUND_ID,
    goal.id,
    'done',
    goalRepo,
  );
  assert.strictEqual(finished?.status, 'done');
  assert.strictEqual(finished?.title, RECOMMENDATION.title);
});

test('a goal cannot be reached through another round', async () => {
  const { goal } = await RoundGoalService.createGoal(
    ROUND_ID,
    RECOMMENDATION,
    goalRepo,
  );

  assert.strictEqual(
    await RoundGoalService.setStatus(OTHER_ROUND_ID, goal.id, 'done', goalRepo),
    null,
  );
  assert.strictEqual(
    await RoundGoalService.removeGoal(OTHER_ROUND_ID, goal.id, goalRepo),
    false,
  );
  assert.strictEqual(
    (await RoundGoalService.listGoals(ROUND_ID, goalRepo))[0].status,
    'selected',
  );
});

test('dropping a goal frees the recommendation to be chosen again', async () => {
  const { goal } = await RoundGoalService.createGoal(
    ROUND_ID,
    RECOMMENDATION,
    goalRepo,
  );

  assert.strictEqual(
    await RoundGoalService.removeGoal(ROUND_ID, goal.id, goalRepo),
    true,
  );
  assert.deepStrictEqual(await RoundGoalService.listGoals(ROUND_ID, goalRepo), []);

  const again = await RoundGoalService.createGoal(
    ROUND_ID,
    RECOMMENDATION,
    goalRepo,
  );
  assert.strictEqual(again.outcome, 'created');
});
