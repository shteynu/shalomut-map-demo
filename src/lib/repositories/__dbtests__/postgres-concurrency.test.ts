/**
 * Concurrency and idempotency against a real PostgreSQL.
 *
 * These are deliberately outside `__tests__`, so `scripts/run-tests.mjs` does
 * not collect them and `npm test` stays runnable without a database. They are
 * run by `npm run verify:db`, which points them at a disposable database and
 * applies the migrations first.
 *
 * The in-memory repository passes the same duplicate contract, but it is
 * single-threaded and cannot race. Only this file proves the database refuses
 * a parallel duplicate, which is the whole point of the unique index.
 */
import assert from 'node:assert';
import test, { after, before, beforeEach } from 'node:test';
import { randomUUID } from 'node:crypto';

import {
  PrismaOrganizationRepository,
  PrismaRoundRepository,
  PrismaSurveyRepository,
} from '..';
import { MinimalPrismaClient } from '../prisma/prisma-client';
import { DuplicateResponseError } from '../errors';
import { ALREADY_SUBMITTED_ERROR, SurveyService } from '../../services/survey.service';
import { createCanonicalSurveyDefinition } from '../../survey-definition';
import { surveyInstrument } from '../../shalomut-source';
import { AnswerValue } from '../../types/backend';

const connectionString = process.env.TEST_DATABASE_URL;

if (!connectionString) {
  throw new Error(
    'TEST_DATABASE_URL is required for the PostgreSQL suite. ' +
      'Run it through `npm run verify:db`, which supplies one.',
  );
}

let pool: { end: () => Promise<void> };
let prisma: MinimalPrismaClient & { $disconnect?: () => Promise<void> };
let orgRepo: PrismaOrganizationRepository;
let roundRepo: PrismaRoundRepository;
let surveyRepo: PrismaSurveyRepository;

let organizationId: string;
let roundId: string;

const questions = surveyInstrument.questions.map((question) => ({
  id: question.id,
  kind: 'analytic' as const,
  dimensionId: question.dimensionId,
  scaleId: 'wellbeing-colour' as const,
  polarity: 'positive' as const,
  required: true,
}));

function answersForAllQuestions() {
  return questions.map((question) => ({
    questionId: question.id,
    dimensionId: question.dimensionId,
    value: 'green' as AnswerValue,
  }));
}

before(async () => {
  const { PrismaClient } = require('@prisma/client');
  const { PrismaPg } = require('@prisma/adapter-pg');
  const { Pool } = require('pg');

  pool = new Pool({ connectionString });
  prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  orgRepo = new PrismaOrganizationRepository(prisma);
  roundRepo = new PrismaRoundRepository(prisma);
  surveyRepo = new PrismaSurveyRepository(prisma);
});

after(async () => {
  await prisma.$disconnect?.();
  await pool.end();
});

beforeEach(async () => {
  // Cascades reach responses and answers, so clearing organizations empties
  // the whole graph. The database this points at is disposable by design.
  await prisma.organization.deleteMany({});

  organizationId = randomUUID();
  roundId = randomUUID();

  await orgRepo.create({
    id: organizationId,
    name: 'בית ספר לבדיקה',
    city: 'חיפה',
    schoolType: 'יסודי',
    totalStaffCount: 40,
    createdAt: new Date(),
  });

  await roundRepo.create({
    id: roundId,
    organizationId,
    title: 'סבב בדיקת מקביליות',
    status: 'active',
    shareCode: `TEST-${roundId.slice(0, 8)}`,
    privacyThreshold: 10,
    startDate: new Date(),
    surveyDefinition: createCanonicalSurveyDefinition('סבב בדיקת מקביליות', 10),
    createdAt: new Date(),
  });
});

