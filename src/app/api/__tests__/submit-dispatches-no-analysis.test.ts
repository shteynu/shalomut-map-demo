/**
 * A respondent's submission reaches no provider, at any count.
 *
 * This file replaces `submit-auto-trigger.test.ts`, which asserted the
 * opposite: that crossing the privacy threshold enqueued a run, and that later
 * answers enqueued more. Owner decision 2026-08-17 moved analysis to the moment
 * a manager closes the round, and these tests hold that door shut — a
 * regression here would not throw, it would quietly start spending provider
 * calls on a round still collecting and move a school's map underneath it.
 */
import assert from 'node:assert';
import test, { after, before, beforeEach } from 'node:test';
import { POST as submitSurvey } from '../survey/[shareCode]/submit/route';
import {
  InMemoryOrganizationRepository,
  InMemoryAiAnalysisRunRepository,
  InMemoryAiInsightsRepository,
  InMemoryRoundRepository,
  InMemorySurveyRepository,
} from '@/lib/repositories';
import { overrideCoreRepositories, resetCoreRepositories } from '@/lib/composition-root';
import { surveyInstrument } from '@/lib/shalomut-source';
import {
  createCanonicalSurveyDefinition,
  MINIMUM_PRIVACY_THRESHOLD,
} from '@/lib/survey-definition';
import type { SurveyRound } from '@/lib/types/backend';

const ROUND_ID = 'submit-dispatch-round-1';
const SHARE_CODE = 'submit-dispatch-code';

let previousDatabaseUrl: string | undefined;
let aiAnalysisRunRepo: InMemoryAiAnalysisRunRepository;

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

function createRound(privacyThreshold: number): SurveyRound {
  return {
    id: ROUND_ID,
    organizationId: 'org-1',
    title: 'Submit Dispatch Test Round',
    status: 'active',
    shareCode: SHARE_CODE,
    privacyThreshold,
    startDate: new Date('2026-07-01T00:00:00.000Z'),
    createdAt: new Date('2026-07-01T00:00:00.000Z'),
    surveyDefinition: createCanonicalSurveyDefinition(
      'Submit Dispatch Test Round',
      privacyThreshold,
    ),
  };
}

function buildAnswers() {
  return surveyInstrument.questions.map((question) => ({
    questionId: question.id,
    dimensionId: question.dimensionId,
    value: 'green',
  }));
}

/** The shape `hashAnonymousToken` produces, which the endpoint now requires. */
function attemptHash(seed: number): string {
  return seed.toString(16).padStart(64, '0');
}

function submit(tokenHash: string) {
  return submitSurvey(
    new Request(`http://localhost:3000/api/survey/${SHARE_CODE}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers: buildAnswers(), anonymousTokenHash: tokenHash }),
    }),
    { params: Promise.resolve({ shareCode: SHARE_CODE }) },
  );
}

beforeEach(() => {
  aiAnalysisRunRepo = new InMemoryAiAnalysisRunRepository();
  overrideCoreRepositories({
    aiAnalysisRunRepo,
    aiInsightsRepo: new InMemoryAiInsightsRepository(),
    orgRepo: new InMemoryOrganizationRepository([
      {
        id: 'org-1',
        name: 'Submit Dispatch School',
        city: 'Tel Aviv',
        schoolType: 'elementary',
        totalStaffCount: 40,
        createdAt: new Date('2026-07-01T00:00:00.000Z'),
      },
    ]),
    roundRepo: new InMemoryRoundRepository([
      createRound(MINIMUM_PRIVACY_THRESHOLD),
    ]),
    surveyRepo: new InMemorySurveyRepository(),
  });
});

test('the submission that reaches the privacy threshold dispatches nothing', async () => {
  for (let index = 0; index < MINIMUM_PRIVACY_THRESHOLD; index += 1) {
    const response = await submit(attemptHash(index));
    assert.strictEqual(response.status, 200);
  }

  assert.deepStrictEqual(
    await aiAnalysisRunRepo.findByRoundId(ROUND_ID),
    [],
    'crossing the threshold must not queue a run while the round is open',
  );
});

test('answers beyond the threshold dispatch nothing either', async () => {
  for (let index = 0; index < MINIMUM_PRIVACY_THRESHOLD + 5; index += 1) {
    assert.strictEqual((await submit(attemptHash(index))).status, 200);
  }

  assert.deepStrictEqual(await aiAnalysisRunRepo.findByRoundId(ROUND_ID), []);
});

test('the answers themselves are still stored, so nothing was traded for the silence', async () => {
  await submit(attemptHash(0xa));
  await submit(attemptHash(0xb));

  const { surveyRepo } = (
    await import('@/lib/composition-root')
  ).resolveCoreRepositories();
  assert.strictEqual(await surveyRepo.getResponseCount(ROUND_ID), 2);
});
