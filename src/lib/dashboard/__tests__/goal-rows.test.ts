import assert from 'node:assert';
import test from 'node:test';

import { buildGoalRows } from '../goal-rows';
import type { RoundGoalView } from '../../round-goals-client';

const RECOMMENDATIONS = [
  { title: 'יום ללא ישיבות', body: 'לקבוע יום קבוע בשבוע.' },
  { title: 'שעת צוות קבועה', body: 'לשריין שעה שבועית.' },
];

function goal(overrides: Partial<RoundGoalView> = {}): RoundGoalView {
  return {
    id: 'goal-1',
    roundId: 'round-1',
    dimensionId: 'balance',
    title: 'יום ללא ישיבות',
    body: 'לקבוע יום קבוע בשבוע.',
    status: 'selected',
    createdAt: '2026-08-04T09:00:00.000Z',
    updatedAt: '2026-08-04T09:00:00.000Z',
    ...overrides,
  };
}

test('every current recommendation gets a row, tracked or not', () => {
  const rows = buildGoalRows(RECOMMENDATIONS, [], 'balance');

  assert.strictEqual(rows.length, 2);
  assert.ok(rows.every((row) => !row.goal));
  assert.ok(rows.every((row) => !row.fromEarlierAnalysis));
});

test('a tracked recommendation carries its goal', () => {
  const rows = buildGoalRows(RECOMMENDATIONS, [goal()], 'balance');

  assert.strictEqual(rows[0].goal?.id, 'goal-1');
  assert.strictEqual(rows[0].key, 'goal-1');
  assert.strictEqual(rows[1].goal, undefined);
});

test('a goal the current analysis no longer recommends stays, and says so', () => {
  const rows = buildGoalRows(
    RECOMMENDATIONS,
    [goal({ id: 'goal-old', title: 'מפגש חודשי עם ההנהלה' })],
    'balance',
  );

  assert.strictEqual(rows.length, 3);
  const orphan = rows[2];
  assert.strictEqual(orphan.title, 'מפגש חודשי עם ההנהלה');
  assert.strictEqual(orphan.fromEarlierAnalysis, true);
  assert.strictEqual(orphan.goal?.id, 'goal-old');
});

test('goals of other dimensions are not listed on this screen', () => {
  const rows = buildGoalRows(
    RECOMMENDATIONS,
    [goal({ id: 'goal-elsewhere', dimensionId: 'meaning', title: 'משהו אחר' })],
    'balance',
  );

  assert.strictEqual(rows.length, 2);
  assert.ok(rows.every((row) => row.goal === undefined));
});

test('the current recommendations keep their order and lead the list', () => {
  const rows = buildGoalRows(
    RECOMMENDATIONS,
    [goal({ id: 'goal-old', title: 'ישן' }), goal({ id: 'goal-1' })],
    'balance',
  );

  assert.deepStrictEqual(
    rows.map((row) => row.title),
    ['יום ללא ישיבות', 'שעת צוות קבועה', 'ישן'],
  );
});
