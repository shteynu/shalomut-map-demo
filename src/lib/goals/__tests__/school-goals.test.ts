import assert from 'node:assert';
import test from 'node:test';

import { buildSchoolGoalsView } from '../school-goals';
import type { RoundGoal } from '@/lib/types/round-goal';
import type { SurveyRound } from '@/lib/types/backend';

function round(
  id: string,
  title: string,
  status: SurveyRound['status'],
): SurveyRound {
  return {
    id,
    organizationId: 'org-1',
    title,
    status,
    shareCode: `CODE-${id}`,
    privacyThreshold: 10,
    startDate: new Date('2026-01-01T00:00:00.000Z'),
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  } as SurveyRound;
}

function goal(
  id: string,
  roundId: string,
  status: RoundGoal['status'],
  title = `יעד ${id}`,
): RoundGoal {
  return {
    id,
    roundId,
    dimensionId: 'balance',
    title,
    body: 'גוף ההמלצה כפי שנקרא ברגע הבחירה.',
    status,
    createdAt: new Date('2026-02-01T00:00:00.000Z'),
    updatedAt: new Date('2026-02-01T00:00:00.000Z'),
  } as RoundGoal;
}

// The manager's reading order: the current round first, the archived one after.
const ROUNDS = [round('r-now', 'סבב אביב', 'closed'), round('r-old', 'סבב סתיו', 'archived')];

test('a school with no goals has nothing in either group', () => {
  assert.deepStrictEqual(buildSchoolGoalsView(ROUNDS, []), { open: [], done: [] });
});

test('open goals and finished goals are separated', () => {
  const view = buildSchoolGoalsView(ROUNDS, [
    goal('g-1', 'r-now', 'selected'),
    goal('g-2', 'r-now', 'in_progress'),
    goal('g-3', 'r-now', 'done'),
  ]);

  assert.deepStrictEqual(
    view.open.map((row) => row.id),
    ['g-1', 'g-2'],
  );
  assert.deepStrictEqual(
    view.done.map((row) => row.id),
    ['g-3'],
  );
});

test('a goal names the round it came from, archived or not', () => {
  const view = buildSchoolGoalsView(ROUNDS, [goal('g-old', 'r-old', 'in_progress')]);

  assert.strictEqual(view.open[0].roundTitle, 'סבב סתיו');
  assert.strictEqual(view.open[0].roundStatus, 'archived');
  // The label is the one the stone carries, not the internal id.
  assert.strictEqual(view.open[0].dimensionLabel, 'איזון');
});

test('the rounds keep the order they arrived in, newest work first', () => {
  const view = buildSchoolGoalsView(ROUNDS, [
    goal('g-old', 'r-old', 'selected'),
    goal('g-new', 'r-now', 'selected'),
  ]);

  assert.deepStrictEqual(
    view.open.map((row) => row.id),
    ['g-new', 'g-old'],
  );
});

test('a goal whose round is not the school\'s is dropped rather than shown roundless', () => {
  // The repository is asked for the school's own round ids, so this should not
  // happen — and if it ever does, a goal with no round beside it would be worse
  // than a goal that is missing.
  const view = buildSchoolGoalsView(ROUNDS, [goal('g-alien', 'r-other-school', 'selected')]);

  assert.deepStrictEqual(view.open, []);
});
