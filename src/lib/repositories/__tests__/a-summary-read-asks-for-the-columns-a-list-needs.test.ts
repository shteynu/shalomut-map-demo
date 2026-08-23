/**
 * What the round-summary query asks the database for.
 *
 * The point of `findSummariesByOrganizationIds` is the projection: a round
 * carries its whole questionnaire — 126 questions on the default instrument —
 * and its whole Stone Map, and a list of rounds needs neither. That cannot be
 * seen in what the repository returns, because it maps every row into the
 * summary shape either way; a query that selected everything would look
 * identical from the outside while pulling megabytes to show seven fields. So
 * this reads the query.
 *
 * Two callers now: the administrator console it was written for, and every
 * manager screen, whose own school's round list runs through it since ADR-051.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { PrismaRoundRepository } from '..';
import type { MinimalPrismaClient } from '../prisma/prisma-client';

function clientRecording(calls: any[]): MinimalPrismaClient {
  return {
    surveyRound: {
      findMany: async (args: any) => {
        calls.push(args);
        return [];
      },
    },
  } as unknown as MinimalPrismaClient;
}

test('a round summary is seven scalar columns, and the questionnaire is not one', async () => {
  const calls: any[] = [];
  const repo = new PrismaRoundRepository(clientRecording(calls));

  await repo.findSummariesByOrganizationIds(['org-1', 'org-2']);

  assert.equal(calls.length, 1);
  assert.deepEqual(Object.keys(calls[0].select).sort(), [
    'createdAt',
    'id',
    'organizationId',
    'privacyThreshold',
    // Added with ADR-051: the comparison walk orders rounds by when the school
    // ran them, not by when somebody created the row.
    'startDate',
    'status',
    'title',
  ]);
  assert.equal(
    calls[0].select.surveyDefinition,
    undefined,
    'the questionnaire is the reason this method exists',
  );
  assert.equal(calls[0].select.aiInsights, undefined);
  assert.equal(calls[0].include, undefined);
  assert.deepEqual(calls[0].where, {
    organizationId: { in: ['org-1', 'org-2'] },
  });
});

test('no schools means no query, not a query about none of them', async () => {
  const calls: any[] = [];
  const repo = new PrismaRoundRepository(clientRecording(calls));

  assert.deepEqual(await repo.findSummariesByOrganizationIds([]), []);
  assert.equal(calls.length, 0);
});
