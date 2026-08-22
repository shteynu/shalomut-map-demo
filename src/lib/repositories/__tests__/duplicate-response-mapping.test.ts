/**
 * How a `P2002` becomes "already submitted".
 *
 * The PostgreSQL suite proves the database refuses the duplicate; this pins the
 * translation, because the shape of the error depends on how the client reached
 * the database. The deployed runtime is adapter-backed and reports the
 * constraint under `meta.driverAdapterError`, leaving `meta.target` undefined —
 * a mapping that reads only `meta.target` compiles, passes a mock-based test and
 * still answers every real duplicate with a 500.
 */
import assert from 'node:assert';
import test from 'node:test';

import { PrismaSurveyRepository } from '../prisma/prisma-survey.repository';
import { MinimalPrismaClient } from '../prisma/prisma-client';
import { DuplicateResponseError } from '../errors';
import { ALREADY_SUBMITTED_ERROR, SurveyService } from '../../services/survey.service';
import { SurveyResponseRecord } from '../../types/backend';

function uniqueViolation(meta: Record<string, unknown>) {
  const error = new Error('Unique constraint failed') as Error & {
    code: string;
    meta: Record<string, unknown>;
  };
  error.code = 'P2002';
  error.meta = meta;
  return error;
}

/** The adapter-backed shape, copied from a real `@prisma/adapter-pg` failure. */
const DRIVER_ADAPTER_META = {
  modelName: 'SurveyResponse',
  driverAdapterError: {
    name: 'DriverAdapterError',
    cause: {
      originalCode: '23505',
      kind: 'UniqueConstraintViolation',
      constraint: { fields: ['round_id', 'anonymous_token_hash'] },
    },
  },
};

function repositoryThatThrows(error: unknown): PrismaSurveyRepository {
  const prisma = {
    surveyResponse: {
      create: async () => {
        throw error;
      },
      findMany: async () => [],
      findFirst: async () => null,
      count: async () => 0,
      deleteMany: async () => ({ count: 0 }),
    },
  } as unknown as MinimalPrismaClient;

  return new PrismaSurveyRepository(prisma);
}

const record: SurveyResponseRecord = {
  id: 'response-1',
  roundId: 'round-1',
  anonymousTokenHash: 'd'.repeat(64),
  submittedAt: new Date('2026-07-30T10:00:00.000Z'),
  answers: [],
};

test('the adapter-backed unique violation maps to DuplicateResponseError', async () => {
  const repo = repositoryThatThrows(uniqueViolation(DRIVER_ADAPTER_META));

  await assert.rejects(
    () => repo.saveResponse(record),
    (error: unknown) => error instanceof DuplicateResponseError,
  );
});

test('the index-name form maps to DuplicateResponseError', async () => {
  const repo = repositoryThatThrows(
    uniqueViolation({
      driverAdapterError: {
        cause: {
          constraint: {
            index: 'survey_responses_round_id_anonymous_token_hash_key',
          },
        },
      },
    }),
  );

  await assert.rejects(
    () => repo.saveResponse(record),
    (error: unknown) => error instanceof DuplicateResponseError,
  );
});

test('the non-adapter meta.target form maps to DuplicateResponseError', async () => {
  const repo = repositoryThatThrows(
    uniqueViolation({ target: ['round_id', 'anonymous_token_hash'] }),
  );

  await assert.rejects(
    () => repo.saveResponse(record),
    (error: unknown) => error instanceof DuplicateResponseError,
  );
});

test('a unique violation on another constraint is not called a duplicate', async () => {
  // The share code is unique too. Reporting that as "already submitted" would
  // hide a real defect behind a reassuring message.
  const original = uniqueViolation({
    driverAdapterError: {
      cause: { constraint: { fields: ['share_code'] } },
    },
  });
  const repo = repositoryThatThrows(original);

  await assert.rejects(
    () => repo.saveResponse(record),
    (error: unknown) => {
      assert.ok(!(error instanceof DuplicateResponseError));
      assert.strictEqual(error, original);
      return true;
    },
  );
});

test('a non-P2002 failure is left alone', async () => {
  const original = new Error('connection reset');
  const repo = repositoryThatThrows(original);

  await assert.rejects(
    () => repo.saveResponse(record),
    (error: unknown) => error === original,
  );
});

test('the service answers a lost race with the ordinary duplicate message', async () => {
  const repo = repositoryThatThrows(uniqueViolation(DRIVER_ADAPTER_META));
  // hasTokenSubmitted returns false, which is exactly the race: the check
  // passed and the write still lost.
  const surveyRepo = Object.assign(repo, {
    hasTokenSubmitted: async () => false,
  });

  const result = await SurveyService.submitAndSaveResponse(
    {
      roundId: 'round-1',
      answers: [],
      anonymousTokenHash: 'd'.repeat(64),
    },
    surveyRepo,
    [],
  );

  assert.strictEqual(result.success, false);
  assert.strictEqual(result.error, ALREADY_SUBMITTED_ERROR);
});
