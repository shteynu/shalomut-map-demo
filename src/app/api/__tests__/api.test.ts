import assert from 'node:assert';
import test, { after, before } from 'node:test';
import { GET as getRoundAnalytics } from '../rounds/[roundId]/analytics/route';
import { GET as getAiInsights } from '../rounds/[roundId]/ai-insights/route';
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
  InMemoryAiAnalysisRunRepository,
  InMemoryOrganizationRepository,
  InMemoryAiInsightsRepository,
  InMemoryRoundRepository,
  InMemorySurveyRepository,
} from '@/lib/repositories';
import { overrideCoreRepositories, resetCoreRepositories } from '@/lib/composition-root';
import { InMemoryAuditLogRepository } from '@/lib/auth/domain-contract';
import { JwtSessionProvider } from '@/lib/auth/jwt-session-provider';
import { surveyInstrument } from '@/lib/shalomut-source';
import { createCanonicalSurveyDefinition } from '@/lib/survey-definition';
import {
  isAnalyticQuestion,
  type QuestionAnswerInput,
} from '@/lib/types/backend';
import { DEMO_ORGANIZATION, DEMO_ROUND } from '@/lib/repositories/__fixtures__/demo-records';

let previousDatabaseUrl: string | undefined;

/**
 * A platform administrator's cookie, for the two routes that ask whether the
 * caller is one. It is minted rather than faked: the routes verify the token,
 * so a handmade cookie would prove nothing about the check.
 */
async function administratorCookie() {
  const { token } = await new JwtSessionProvider().createSession(
    {
      id: 'mgr-platform',
      email: 'platform@shalomut.example',
      name: 'Platform',
      isPlatformAdministrator: true,
      createdAt: new Date(),
    },
    null,
    [],
  );
  return `shalomut_session=${token}`;
}

