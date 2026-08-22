/**
 * The submit endpoint is the only unauthenticated write in the product, and
 * until 2026-08-22 nothing bounded it: the rate limit is deliberately loose
 * because a staffroom answers from one address, and the attempt token hash —
 * the only other guard — was an optional field a caller could simply leave out.
 *
 * These are the two rules that replaced "nothing". They are not the whole
 * defence, and `src/lib/survey/response-ceiling.ts` says which part is missing.
 */
import assert from 'node:assert';
import test, { after, before, beforeEach } from 'node:test';
import { POST as submitSurvey } from '../survey/[shareCode]/submit/route';
import {
  InMemoryOrganizationRepository,
  InMemoryRoundRepository,
  InMemorySurveyRepository,
} from '@/lib/repositories';
import {
  overrideCoreRepositories,
  resetCoreRepositories,
} from '@/lib/composition-root';
import { surveyInstrument } from '@/lib/shalomut-source';
import {
  RESPONSE_CEILING_FLOOR,
  RESPONSE_CEILING_MULTIPLIER,
  responseCeiling,
} from '@/lib/survey/response-ceiling';
import { createCanonicalSurveyDefinition } from '@/lib/survey-definition';
import type { SurveyRound } from '@/lib/types/backend';

const ROUND_ID = 'ceiling-round';
const SHARE_CODE = 'CEILING-CODE';
const ORGANIZATION_ID = 'ceiling-org';

let previousDatabaseUrl: string | undefined;

before(() => {
  previousDatabaseUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
});

after(() => {
  if (previousDatabaseUrl) {
    process.env.DATABASE_URL = previousDatabaseUrl;
  } else {
    delete process.env.DATABASE_URL;
  }
  resetCoreRepositories();
});

function round(): SurveyRound {
  return {
    id: ROUND_ID,
    organizationId: ORGANIZATION_ID,
    title: 'Ceiling Round',
    status: 'active',
    shareCode: SHARE_CODE,
    privacyThreshold: 10,
    startDate: new Date('2026-08-01T00:00:00.000Z'),
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    surveyDefinition: createCanonicalSurveyDefinition('Ceiling Round', 10),
  };
}

function answers() {
  return surveyInstrument.questions.map((question) => ({
    questionId: question.id,
    dimensionId: question.dimensionId,
    value: 'green',
  }));
}

/** The shape `hashAnonymousToken` produces, without hashing anything. */
function attemptHash(seed: number): string {
  return seed.toString(16).padStart(64, '0');
}

function submit(body: Record<string, unknown>) {
  return submitSurvey(
    new Request(`http://localhost:3000/api/survey/${SHARE_CODE}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ shareCode: SHARE_CODE }) },
  );
}

/** `totalStaffCount` is what the ceiling is a multiple of. */
function useSchoolOf(totalStaffCount: number) {
  overrideCoreRepositories({
    orgRepo: new InMemoryOrganizationRepository([
      {
        id: ORGANIZATION_ID,
        name: 'Ceiling School',
        city: 'Haifa',
        schoolType: 'secondary',
        totalStaffCount,
        createdAt: new Date('2026-08-01T00:00:00.000Z'),
      },
    ]),
    roundRepo: new InMemoryRoundRepository([round()]),
    surveyRepo: new InMemorySurveyRepository(),
  });
}

beforeEach(() => {
  useSchoolOf(40);
});

test('a submission with no attempt token is refused, and stores nothing', async () => {
  const response = await submit({ answers: answers() });

  assert.strictEqual(response.status, 400);
  assert.strictEqual((await response.json()).code, 'ATTEMPT_TOKEN_REQUIRED');

  const { surveyRepo } = (
    await import('@/lib/composition-root')
  ).resolveCoreRepositories();
  assert.strictEqual(await surveyRepo.getResponseCount(ROUND_ID), 0);
});

test('a token that is not a digest is not a token', async () => {
  for (const candidate of [
    '',
    'not-a-digest',
    'A'.repeat(64), // uppercase hex: the client lowercases, so this is not ours
    'a'.repeat(63),
    'a'.repeat(65),
    ' '.concat('a'.repeat(64)),
  ]) {
    const response = await submit({
      answers: answers(),
      anonymousTokenHash: candidate,
    });
    assert.strictEqual(
      (await response.json()).code,
      'ATTEMPT_TOKEN_REQUIRED',
      JSON.stringify(candidate),
    );
  }
});

test('a round stops accepting answers at its ceiling', async () => {
  // A school of two: the multiplier alone would cap the round at six, and the
  // floor is what keeps a mistyped staff count from costing the staffroom its
  // answers.
  useSchoolOf(2);
  const ceiling = responseCeiling(2);
  assert.strictEqual(ceiling, RESPONSE_CEILING_FLOOR);

  for (let index = 0; index < ceiling; index += 1) {
    const accepted = await submit({
      answers: answers(),
      anonymousTokenHash: attemptHash(index),
    });
    assert.strictEqual(accepted.status, 200, `response ${index}`);
  }

  const refused = await submit({
    answers: answers(),
    anonymousTokenHash: attemptHash(ceiling),
  });
  assert.strictEqual(refused.status, 409);
  const body = await refused.json();
  assert.strictEqual(body.code, 'ROUND_FULL');
  // The number is in the message, because a manager reading a respondent's
  // screenshot needs to know which number stopped them.
  assert.match(body.error, new RegExp(String(ceiling)));

  const { surveyRepo } = (
    await import('@/lib/composition-root')
  ).resolveCoreRepositories();
  assert.strictEqual(await surveyRepo.getResponseCount(ROUND_ID), ceiling);
});

test('the ceiling follows the school, not the round', () => {
  // Read from the organization on every submission rather than stamped onto
  // the round when it was created, so a school that corrects its staff count
  // corrects the round it is running.
  assert.strictEqual(
    responseCeiling(200),
    200 * RESPONSE_CEILING_MULTIPLIER,
    'a large school gets the multiple, not the floor',
  );
  assert.strictEqual(responseCeiling(34), 102);
  assert.strictEqual(responseCeiling(33), RESPONSE_CEILING_FLOOR);
});

test('a staff count nobody supplied still leaves a ceiling', () => {
  // The column is a required positive integer, but this value arrives from a
  // database row rather than from a validator, and a ceiling of zero would
  // refuse every respondent in the school.
  for (const nonsense of [undefined, 0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.strictEqual(
      responseCeiling(nonsense as number | undefined),
      RESPONSE_CEILING_FLOOR,
      String(nonsense),
    );
  }
});

test('a school that grows its staff count raises the ceiling of a running round', async () => {
  useSchoolOf(2);
  for (let index = 0; index < RESPONSE_CEILING_FLOOR; index += 1) {
    await submit({ answers: answers(), anonymousTokenHash: attemptHash(index) });
  }

  assert.strictEqual(
    (
      await submit({
        answers: answers(),
        anonymousTokenHash: attemptHash(500),
      })
    ).status,
    409,
  );

  const { orgRepo } = (
    await import('@/lib/composition-root')
  ).resolveCoreRepositories();
  await orgRepo.update(ORGANIZATION_ID, { totalStaffCount: 80 });

  assert.strictEqual(
    (
      await submit({
        answers: answers(),
        anonymousTokenHash: attemptHash(501),
      })
    ).status,
    200,
    'the corrected staff count reopens the round it is running',
  );
});
