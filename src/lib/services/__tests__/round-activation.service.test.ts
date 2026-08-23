import assert from 'node:assert';
import { test } from 'node:test';
import { InMemoryRoundRepository } from '@/lib/repositories';
import { createCanonicalSurveyDefinition } from '@/lib/survey-definition';
import type { SurveyRound } from '@/lib/types/backend';
import { RoundService } from '../round.service';

/**
 * One school runs one round at a time. These cover the rule at the two places
 * a round can go live: a draft whose questionnaire became complete, and a round
 * created with a complete questionnaire already in hand.
 */
function round(
  id: string,
  status: SurveyRound['status'],
  organizationId = 'org-1',
): SurveyRound {
  return {
    id,
    organizationId,
    title: id,
    status,
    shareCode: `SHALOM-${id.toUpperCase()}`,
    privacyThreshold: 10,
    startDate: new Date('2026-07-01T00:00:00.000Z'),
    createdAt: new Date('2026-07-01T00:00:00.000Z'),
  };
}

test('activating a round closes the round the school was running', async () => {
  const running = round('running', 'active');
  const next = round('next', 'draft');
  const repo = new InMemoryRoundRepository([running, next]);

  const activation = await RoundService.activateRound('next', repo);

  assert.strictEqual(activation.ok, true);
  assert.strictEqual(activation.ok ? activation.round.status : null, 'active');
  assert.deepStrictEqual(
    activation.closedRounds.map((entry) => entry.id),
    ['running'],
  );
  assert.strictEqual((await repo.findById('running'))?.status, 'closed');
});

test('a round created live closes the previous one as well', async () => {
  const running = round('running', 'active');
  const repo = new InMemoryRoundRepository([running]);

  const { round: created } = await RoundService.createAndSaveRound(
    {
      organizationId: 'org-1',
      title: 'ready from the start',
      surveyDefinition: createCanonicalSurveyDefinition('ready', 10),
    },
    repo,
  );

  assert.strictEqual(created.status, 'active');
  assert.strictEqual((await repo.findById('running'))?.status, 'closed');
});

test('a new draft leaves the running round alone', async () => {
  const running = round('running', 'active');
  const repo = new InMemoryRoundRepository([running]);

  const { round: created } = await RoundService.createAndSaveRound(
    { organizationId: 'org-1', title: 'still being built' },
    repo,
  );

  assert.strictEqual(created.status, 'draft');
  assert.strictEqual((await repo.findById('running'))?.status, 'active');
});

test('another school keeps its own active round', async () => {
  const ours = round('ours', 'draft');
  const theirs = round('theirs', 'active', 'org-2');
  const repo = new InMemoryRoundRepository([ours, theirs]);

  await RoundService.activateRound('ours', repo);

  assert.strictEqual((await repo.findById('theirs'))?.status, 'active');
});

test('closed and archived rounds are left as they are', async () => {
  const closed = round('closed', 'closed');
  const archived = round('archived', 'archived');
  const next = round('next', 'draft');
  const repo = new InMemoryRoundRepository([closed, archived, next]);

  const activation = await RoundService.activateRound('next', repo);

  assert.deepStrictEqual(activation.closedRounds, []);
  assert.strictEqual((await repo.findById('closed'))?.status, 'closed');
  assert.strictEqual((await repo.findById('archived'))?.status, 'archived');
});
