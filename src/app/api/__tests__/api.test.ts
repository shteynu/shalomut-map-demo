import assert from 'node:assert';
import test, { after, before } from 'node:test';
import { GET as getRoundAnalytics } from '../rounds/[roundId]/analytics/route';
import { PATCH as updateRound } from '../rounds/[roundId]/route';
import { POST as resetRound } from '../rounds/[roundId]/reset/route';
import {
  GET as getSurveyDefinition,
  PUT as saveSurveyDefinition,
} from '../rounds/[roundId]/survey-definition/route';
import { GET as getRounds, POST as createRound } from '../rounds/route';
import { PUT as saveManagerSetup } from '../manager/setup/route';
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
import { InMemoryAuditLogRepository } from '@/lib/auth/domain-contract';
import { setAuditLogRepositoryForTests } from '@/lib/server/manager-audit';
import { surveyInstrument } from '@/lib/shalomut-source';
import { createCanonicalSurveyDefinition } from '@/lib/survey-definition';
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
      organizationId: DEMO_ORGANIZATION.id,
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

test('API Route POST /api/rounds rejects an organization outside the manager scope', async () => {
  const otherOrganization = {
    ...DEMO_ORGANIZATION,
    id: 'org_other_school',
    name: 'בית ספר אחר',
  };
  setRepositories({
    orgRepo: new InMemoryOrganizationRepository([
      DEMO_ORGANIZATION,
      otherOrganization,
    ]),
    roundRepo: new InMemoryRoundRepository([DEMO_ROUND]),
    surveyRepo: new InMemorySurveyRepository(),
  });

  try {
    const response = await createRound(
      new Request('http://localhost/api/rounds', {
        method: 'POST',
        headers: {
          'x-shalomut-manager-organization-id': DEMO_ORGANIZATION.id,
        },
        body: JSON.stringify({
          organizationId: otherOrganization.id,
          title: 'סקר זר',
        }),
      }),
    );

    assert.strictEqual(response.status, 404);
  } finally {
    useDemoRepositories();
  }
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

test('API Route analytics hides a round owned by another organization', async () => {
  const otherOrganization = {
    ...DEMO_ORGANIZATION,
    id: 'org_other_school',
    name: 'בית ספר אחר',
    createdAt: new Date('2026-07-25T00:00:00.000Z'),
  };
  const otherRound = {
    ...DEMO_ROUND,
    id: 'round_other_school',
    organizationId: otherOrganization.id,
    shareCode: 'SHALOM-OTHER',
  };

  setRepositories({
    orgRepo: new InMemoryOrganizationRepository([
      DEMO_ORGANIZATION,
      otherOrganization,
    ]),
    roundRepo: new InMemoryRoundRepository([DEMO_ROUND, otherRound]),
    surveyRepo: new InMemorySurveyRepository(),
  });

  try {
    const response = await getRoundAnalytics(
      new Request(
        `http://localhost/api/rounds/${otherRound.id}/analytics`,
        {
          headers: {
            'x-shalomut-manager-organization-id': DEMO_ORGANIZATION.id,
          },
        },
      ),
      { params: Promise.resolve({ roundId: otherRound.id }) },
    );

    assert.strictEqual(response.status, 404);
  } finally {
    useDemoRepositories();
  }
});

test('API Route PUT /api/manager/setup persists the first organization and round', async () => {
  resetDefaultRepositories();

  try {
    const request = new Request('http://localhost/api/manager/setup', {
      method: 'PUT',
      body: JSON.stringify({
        organization: {
          name: 'בית ספר חדש',
          city: 'חיפה',
          schoolType: 'יסודי',
          totalStaffCount: 30,
        },
        round: {
          title: 'סבב ראשון',
          privacyThreshold: 10,
          startDate: '2026-09-01',
          endDate: '',
          backgroundContext: {
            notes: '',
            audience: 'all-staff',
            sicknessDaysThisQuarter: 0,
            newStaffMembers: 0,
            studentCount: 300,
            socioEconomicIndex: 5,
            classesPerGrade: { א: 2 },
          },
        },
      }),
    });

    const response = await saveManagerSetup(request);
    assert.strictEqual(response.status, 200);
    const payload = await response.json();
    assert.strictEqual(payload.success, true);
    // Setup persists an empty draft; the questionnaire is authored afterwards.
    assert.strictEqual(payload.round.surveyDefinition.questions.length, 0);
    assert.strictEqual(payload.round.status, 'draft');
  } finally {
    useDemoRepositories();
  }
});

test('API Route PUT /api/manager/setup creates the configured scoped organization ID', async () => {
  resetDefaultRepositories();

  try {
    const scopedOrganizationId = 'org_scoped_school';
    const request = new Request('http://localhost/api/manager/setup', {
      method: 'PUT',
      headers: {
        'x-shalomut-manager-organization-id': scopedOrganizationId,
      },
      body: JSON.stringify({
        organization: {
          name: 'בית ספר משויך',
          city: 'חיפה',
          schoolType: 'יסודי',
          totalStaffCount: 30,
        },
        round: {
          title: 'סבב ראשון',
          privacyThreshold: 10,
          startDate: '2026-09-01',
          endDate: '',
          backgroundContext: {
            notes: '',
            audience: 'all-staff',
            sicknessDaysThisQuarter: 0,
            newStaffMembers: 0,
            studentCount: 300,
            socioEconomicIndex: 5,
            classesPerGrade: { א: 2 },
          },
        },
      }),
    });

    const response = await saveManagerSetup(request);
    assert.strictEqual(response.status, 200);
    const payload = await response.json();
    assert.strictEqual(payload.organization.id, scopedOrganizationId);
    assert.strictEqual(payload.round.organizationId, scopedOrganizationId);
  } finally {
    useDemoRepositories();
  }
});

test('API Route PUT /api/manager/setup fails closed on a deployment without a database', async () => {
  const previousVercelEnvironment = process.env.VERCEL_ENV;
  process.env.VERCEL_ENV = 'preview';

  try {
    const response = await saveManagerSetup(
      new Request('http://localhost/api/manager/setup', {
        method: 'PUT',
        body: JSON.stringify({}),
      }),
    );

    assert.strictEqual(response.status, 503);
    assert.match(
      (await response.json()).error,
      /Persistent storage is not configured/,
    );
  } finally {
    if (previousVercelEnvironment === undefined) {
      delete process.env.VERCEL_ENV;
    } else {
      process.env.VERCEL_ENV = previousVercelEnvironment;
    }
  }
});

test('Survey definition API persists a validated canonical definition', async () => {
  const definition = createCanonicalSurveyDefinition('שאלון שמור', 10);
  const params = Promise.resolve({ roundId: DEMO_ROUND.id });

  const putResponse = await saveSurveyDefinition(
    new Request(`http://localhost/api/rounds/${DEMO_ROUND.id}/survey-definition`, {
      method: 'PUT',
      body: JSON.stringify(definition),
    }),
    { params },
  );
  assert.strictEqual(putResponse.status, 200);

  const getResponse = await getSurveyDefinition(
    new Request(`http://localhost/api/rounds/${DEMO_ROUND.id}/survey-definition`),
    { params: Promise.resolve({ roundId: DEMO_ROUND.id }) },
  );
  const payload = await getResponse.json();
  assert.strictEqual(payload.definition.title, 'שאלון שמור');
});

test('Dynamic survey API preserves exact questions and freezes the snapshot after the first accepted response', async () => {
  useDemoRepositories();
  const definition = createCanonicalSurveyDefinition('שאלון דינמי', 10);
  definition.questions = surveyInstrument.dimensions.map((dimension, index) => ({
    id: `api-custom-${dimension.id}-${index + 1}`,
    dimensionId: dimension.id,
    text: `שאלת API מדויקת ${index + 1}`,
    required: true,
    enabled: true,
    answerMode: 'סקאלת צבעים',
  }));

  try {
    const saveResponse = await saveSurveyDefinition(
      new Request(
        `http://localhost/api/rounds/${DEMO_ROUND.id}/survey-definition`,
        { method: 'PUT', body: JSON.stringify(definition) },
      ),
      { params: Promise.resolve({ roundId: DEMO_ROUND.id }) },
    );
    assert.strictEqual(saveResponse.status, 200);

    const metadataResponse = await getSurveyMeta(
      new Request('http://localhost/api/survey/SHALOM-DEMO'),
      { params: Promise.resolve({ shareCode: 'SHALOM-DEMO' }) },
    );
    assert.strictEqual(metadataResponse.status, 200);
    const metadata = await metadataResponse.json();
    assert.deepStrictEqual(
      metadata.instrument.questions.map(
        (question: { id: string; text: string }) => [question.id, question.text],
      ),
      definition.questions.map((question) => [question.id, question.text]),
    );

    const submission = await submitSurvey(
      new Request('http://localhost/api/survey/SHALOM-DEMO/submit', {
        method: 'POST',
        body: JSON.stringify({
          answers: definition.questions.map((question) => ({
            questionId: question.id,
            dimensionId: question.dimensionId,
            value: 'green',
          })),
        }),
      }),
      { params: Promise.resolve({ shareCode: 'SHALOM-DEMO' }) },
    );
    assert.strictEqual(submission.status, 200);

    const revised = structuredClone(definition);
    revised.questions[0].text = 'נוסח חדש שדורש סבב חדש';
    const revisionResponse = await saveSurveyDefinition(
      new Request(
        `http://localhost/api/rounds/${DEMO_ROUND.id}/survey-definition`,
        { method: 'PUT', body: JSON.stringify(revised) },
      ),
      { params: Promise.resolve({ roundId: DEMO_ROUND.id }) },
    );
    assert.strictEqual(revisionResponse.status, 409);
    assert.match((await revisionResponse.json()).error, /new round/i);
  } finally {
    useDemoRepositories();
  }
});

test('Round status API rejects activation when persisted questions do not cover all eight dimensions', async () => {
  const invalidDefinition = createCanonicalSurveyDefinition('Invalid', 10);
  invalidDefinition.questions = invalidDefinition.questions.filter(
    (question) => question.dimensionId !== 'meaning',
  );
  const draftRound = {
    ...DEMO_ROUND,
    id: 'round_incomplete_dimensions',
    status: 'draft' as const,
    shareCode: 'SHALOM-INCOMPLETE',
    surveyDefinition: invalidDefinition,
  };
  setRepositories({
    orgRepo: new InMemoryOrganizationRepository([DEMO_ORGANIZATION]),
    roundRepo: new InMemoryRoundRepository([draftRound]),
    surveyRepo: new InMemorySurveyRepository(),
  });

  try {
    const response = await updateRound(
      new Request(`http://localhost/api/rounds/${draftRound.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'active' }),
      }),
      { params: Promise.resolve({ roundId: draftRound.id }) },
    );

    assert.strictEqual(response.status, 409);
    assert.match((await response.json()).error, /all eight dimensions/i);
  } finally {
    useDemoRepositories();
  }
});

test('Round status API persists an allowed transition', async () => {
  useDemoRepositories();

  const response = await updateRound(
    new Request(`http://localhost/api/rounds/${DEMO_ROUND.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'closed' }),
    }),
    { params: Promise.resolve({ roundId: DEMO_ROUND.id }) },
  );

  assert.strictEqual(response.status, 200);
  const payload = await response.json();
  assert.strictEqual(payload.round.status, 'closed');
  useDemoRepositories();
});

test('API Route POST /api/rounds/[roundId]/reset clears responses and returns round status to draft', async () => {
  useDemoRepositories();

  const response = await resetRound(
    new Request(`http://localhost/api/rounds/${DEMO_ROUND.id}/reset`, {
      method: 'POST',
    }),
    { params: Promise.resolve({ roundId: DEMO_ROUND.id }) },
  );

  assert.strictEqual(response.status, 200);
  const payload = await response.json();
  assert.strictEqual(payload.success, true);
  assert.strictEqual(payload.round.status, 'draft');
  useDemoRepositories();
});

test('Saving a complete questionnaire activates a draft round, an incomplete one does not', async () => {
  const draftRoundId = 'round_draft_activation';
  const roundRepo = new InMemoryRoundRepository([
    {
      ...DEMO_ROUND,
      id: draftRoundId,
      shareCode: 'SHALOM-DRAFT',
      status: 'draft',
      surveyDefinition: {
        ...createCanonicalSurveyDefinition('טיוטה', 10),
        questions: [],
      },
    },
  ]);
  setRepositories({
    orgRepo: new InMemoryOrganizationRepository([DEMO_ORGANIZATION]),
    roundRepo,
    surveyRepo: new InMemorySurveyRepository(),
  });

  function save(definition: unknown) {
    return saveSurveyDefinition(
      new Request(`http://localhost/api/rounds/${draftRoundId}/survey-definition`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(definition),
      }),
      { params: Promise.resolve({ roundId: draftRoundId }) },
    );
  }

  try {
    const canonical = createCanonicalSurveyDefinition('טיוטה', 10);

    // One dimension missing: the draft is persisted but must not go live.
    const partial = await save({
      ...canonical,
      questions: canonical.questions.filter(
        (question) => question.dimensionId !== 'meaning',
      ),
    });
    assert.strictEqual(partial.status, 200);
    assert.strictEqual((await roundRepo.findById(draftRoundId))?.status, 'draft');

    const complete = await save(canonical);
    assert.strictEqual(complete.status, 200);
    assert.strictEqual((await roundRepo.findById(draftRoundId))?.status, 'active');
  } finally {
    useDemoRepositories();
  }
});

test('API Route POST /api/rounds/[roundId]/reset drops stale insights and writes an audit event', async () => {
  const roundRepo = new InMemoryRoundRepository([DEMO_ROUND]);
  const surveyRepo = new InMemorySurveyRepository();
  setRepositories({
    orgRepo: new InMemoryOrganizationRepository([DEMO_ORGANIZATION]),
    roundRepo,
    surveyRepo,
  });

  const auditRepo = new InMemoryAuditLogRepository();
  setAuditLogRepositoryForTests(auditRepo);

  try {
    await submitSurvey(
      new Request(`http://localhost/api/survey/${DEMO_ROUND.shareCode}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers: surveyInstrument.questions.map((question) => ({
            questionId: question.id,
            dimensionId: question.dimensionId,
            value: 'green',
          })),
        }),
      }),
      { params: Promise.resolve({ shareCode: DEMO_ROUND.shareCode }) },
    );
    await roundRepo.saveAiInsights(DEMO_ROUND.id, { status: 'success' });

    const response = await resetRound(
      new Request(`http://localhost/api/rounds/${DEMO_ROUND.id}/reset`, {
        method: 'POST',
      }),
      { params: Promise.resolve({ roundId: DEMO_ROUND.id }) },
    );

    assert.strictEqual(response.status, 200);
    // The analysis described responses that no longer exist.
    assert.strictEqual(await roundRepo.getAiInsights(DEMO_ROUND.id), null);
    assert.strictEqual(await surveyRepo.getResponseCount(DEMO_ROUND.id), 0);

    const events = await auditRepo.findByOrganizationId(
      DEMO_ROUND.organizationId,
    );
    const resetEvent = events.find((event) => event.action === 'ROUND_RESET');
    assert.ok(resetEvent, 'expected the reset to be audited');
    assert.strictEqual(resetEvent?.roundId, DEMO_ROUND.id);
    assert.strictEqual(resetEvent?.details?.deletedResponseCount, 1);
  } finally {
    setAuditLogRepositoryForTests(null);
    useDemoRepositories();
  }
});
