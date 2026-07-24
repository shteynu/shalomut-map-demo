import assert from 'node:assert';
import test, { after, before } from 'node:test';
import { GET as getRoundAnalytics } from '../rounds/[roundId]/analytics/route';
import { GET as getRounds, POST as createRound } from '../rounds/route';
import { GET as getSurveyMeta } from '../survey/[shareCode]/route';
import { POST as submitSurvey } from '../survey/[shareCode]/submit/route';
import {
  DEMO_ORGANIZATION,
  DEMO_ROUND,
  InMemoryOrganizationRepository,
  InMemoryRoundRepository,
  InMemorySurveyRepository,
  resetDefaultRepositories,
  setRepositories,
} from '@/lib/repositories';
import { surveyInstrument } from '@/lib/shalomut-source';
import { QuestionAnswerInput } from '@/lib/types/backend';

let previousDatabaseUrl: string | undefined;

function useDemoRepositories() {
  setRepositories({
    orgRepo: new InMemoryOrganizationRepository([DEMO_ORGANIZATION]),
    roundRepo: new InMemoryRoundRepository([DEMO_ROUND]),
    surveyRepo: new InMemorySurveyRepository(),
  });
}

before(() => {
  previousDatabaseUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  useDemoRepositories();
});

after(() => {
  resetDefaultRepositories();
  if (previousDatabaseUrl === undefined) {
    delete process.env.DATABASE_URL;
  } else {
    process.env.DATABASE_URL = previousDatabaseUrl;
  }
});

function buildAnswers(): QuestionAnswerInput[] {
  return surveyInstrument.questions.map((q) => ({
    questionId: q.id,
    dimensionId: q.dimensionId,
    value: 'green',
  }));
}

test('API Route GET /api/rounds returns demo round', async () => {
  const res = await getRounds();
  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.strictEqual(data.round.shareCode, 'SHALOM-DEMO');
});

test('API Route GET /api/rounds returns an empty state instead of an implicit demo round', async () => {
  resetDefaultRepositories();

  try {
    const res = await getRounds();
    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(await res.json(), { round: null });
  } finally {
    useDemoRepositories();
  }
});

test('API Route POST /api/rounds creates a new round', async () => {
  const req = new Request('http://localhost/api/rounds', {
    method: 'POST',
    body: JSON.stringify({
      organizationId: 'org_test_1',
      title: 'סקר מחצית ב',
      privacyThreshold: 12,
    }),
  });

  const res = await createRound(req);
  assert.strictEqual(res.status, 201);
  const data = await res.json();
  assert.strictEqual(data.success, true);
  assert.strictEqual(data.round.title, 'סקר מחצית ב');
  assert.strictEqual(data.round.privacyThreshold, 12);
});

test('API Route GET /api/survey/[shareCode] returns survey metadata for valid code', async () => {
  const params = Promise.resolve({ shareCode: 'SHALOM-DEMO' });
  const req = new Request('http://localhost/api/survey/SHALOM-DEMO');

  const res = await getSurveyMeta(req, { params });
  assert.strictEqual(res.status, 200);

  const data = await res.json();
  assert.strictEqual(data.round.shareCode, 'SHALOM-DEMO');
  assert.strictEqual(data.instrument.questions.length, 24);
});

test('API Route POST /api/survey/[shareCode]/submit processes responses', async () => {
  const params = Promise.resolve({ shareCode: 'SHALOM-DEMO' });
  const req = new Request('http://localhost/api/survey/SHALOM-DEMO/submit', {
    method: 'POST',
    body: JSON.stringify({
      answers: buildAnswers(),
    }),
  });

  const res = await submitSurvey(req, { params });
  assert.strictEqual(res.status, 200);

  const data = await res.json();
  assert.strictEqual(data.success, true);
  assert.notStrictEqual(data.responseId, undefined);
});

test('API Route GET /api/rounds/[roundId]/analytics returns calculated analytics', async () => {
  const params = Promise.resolve({ roundId: 'round_demo_1' });
  const req = new Request('http://localhost/api/rounds/round_demo_1/analytics');

  const res = await getRoundAnalytics(req, { params });
  assert.strictEqual(res.status, 200);

  const data = await res.json();
  assert.strictEqual(data.analytics.roundId, 'round_demo_1');
  assert.notStrictEqual(data.analytics.privacyThreshold, undefined);
});