function useDemoRepositories() {
  overrideCoreRepositories({
    aiAnalysisRunRepo: new InMemoryAiAnalysisRunRepository(),
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
  resetCoreRepositories();
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
  resetCoreRepositories();

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
  overrideCoreRepositories({
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

/**
 * This route is the one endpoint that answers an unauthenticated caller holding
 * nothing but a share code, and until 2026-08-10 it returned the whole round
 * domain object. That object carries `backgroundContext` — sickness days, staff
 * turnover, the socio-economic index and the manager's free-text notes about
 * the school — plus the organization id and the internal round id. None of it
 * is rendered by a respondent screen.
 *
 * The test asserts the shape of the whole body rather than the absence of one
 * field, because the leak arrived by returning an object rather than by adding
 * a field, and the next one would arrive the same way.
 */
test('GET /api/survey/[shareCode] tells an anonymous caller nothing about the school', async () => {
  const roundWithContext = {
    ...DEMO_ROUND,
    shareCode: 'SHALOM-CONTEXTLEAK',
    status: 'active' as const,
    backgroundContext: {
      audience: 'כלל צוות ההוראה',
      sicknessDaysThisQuarter: 41,
      newStaffMembers: 3,
      studentCount: 480,
      socioEconomicIndex: 7,
      classesPerGrade: { 'ז': 4, 'ח': 3 },
      notes: 'המורה יעל בחופשת מחלה ממושכת, והמתח בחדר המורים גבוה',
    },
  };
  overrideCoreRepositories({
    orgRepo: new InMemoryOrganizationRepository([DEMO_ORGANIZATION]),
    roundRepo: new InMemoryRoundRepository([roundWithContext]),
    surveyRepo: new InMemorySurveyRepository(),
  });

  try {
    const res = await getSurveyMeta(
      new Request('http://localhost/api/survey/SHALOM-CONTEXTLEAK'),
      { params: Promise.resolve({ shareCode: 'SHALOM-CONTEXTLEAK' }) },
    );
    assert.strictEqual(res.status, 200);

    const body = await res.json();
    assert.deepStrictEqual(Object.keys(body.round).sort(), [
      'privacyThreshold',
      'shareCode',
      'status',
      'title',
    ]);

    // Belt and braces: nothing anywhere in the serialized body, at any depth.
    const serialized = JSON.stringify(body);
    for (const secret of [
      'backgroundContext',
      'sicknessDaysThisQuarter',
      'socioEconomicIndex',
      'organizationId',
      'יעל',
      roundWithContext.organizationId,
      roundWithContext.id,
    ]) {
      assert.ok(
        !serialized.includes(secret),
        `respondent payload must not carry ${secret}`,
      );
    }
  } finally {
    useDemoRepositories();
  }
});

test('a share code for a round that is not collecting does not name the round', async () => {
  const closedRound = {
    ...DEMO_ROUND,
    shareCode: 'SHALOM-CLOSEDONE',
    status: 'closed' as const,
    title: 'סבב אביב — בית ספר יסודי הדקל',
  };
  overrideCoreRepositories({
    orgRepo: new InMemoryOrganizationRepository([DEMO_ORGANIZATION]),
    roundRepo: new InMemoryRoundRepository([closedRound]),
    surveyRepo: new InMemorySurveyRepository(),
  });

  try {
    const res = await getSurveyMeta(
      new Request('http://localhost/api/survey/SHALOM-CLOSEDONE'),
      { params: Promise.resolve({ shareCode: 'SHALOM-CLOSEDONE' }) },
    );

    assert.strictEqual(res.status, 400);
    const body = await res.json();
    // The status is what a client can act on; the school's own wording turned
    // a scan of share codes into a list of school names.
    assert.ok(body.error.includes('closed'));
    assert.ok(!body.error.includes('הדקל'));
  } finally {
    useDemoRepositories();
  }
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

test('API Route submit accepts a second attempt from the same device', async () => {
  useDemoRepositories();

  async function submit(anonymousTokenHash: string) {
    return submitSurvey(
      new Request('http://localhost/api/survey/SHALOM-DEMO/submit', {
        method: 'POST',
        body: JSON.stringify({ answers: buildAnswers(), anonymousTokenHash }),
      }),
      { params: Promise.resolve({ shareCode: 'SHALOM-DEMO' }) },
    );
  }

  // One anonymous link, one browser, two separate people answering: each
  // attempt carries its own token, so the round must record both.
  const first = await submit('attempt-token-hash-1');
  const second = await submit('attempt-token-hash-2');

  assert.strictEqual(first.status, 200);
  assert.strictEqual(second.status, 200);

  // The same token still de-duplicates, which is what protects a retry of one
  // attempt from counting twice. The refusal is a conflict, not a bad request:
  // the payload is fine, it just loses to a response the round already holds.
  const replay = await submit('attempt-token-hash-2');
  assert.strictEqual(replay.status, 409);

  // The reason travels as a code so a respondent client can recognise its own
  // earlier success without matching English server copy.
  const replayBody = await replay.json();
  assert.strictEqual(replayBody.code, 'ALREADY_SUBMITTED');
  assert.match(replayBody.error, /already submitted/i);

  useDemoRepositories();
});

test('API Route submit names why it refused, not only that it refused', async () => {
  useDemoRepositories();

  const missingRound = await submitSurvey(
    new Request('http://localhost/api/survey/SHALOM-NOPE/submit', {
      method: 'POST',
      body: JSON.stringify({ answers: buildAnswers() }),
    }),
    { params: Promise.resolve({ shareCode: 'SHALOM-NOPE' }) },
  );
  assert.strictEqual(missingRound.status, 404);
  assert.strictEqual((await missingRound.json()).code, 'ROUND_NOT_FOUND');

  const badAnswers = await submitSurvey(
    new Request('http://localhost/api/survey/SHALOM-DEMO/submit', {
      method: 'POST',
      body: JSON.stringify({ answers: [] }),
    }),
    { params: Promise.resolve({ shareCode: 'SHALOM-DEMO' }) },
  );
  assert.strictEqual(badAnswers.status, 400);
  assert.strictEqual((await badAnswers.json()).code, 'INVALID_ANSWERS');

  useDemoRepositories();
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

  overrideCoreRepositories({
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

test('API Route ai-insights serves one round its own analysis and hides another school\'s', async () => {
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
    shareCode: 'SHALOM-OTHER-AI',
  };
  const ownRound = { ...DEMO_ROUND, id: 'round_own_school' };

  const roundRepo = new InMemoryRoundRepository([ownRound, otherRound]);
  const aiInsightsRepo = new InMemoryAiInsightsRepository(roundRepo);
  await aiInsightsRepo.save(ownRound.id, {
    contractVersion: '5.0',
    roundId: ownRound.id,
    status: 'success',
  });
  await aiInsightsRepo.save(otherRound.id, {
    contractVersion: '5.0',
    roundId: otherRound.id,
    status: 'success',
  });

  overrideCoreRepositories({
    aiAnalysisRunRepo: new InMemoryAiAnalysisRunRepository(),
    aiInsightsRepo,
    orgRepo: new InMemoryOrganizationRepository([
      DEMO_ORGANIZATION,
      otherOrganization,
    ]),
    roundRepo,
    surveyRepo: new InMemorySurveyRepository(),
  });

  try {
    const scopedHeaders = {
      'x-shalomut-manager-organization-id': DEMO_ORGANIZATION.id,
    };

    const own = await getAiInsights(
      new Request(`http://localhost/api/rounds/${ownRound.id}/ai-insights`, {
        headers: scopedHeaders,
      }),
      { params: Promise.resolve({ roundId: ownRound.id }) },
    );

    assert.strictEqual(own.status, 200);
    // The analysis a screen reads names the round it is about, so a result
    // stored for one round can never be served under another.
    assert.strictEqual((await own.json()).roundId, ownRound.id);

    const foreign = await getAiInsights(
      new Request(`http://localhost/api/rounds/${otherRound.id}/ai-insights`, {
        headers: scopedHeaders,
      }),
      { params: Promise.resolve({ roundId: otherRound.id }) },
    );

    assert.strictEqual(foreign.status, 404);
  } finally {
    useDemoRepositories();
  }
});

test('API Route PUT /api/manager/setup persists the first organization and round', async () => {
  resetCoreRepositories();

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
    // Setup persists the standard questionnaire, and persists it as a draft:
    // the manager reads and edits it, and saving it in the builder is what puts
    // the round live.
    assert.strictEqual(
      payload.round.surveyDefinition.questions.length,
      surveyInstrument.questions.length,
    );
    assert.strictEqual(payload.round.status, 'draft');
  } finally {
    useDemoRepositories();
  }
});

test('API Route PUT /api/manager/setup creates the configured scoped organization ID', async () => {
  resetCoreRepositories();

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

test('API Route PUT /api/manager/setup opens a second school beside the scoped one, for an administrator', async () => {
  const orgRepo = new InMemoryOrganizationRepository([DEMO_ORGANIZATION]);
  overrideCoreRepositories({
    aiAnalysisRunRepo: new InMemoryAiAnalysisRunRepository(),
    orgRepo,
    roundRepo: new InMemoryRoundRepository([DEMO_ROUND]),
    surveyRepo: new InMemorySurveyRepository(),
  });

  try {
    const request = new Request('http://localhost/api/manager/setup', {
      method: 'PUT',
      headers: {
        'x-shalomut-manager-organization-id': DEMO_ORGANIZATION.id,
        cookie: await administratorCookie(),
      },
      body: JSON.stringify({
        createOrganization: true,
        organization: {
          name: 'בית ספר שני',
          city: 'ירושלים',
          schoolType: 'תיכון',
          totalStaffCount: 45,
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
    assert.notStrictEqual(payload.organization.id, DEMO_ORGANIZATION.id);
    assert.strictEqual(payload.organization.name, 'בית ספר שני');
    assert.strictEqual(payload.round.organizationId, payload.organization.id);

    // The school the request was scoped to is untouched: adding a school beside
    // it must never be a rename of it.
    const scopedSchool = await orgRepo.findById(DEMO_ORGANIZATION.id);
    assert.strictEqual(scopedSchool?.name, DEMO_ORGANIZATION.name);
    assert.strictEqual((await orgRepo.findAll()).length, 2);
  } finally {
    useDemoRepositories();
  }
});

test('API Route PUT /api/manager/setup refuses to open a school for anybody but an administrator', async () => {
  const orgRepo = new InMemoryOrganizationRepository([DEMO_ORGANIZATION]);
  overrideCoreRepositories({
    aiAnalysisRunRepo: new InMemoryAiAnalysisRunRepository(),
    orgRepo,
    roundRepo: new InMemoryRoundRepository([DEMO_ROUND]),
    surveyRepo: new InMemorySurveyRepository(),
  });

  try {
    const response = await saveManagerSetup(
      new Request('http://localhost/api/manager/setup', {
        method: 'PUT',
        headers: {
          'x-shalomut-manager-organization-id': DEMO_ORGANIZATION.id,
        },
        body: JSON.stringify({
          createOrganization: true,
          organization: {
            name: 'בית ספר שלישי',
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
      }),
    );

    assert.strictEqual(response.status, 403);
    // And nothing was opened. A refusal that still writes is worse than no
    // refusal, because the school then exists with nobody able to read it.
    assert.strictEqual((await orgRepo.findAll()).length, 1);
  } finally {
    useDemoRepositories();
  }
});

test('API Route PUT /api/manager/setup still saves the scoped school when no school is being opened', async () => {
  const orgRepo = new InMemoryOrganizationRepository([DEMO_ORGANIZATION]);
  overrideCoreRepositories({
    aiAnalysisRunRepo: new InMemoryAiAnalysisRunRepository(),
    orgRepo,
    roundRepo: new InMemoryRoundRepository([DEMO_ROUND]),
    surveyRepo: new InMemorySurveyRepository(),
  });

  try {
    const request = new Request('http://localhost/api/manager/setup', {
      method: 'PUT',
      headers: {
        'x-shalomut-manager-organization-id': DEMO_ORGANIZATION.id,
      },
      body: JSON.stringify({
        organization: {
          name: 'בית ספר בשם מעודכן',
          city: 'חיפה',
          schoolType: 'יסודי',
          totalStaffCount: 31,
        },
        round: {
          title: 'סבב מעודכן',
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
    assert.strictEqual(payload.organization.id, DEMO_ORGANIZATION.id);
    assert.strictEqual((await orgRepo.findAll()).length, 1);
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
    kind: "analytic" as const,
    scaleId: "wellbeing-colour" as const,
    polarity: "positive" as const,
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
          answers: definition.questions
            .filter(isAnalyticQuestion)
            .map((question) => ({
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
    (question) => !isAnalyticQuestion(question) || question.dimensionId !== 'meaning',
  );
  const draftRound = {
    ...DEMO_ROUND,
    id: 'round_incomplete_dimensions',
    status: 'draft' as const,
    shareCode: 'SHALOM-INCOMPLETE',
    surveyDefinition: invalidDefinition,
  };
  overrideCoreRepositories({
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
  overrideCoreRepositories({
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
        (question) => !isAnalyticQuestion(question) || question.dimensionId !== 'meaning',
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
  const aiAnalysisRunRepo = new InMemoryAiAnalysisRunRepository();
  const roundRepo = new InMemoryRoundRepository([DEMO_ROUND]);
  const aiInsightsRepo = new InMemoryAiInsightsRepository(roundRepo);
  const surveyRepo = new InMemorySurveyRepository();
  const auditLogRepo = new InMemoryAuditLogRepository();
  overrideCoreRepositories({
    aiAnalysisRunRepo,
    aiInsightsRepo,
    auditLogRepo,
    orgRepo: new InMemoryOrganizationRepository([DEMO_ORGANIZATION]),
    roundRepo,
    surveyRepo,
  });

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
    await aiInsightsRepo.save(DEMO_ROUND.id, { status: 'success' });
    await aiAnalysisRunRepo.enqueue(DEMO_ROUND.id, {
      requestKey: 'automatic',
      trigger: 'automatic',
    });

    const response = await resetRound(
      new Request(`http://localhost/api/rounds/${DEMO_ROUND.id}/reset`, {
        method: 'POST',
      }),
      { params: Promise.resolve({ roundId: DEMO_ROUND.id }) },
    );

    assert.strictEqual(response.status, 200);
    // The analysis described responses that no longer exist.
    assert.strictEqual(
      await aiInsightsRepo.findByRoundId(DEMO_ROUND.id),
      null,
    );
    assert.strictEqual(
      await aiAnalysisRunRepo.findLatestByRoundId(DEMO_ROUND.id),
      null,
    );
    assert.strictEqual(await surveyRepo.getResponseCount(DEMO_ROUND.id), 0);

    const events = await auditLogRepo.findByOrganizationId(
      DEMO_ROUND.organizationId,
    );
    const resetEvent = events.find((event) => event.action === 'ROUND_RESET');
    assert.ok(resetEvent, 'expected the reset to be audited');
    assert.strictEqual(resetEvent?.roundId, DEMO_ROUND.id);
    assert.strictEqual(resetEvent?.details?.deletedResponseCount, 1);
  } finally {
    useDemoRepositories();
  }
});

test('a created round and a status change each leave an audit row', async () => {
  const auditLogRepo = new InMemoryAuditLogRepository();
  const roundRepo = new InMemoryRoundRepository([DEMO_ROUND]);
  overrideCoreRepositories({
    aiAnalysisRunRepo: new InMemoryAiAnalysisRunRepository(),
    auditLogRepo,
    orgRepo: new InMemoryOrganizationRepository([DEMO_ORGANIZATION]),
    roundRepo,
    surveyRepo: new InMemorySurveyRepository(),
  });

  try {
    const created = await createRound(
      new Request('http://localhost/api/rounds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: DEMO_ORGANIZATION.id,
          title: 'A round worth recording',
        }),
      }),
    );
    assert.strictEqual(created.status, 201);

    const closed = await updateRound(
      new Request(`http://localhost/api/rounds/${DEMO_ROUND.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'closed' }),
      }),
      { params: Promise.resolve({ roundId: DEMO_ROUND.id }) },
    );
    assert.strictEqual(closed.status, 200);

    const actions = (
      await auditLogRepo.findByOrganizationId(DEMO_ORGANIZATION.id)
    ).map((event) => event.action);

    // Five action types were declared when the audit service was written and
    // one of them was ever recorded. A durable table that only knows about
    // resets is a durable empty table.
    assert.ok(
      actions.includes('ROUND_CREATED'),
      'expected the created round to be audited',
    );
    assert.ok(
      actions.includes('ROUND_STATUS_UPDATED'),
      'expected the status change to be audited',
    );
  } finally {
    useDemoRepositories();
  }
});
