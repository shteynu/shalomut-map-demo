import assert from 'node:assert';
import test, { after, before } from 'node:test';
import { POST as submitSurvey } from '../survey/[shareCode]/submit/route';
import {
  InMemoryOrganizationRepository,
  InMemoryAiAnalysisRunRepository,
  InMemoryRoundRepository,
  InMemorySurveyRepository,
  resetDefaultRepositories,
  setRepositories,
} from '@/lib/repositories';
import { surveyInstrument } from '@/lib/shalomut-source';
import {
  createCanonicalSurveyDefinition,
  MINIMUM_PRIVACY_THRESHOLD,
} from '@/lib/survey-definition';
import type { SurveyRound } from '@/lib/types/backend';

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
  resetDefaultRepositories();
});

function createRound(privacyThreshold: number): SurveyRound {
  return {
    id: 'auto-trigger-round-1',
    organizationId: 'org-1',
    title: 'Auto Trigger Test Round',
    status: 'active',
    shareCode: 'auto-trigger-code',
    privacyThreshold,
    startDate: new Date('2026-07-01T00:00:00.000Z'),
    createdAt: new Date('2026-07-01T00:00:00.000Z'),
    surveyDefinition: createCanonicalSurveyDefinition(
      'Auto Trigger Test Round',
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

function submit(tokenHash?: string) {
  return submitSurvey(
    new Request('http://localhost:3000/api/survey/auto-trigger-code/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers: buildAnswers(), anonymousTokenHash: tokenHash }),
    }),
    { params: Promise.resolve({ shareCode: 'auto-trigger-code' }) },
  );
}

/** Ten submissions: what it takes to reach the required threshold. */
async function submitUpToThreshold() {
  for (let index = 0; index < MINIMUM_PRIVACY_THRESHOLD; index += 1) {
    const response = await submit(`token-${index}`);
    assert.strictEqual(response.status, 200);
  }
}

test('durably enqueues AI analytics when submission reaches the privacy threshold', async () => {
  const aiAnalysisRunRepo = new InMemoryAiAnalysisRunRepository();
  setRepositories({
    aiAnalysisRunRepo,
    roundRepo: new InMemoryRoundRepository([createRound(1)]),
    surveyRepo: new InMemorySurveyRepository(),
    orgRepo: new InMemoryOrganizationRepository(),
  });

  // The round is stored at 1, from before ten became mandatory. It is read at
  // ten regardless, so nothing dispatches until the tenth answer arrives.
  await submitUpToThreshold();

  const run = await aiAnalysisRunRepo.findLatestByRoundId('auto-trigger-round-1');
  assert.strictEqual(run?.state, 'queued');
  assert.strictEqual(run?.trigger, 'automatic');
  assert.strictEqual(run?.requestKey, 'automatic');
});

test('does not enqueue AI analytics below the privacy threshold', async () => {
  const aiAnalysisRunRepo = new InMemoryAiAnalysisRunRepository();
  setRepositories({
    aiAnalysisRunRepo,
    roundRepo: new InMemoryRoundRepository([createRound(10)]),
    surveyRepo: new InMemorySurveyRepository(),
    orgRepo: new InMemoryOrganizationRepository(),
  });

  const response = await submit('token-a');
  assert.strictEqual(response.status, 200);

  assert.strictEqual(
    await aiAnalysisRunRepo.findLatestByRoundId('auto-trigger-round-1'),
    null,
  );
});

test('enqueues one automatic run only, however many responses arrive', async () => {
  const roundRepo = new InMemoryRoundRepository([createRound(1)]);
  const aiAnalysisRunRepo = new InMemoryAiAnalysisRunRepository();
  setRepositories({
    aiAnalysisRunRepo,
    roundRepo,
    surveyRepo: new InMemorySurveyRepository(),
    orgRepo: new InMemoryOrganizationRepository(),
  });

  // Concurrent submissions race for the same dispatch claim.
  await submitUpToThreshold();
  await Promise.all([submit('token-x'), submit('token-y'), submit('token-z')]);
  const first = await aiAnalysisRunRepo.findLatestByRoundId('auto-trigger-round-1');
  assert.ok(first);

  // A later submission on a round that already has a persisted result must not
  // regenerate it automatically; that is the manager's explicit action.
  await roundRepo.saveAiInsights('auto-trigger-round-1', { status: 'success' });
  await submit('token-d');
  const afterResult = await aiAnalysisRunRepo.findLatestByRoundId(
    'auto-trigger-round-1',
  );
  assert.strictEqual(afterResult?.id, first.id);
});
