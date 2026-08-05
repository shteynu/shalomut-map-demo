import assert from 'node:assert';
import test, { after, before, beforeEach } from 'node:test';
import { PUT as saveSurveyDefinition } from '../rounds/[roundId]/survey-definition/route';
import { GET as listVersions } from '../rounds/[roundId]/survey-definition/versions/route';
import { GET as readVersion } from '../rounds/[roundId]/survey-definition/versions/[versionId]/route';
import {
  InMemoryOrganizationRepository,
  InMemoryRoundRepository,
  InMemorySurveyDefinitionVersionRepository,
  InMemorySurveyRepository,
} from '@/lib/repositories';
import { overrideCoreRepositories, resetCoreRepositories } from '@/lib/composition-root';
import { createCanonicalSurveyDefinition } from '@/lib/survey-definition';
import type { SurveyDefinition } from '@/lib/types/backend';
import {
  DEMO_ORGANIZATION,
  DEMO_ROUND,
} from '@/lib/repositories/__fixtures__/demo-records';

const ROUND_ID = DEMO_ROUND.id;
const params = () => Promise.resolve({ roundId: ROUND_ID });
let previousDatabaseUrl: string | undefined;

function install() {
  overrideCoreRepositories({
    orgRepo: new InMemoryOrganizationRepository([DEMO_ORGANIZATION]),
    // A draft, so a complete questionnaire does not activate the round in the
    // middle of a history test.
    roundRepo: new InMemoryRoundRepository([
      { ...DEMO_ROUND, status: 'draft', surveyDefinition: undefined },
    ]),
    surveyRepo: new InMemorySurveyRepository(),
    surveyDefinitionVersionRepo: new InMemorySurveyDefinitionVersionRepository(),
  });
}

before(() => {
  previousDatabaseUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
});

beforeEach(() => {
  install();
});

after(() => {
  resetCoreRepositories();
  if (previousDatabaseUrl === undefined) {
    delete process.env.DATABASE_URL;
  } else {
    process.env.DATABASE_URL = previousDatabaseUrl;
  }
});

async function save(definition: SurveyDefinition) {
  const response = await saveSurveyDefinition(
    new Request(`http://localhost/api/rounds/${ROUND_ID}/survey-definition`, {
      method: 'PUT',
      body: JSON.stringify(definition),
    }),
    { params: params() },
  );
  assert.strictEqual(response.status, 200, await response.clone().text());
  return response;
}

async function history() {
  const response = await listVersions(
    new Request(`http://localhost/api/rounds/${ROUND_ID}/survey-definition/versions`),
    { params: params() },
  );
  assert.strictEqual(response.status, 200);
  return (await response.json()).versions as Array<{
    id: string;
    title: string;
    questionCount: number;
    enabledQuestionCount: number;
    isCurrent: boolean;
  }>;
}

test('a round nobody has saved has no history', async () => {
  assert.deepStrictEqual(await history(), []);
});

test('each save that changes the questionnaire becomes a version', async () => {
  await save(createCanonicalSurveyDefinition('גרסה ראשונה', 10));
  await save(createCanonicalSurveyDefinition('גרסה שנייה', 10));

  const versions = await history();
  assert.strictEqual(versions.length, 2);
  assert.strictEqual(versions[0].title, 'גרסה שנייה');
  assert.strictEqual(versions[0].isCurrent, true);
  assert.strictEqual(versions[1].title, 'גרסה ראשונה');
});

test('saving the same questionnaire again records nothing', async () => {
  const definition = createCanonicalSurveyDefinition('ללא שינוי', 10);

  await save(definition);
  await save(definition);
  await save(definition);

  assert.strictEqual((await history()).length, 1);
});

test('a change to the intro copy counts, not only a change to the questions', async () => {
  const definition = createCanonicalSurveyDefinition('שאלון', 10);
  await save(definition);
  await save({ ...definition, introText: 'פתיח חדש לגמרי' });

  assert.strictEqual((await history()).length, 2);
});

test('an earlier version can be read back whole, and restoring it is an ordinary save', async () => {
  const first = createCanonicalSurveyDefinition('לפני העריכה', 10);
  await save(first);

  const bulkDisabled: SurveyDefinition = {
    ...first,
    title: 'אחרי עריכה גורפת',
    questions: first.questions.map((question) => ({ ...question, enabled: false })),
  };
  await save(bulkDisabled);

  const versions = await history();
  const earlier = versions.find((version) => version.title === 'לפני העריכה');
  assert.ok(earlier);
  assert.strictEqual(earlier.enabledQuestionCount, earlier.questionCount);
  assert.strictEqual(versions[0].enabledQuestionCount, 0);

  const readResponse = await readVersion(
    new Request(
      `http://localhost/api/rounds/${ROUND_ID}/survey-definition/versions/${earlier.id}`,
    ),
    { params: Promise.resolve({ roundId: ROUND_ID, versionId: earlier.id }) },
  );
  assert.strictEqual(readResponse.status, 200);
  const payload = await readResponse.json();
  assert.strictEqual(payload.definition.title, 'לפני העריכה');

  // Restoring is sending that definition back through the ordinary save.
  await save(payload.definition);

  const afterRestore = await history();
  assert.strictEqual(afterRestore[0].title, 'לפני העריכה');
  assert.strictEqual(afterRestore[0].enabledQuestionCount, afterRestore[0].questionCount);
  // The bulk edit is still in the history: going back is itself a save, not an
  // erasure of what happened.
  assert.ok(afterRestore.some((version) => version.title === 'אחרי עריכה גורפת'));
});

test('a version id this round does not hold is a 404', async () => {
  await save(createCanonicalSurveyDefinition('שאלון', 10));

  const response = await readVersion(
    new Request(
      `http://localhost/api/rounds/${ROUND_ID}/survey-definition/versions/does-not-exist`,
    ),
    {
      params: Promise.resolve({
        roundId: ROUND_ID,
        versionId: 'does-not-exist',
      }),
    },
  );

  assert.strictEqual(response.status, 404);
});
