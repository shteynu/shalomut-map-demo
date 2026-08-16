import assert from 'node:assert';
import test, { after, before } from 'node:test';
import { PUT as saveSurveyDefinition } from '../rounds/[roundId]/survey-definition/route';
import {
  InMemoryOrganizationRepository,
  InMemoryRoundRepository,
  InMemorySurveyDefinitionVersionRepository,
  InMemorySurveyRepository,
} from '@/lib/repositories';
import {
  overrideCoreRepositories,
  resetCoreRepositories,
} from '@/lib/composition-root';
import { createCanonicalSurveyDefinition } from '@/lib/survey-definition';
import { surveyInstrument } from '@/lib/shalomut-source';
import type { SurveyDefinition } from '@/lib/types/backend';
import {
  DEMO_ORGANIZATION,
  DEMO_ROUND,
} from '@/lib/repositories/__fixtures__/demo-records';

/**
 * What a round was built from has to survive the manager, not only the factory.
 *
 * The builder posts a questionnaire it rebuilt from its own draft state — six
 * fields and a question list, and nothing else — so every one of these saves is
 * a request with no provenance in it. If the route ever trusts that body
 * instead of the stored definition, the first edit a manager makes silently
 * erases the record of which instrument the round came from, and nothing else
 * in the suite would notice.
 */

const ROUND_ID = DEMO_ROUND.id;
const params = () => Promise.resolve({ roundId: ROUND_ID });
let previousDatabaseUrl: string | undefined;

function install(surveyDefinition: SurveyDefinition | undefined) {
  const roundRepo = new InMemoryRoundRepository([
    // A draft, so a complete questionnaire does not activate the round and
    // close whichever one the fixture organization is running.
    { ...DEMO_ROUND, status: 'draft', surveyDefinition },
  ]);

  overrideCoreRepositories({
    orgRepo: new InMemoryOrganizationRepository([DEMO_ORGANIZATION]),
    roundRepo,
    surveyRepo: new InMemorySurveyRepository(),
    surveyDefinitionVersionRepo: new InMemorySurveyDefinitionVersionRepository(),
  });

  return roundRepo;
}

/**
 * The exact payload `saveDefinition` in `survey-builder.tsx` sends: the six
 * settings the manager can edit and the questions. Written out by hand rather
 * than spread from a definition, because spreading would carry the very field
 * this file exists to prove the browser never sends.
 */
function builderPayload(definition: SurveyDefinition) {
  return {
    title: definition.title,
    audience: definition.audience,
    estimatedMinutes: definition.estimatedMinutes,
    minimumResponses: definition.minimumResponses,
    introText: definition.introText,
    anonymityText: definition.anonymityText,
    questions: definition.questions,
  };
}

async function save(body: unknown) {
  const response = await saveSurveyDefinition(
    new Request(`http://localhost/api/rounds/${ROUND_ID}/survey-definition`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
    { params: params() },
  );
  assert.strictEqual(response.status, 200, await response.clone().text());
  return response;
}

before(() => {
  previousDatabaseUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
});

after(() => {
  resetCoreRepositories();
  if (previousDatabaseUrl === undefined) {
    delete process.env.DATABASE_URL;
  } else {
    process.env.DATABASE_URL = previousDatabaseUrl;
  }
});

test('the questionnaire a round is born with names the instrument it came from', () => {
  const definition = createCanonicalSurveyDefinition('סבב חדש', 10);

  assert.strictEqual(definition.instrumentId, surveyInstrument.id);
  assert.strictEqual(definition.instrumentId, 'shalomut-organizational-diagnosis-v1');
});

test("a manager's edit does not erase which instrument the round came from", async () => {
  const stored = createCanonicalSurveyDefinition('לפני העריכה', 10);
  const roundRepo = install(stored);

  // Exactly what the browser sends, and it carries no provenance at all.
  const posted = builderPayload({ ...stored, title: 'אחרי העריכה' });
  assert.ok(!('instrumentId' in posted));
  await save(posted);

  const round = await roundRepo.findById(ROUND_ID);
  assert.strictEqual(round?.surveyDefinition?.title, 'אחרי העריכה');
  assert.strictEqual(round?.surveyDefinition?.instrumentId, surveyInstrument.id);
});

test('a client cannot claim a provenance the round does not have', async () => {
  const stored = createCanonicalSurveyDefinition('סבב', 10);
  const roundRepo = install(stored);

  await save({
    ...builderPayload(stored),
    instrumentId: 'some-instrument-nobody-built-this-from',
  });

  const round = await roundRepo.findById(ROUND_ID);
  assert.strictEqual(round?.surveyDefinition?.instrumentId, surveyInstrument.id);
});

test('a round whose stored questionnaire has no provenance is not given one', async () => {
  // A round persisted before the field existed: the canonical questions, and
  // no record of where they came from. Saving is an edit, not an occasion to
  // decide what the past was.
  const legacy: SurveyDefinition = createCanonicalSurveyDefinition('סבב ותיק', 10);
  delete legacy.instrumentId;
  const roundRepo = install(legacy);

  await save(builderPayload({ ...legacy, title: 'סבב ותיק, נערך' }));

  const round = await roundRepo.findById(ROUND_ID);
  assert.strictEqual(round?.surveyDefinition?.title, 'סבב ותיק, נערך');
  assert.strictEqual(round?.surveyDefinition?.instrumentId, undefined);
});

test('a round that never stored a questionnaire records the one it was being answered against', async () => {
  // The respondent route, the submit route and the analytics path have all been
  // serving this round the canonical questionnaire through the same fallback.
  // Its first save writes down what it has in fact been running.
  const roundRepo = install(undefined);

  await save(builderPayload(createCanonicalSurveyDefinition('סבב ללא שאלון', 10)));

  const round = await roundRepo.findById(ROUND_ID);
  assert.strictEqual(round?.surveyDefinition?.instrumentId, surveyInstrument.id);
});
