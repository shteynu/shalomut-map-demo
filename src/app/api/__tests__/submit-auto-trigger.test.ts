import assert from 'node:assert';
import test, { after, before } from 'node:test';
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

test('auto-triggers AI analytics when survey submission reaches privacy threshold', async () => {
  const roundRepo = new InMemoryRoundRepository([
    {
      id: 'auto-trigger-round-1',
      organizationId: 'org-1',
      title: 'Auto Trigger Test Round',
      status: 'active',
      shareCode: 'auto-trigger-code',
      privacyThreshold: 1,
      startDate: new Date(),
      surveyDefinition: createCanonicalSurveyDefinition('Auto Trigger Test Round', 1),
    },
  ]);
  const surveyRepo = new InMemorySurveyRepository();
  const orgRepo = new InMemoryOrganizationRepository();

  setRepositories({ roundRepo, surveyRepo, orgRepo });

  let fetchCalledWithUrl: string | undefined;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    fetchCalledWithUrl = input.toString();
    return new Response(JSON.stringify({ status: 'accepted' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;

  try {
    const answers = surveyInstrument.questions.map((q) => ({
      questionId: q.id,
      dimensionId: q.dimensionId,
      value: 'green',
    }));

    const response = await submitSurvey(
      new Request('http://localhost:3000/api/survey/auto-trigger-code/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      }),
      { params: Promise.resolve({ shareCode: 'auto-trigger-code' }) },
    );

    assert.strictEqual(response.status, 200);

    // Give background async trigger time to run
    await new Promise((resolve) => setTimeout(resolve, 50));

    assert.ok(fetchCalledWithUrl?.includes('/api/v1/webhook/events'), 'Expected AI service webhook to be triggered');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