test('parallel submissions of one filling session create exactly one response', async () => {
  const tokenHash = randomUUID();
  const parallelRequests = 8;

  const results = await Promise.all(
    Array.from({ length: parallelRequests }, () =>
      SurveyService.submitAndSaveResponse(
        {
          roundId,
          answers: answersForAllQuestions(),
          anonymousTokenHash: tokenHash,
        },
        surveyRepo,
        questions,
      ),
    ),
  );

  const accepted = results.filter((result) => result.success);
  const refused = results.filter((result) => !result.success);

  assert.strictEqual(accepted.length, 1, 'exactly one submission may be accepted');
  assert.strictEqual(refused.length, parallelRequests - 1);

  const stored = await surveyRepo.findResponsesByRoundId(roundId);
  assert.strictEqual(stored.length, 1, 'the database must hold one response');
  assert.strictEqual(stored[0].anonymousTokenHash, tokenHash);
});

test('a losing parallel request is told it already submitted, not that it failed', async () => {
  const tokenHash = randomUUID();

  const results = await Promise.all(
    Array.from({ length: 4 }, () =>
      SurveyService.submitAndSaveResponse(
        { roundId, answers: answersForAllQuestions(), anonymousTokenHash: tokenHash },
        surveyRepo,
        questions,
      ),
    ),
  );

  for (const result of results.filter((candidate) => !candidate.success)) {
    assert.strictEqual(
      result.error,
      ALREADY_SUBMITTED_ERROR,
      'the loser gets the ordinary duplicate answer',
    );
    // The message a respondent sees must not carry database vocabulary.
    assert.doesNotMatch(String(result.error), /unique|constraint|P2002|index/i);
  }
});

test('the repository reports a duplicate as a domain error, not a Prisma code', async () => {
  const tokenHash = randomUUID();
  const record = {
    id: randomUUID(),
    roundId,
    anonymousTokenHash: tokenHash,
    submittedAt: new Date(),
    answers: questions.map((question) => ({
      questionId: question.id,
      dimensionId: question.dimensionId,
      value: 'green' as AnswerValue,
      score: 100 as const,
    })),
  };

  await surveyRepo.saveResponse(record);

  await assert.rejects(
    () => surveyRepo.saveResponse({ ...record, id: randomUUID() }),
    (error: unknown) => {
      assert.ok(
        error instanceof DuplicateResponseError,
        `expected DuplicateResponseError, got ${String(error)}`,
      );
      return true;
    },
  );
});

test('submissions without a token are not deduplicated against each other', async () => {
  // PostgreSQL treats NULLs as distinct, and a submission with no token has no
  // filling session to deduplicate. This states that on purpose: the unique
  // index must not turn "no token" into "one response per round".
  const results = await Promise.all(
    Array.from({ length: 3 }, () =>
      SurveyService.submitAndSaveResponse(
        { roundId, answers: answersForAllQuestions() },
        surveyRepo,
        questions,
      ),
    ),
  );

  assert.ok(
    results.every((result) => result.success),
    'a token-less submission is unaffected by the unique index',
  );

  const stored = await surveyRepo.findResponsesByRoundId(roundId);
  assert.strictEqual(stored.length, 3);
});

test('a response cannot hold two answers for one question', async () => {
  const responseId = randomUUID();

  await assert.rejects(
    () =>
      prisma.surveyResponse.create({
        data: {
          id: responseId,
          roundId,
          anonymousTokenHash: randomUUID(),
          submittedAt: new Date(),
          answers: {
            create: [
              {
                questionId: 'q1',
                dimensionId: 'self-expression',
                value: 'green',
                score: 100,
              },
              {
                questionId: 'q1',
                dimensionId: 'self-expression',
                value: 'red',
                score: 0,
              },
            ],
          },
        },
      }),
    (error: unknown) => {
      assert.strictEqual((error as { code?: string }).code, 'P2002');
      return true;
    },
  );

  // The nested create is one transaction, so the refused answer takes the
  // response down with it rather than leaving a half-written row.
  const stored = await surveyRepo.findResponsesByRoundId(roundId);
  assert.strictEqual(stored.length, 0);
});

test('a response and its answers are written together or not at all', async () => {
  const results = await SurveyService.submitAndSaveResponse(
    {
      roundId,
      answers: answersForAllQuestions(),
      anonymousTokenHash: randomUUID(),
    },
    surveyRepo,
    questions,
  );

  assert.ok(results.success);

  const stored = await surveyRepo.findResponsesByRoundId(roundId);
  assert.strictEqual(stored.length, 1);
  assert.strictEqual(stored[0].answers.length, questions.length);
});
