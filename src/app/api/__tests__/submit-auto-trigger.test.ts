import assert from 'node:assert';
import test, { after, before, beforeEach } from 'node:test';
import { POST as submitSurvey } from '../survey/[shareCode]/submit/route';
import {
  InMemoryOrganizationRepository,
  InMemoryRoundRepository,
  InMemorySurveyRepository,
  resetDefaultRepositories,
  setRepositories,
} from '@/lib/repositories';
import { surveyInstrument } from '@/lib/shalomut-source';
import { createCanonicalSurveyDefinition } from '@/lib/survey-definition';
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

/** Background dispatch is scheduled, not awaited by the handler. */
function settleBackgroundWork() {
  return new Promise((resolve) => setTimeout(resolve, 50));
}

let webhookCalls: string[] = [];
const originalFetch = globalThis.fetch;

beforeEach(() => {
  webhookCalls = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    webhookCalls.push(input.toString());
    return new Response(JSON.stringify({ status: 'accepted' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;
});

after(() => {
  globalThis.fetch = originalFetch;
});

test('auto-triggers AI analytics when submission reaches the privacy threshold', async () => {
  setRepositories({
    roundRepo: new InMemoryRoundRepository([createRound(1)]),
    surveyRepo: new InMemorySurveyRepository(),
    orgRepo: new InMemoryOrganizationRepository(),
  });

  const response = await submit('token-a');
  assert.strictEqual(response.status, 200);

  await settleBackgroundWork();

  assert.strictEqual(webhookCalls.length, 1);
  assert.ok(webhookCalls[0]?.includes('/api/v1/webhook/events'));
});

test('does not trigger AI analytics below the privacy threshold', async () => {
  setRepositories({
    roundRepo: new InMemoryRoundRepository([createRound(3)]),
    surveyRepo: new InMemorySurveyRepository(),
    orgRepo: new InMemoryOrganizationRepository(),
  });

  const response = await submit('token-a');
  assert.strictEqual(response.status, 200);

  await settleBackgroundWork();

  assert.deepStrictEqual(webhookCalls, []);
});

test('dispatches one webhook only, however many responses arrive', async () => {
  const roundRepo = new InMemoryRoundRepository([createRound(1)]);
  setRepositories({
    roundRepo,
    surveyRepo: new InMemorySurveyRepository(),
    orgRepo: new InMemoryOrganizationRepository(),
  });

  // Concurrent submissions race for the same dispatch claim.
  await Promise.all([submit('token-a'), submit('token-b'), submit('token-c')]);
  await settleBackgroundWork();

  assert.strictEqual(webhookCalls.length, 1);

  // A later submission on a round that already has a persisted result must not
  // regenerate it automatically; that is the manager's explicit action.
  await roundRepo.saveAiInsights('auto-trigger-round-1', { status: 'success' });
  await submit('token-d');
  await settleBackgroundWork();

  assert.strictEqual(webhookCalls.length, 1);
});

test('claim lease expires so a failed dispatch does not block the round forever', async () => {
  const roundRepo = new InMemoryRoundRepository([createRound(1)]);

  assert.strictEqual(
    await roundRepo.claimAiAnalysisRun('auto-trigger-round-1', { leaseMs: 60_000 }),
    true,
  );
  assert.strictEqual(
    await roundRepo.claimAiAnalysisRun('auto-trigger-round-1', { leaseMs: 60_000 }),
    false,
  );
  assert.strictEqual(
    await roundRepo.claimAiAnalysisRun('auto-trigger-round-1', { leaseMs: 0 }),
    true,
  );

  await roundRepo.saveAiInsights('auto-trigger-round-1', { status: 'success' });

  assert.strictEqual(
    await roundRepo.claimAiAnalysisRun('auto-trigger-round-1', {
      leaseMs: 0,
      requireNoInsights: true,
    }),
    false,
  );
  assert.strictEqual(
    await roundRepo.claimAiAnalysisRun('auto-trigger-round-1', {
      leaseMs: 0,
      requireNoInsights: false,
    }),
    true,
  );
});
