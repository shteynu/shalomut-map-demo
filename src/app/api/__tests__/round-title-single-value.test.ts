import assert from 'node:assert/strict';
import test, { after, before, beforeEach } from 'node:test';
import { PUT as saveSetup } from '../manager/setup/route';
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
import {
  DEMO_ORGANIZATION,
  DEMO_ROUND,
} from '@/lib/repositories/__fixtures__/demo-records';

/**
 * A round has one name, and two screens edit it.
 *
 * The setup screen calls it `תקופת מדידה` and the builder calls it
 * `שם השאלון`, and both write `SurveyRound.title` — but only the builder also
 * wrote the copy inside the questionnaire snapshot. So renaming a round on the
 * setup screen left the builder showing the old name, and the next
 * questionnaire save posted that old name straight back over the new one. The
 * rename was not refused and no error was shown; it simply came undone.
 *
 * The privacy threshold, edited on the same two screens, has always been kept
 * in step in both directions. These tests hold the title to the same rule.
 */

const ROUND_ID = DEMO_ROUND.id;
let previousDatabaseUrl: string | undefined;
let roundRepo: InMemoryRoundRepository;

function install() {
  roundRepo = new InMemoryRoundRepository([
    {
      ...DEMO_ROUND,
      status: 'draft',
      title: 'רבעון א׳',
      surveyDefinition: createCanonicalSurveyDefinition('רבעון א׳', 10),
    },
  ]);
  overrideCoreRepositories({
    orgRepo: new InMemoryOrganizationRepository([DEMO_ORGANIZATION]),
    roundRepo,
    surveyRepo: new InMemorySurveyRepository(),
    surveyDefinitionVersionRepo: new InMemorySurveyDefinitionVersionRepository(),
  });
}

before(() => {
  previousDatabaseUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
});

beforeEach(install);

after(() => {
  resetCoreRepositories();
  if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = previousDatabaseUrl;
});

function renameOnSetupScreen(title: string) {
  return saveSetup(
    new Request('http://localhost/api/manager/setup', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organization: {
          id: DEMO_ORGANIZATION.id,
          name: DEMO_ORGANIZATION.name,
          city: DEMO_ORGANIZATION.city,
          schoolType: DEMO_ORGANIZATION.schoolType,
          totalStaffCount: DEMO_ORGANIZATION.totalStaffCount,
        },
        round: {
          id: ROUND_ID,
          title,
          privacyThreshold: 10,
          startDate: '2026-09-01',
          backgroundContext: {
            audience: 'all-staff',
            classesPerGrade: { א: 2 },
            sicknessDaysThisQuarter: 3,
            newStaffMembers: 1,
            studentCount: 120,
            socioEconomicIndex: 5,
          },
        },
      }),
    }),
  );
}

function saveQuestionnaire(definition: unknown) {
  return saveSurveyDefinition(
    new Request(`http://localhost/api/rounds/${ROUND_ID}/survey-definition`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(definition),
    }),
    { params: Promise.resolve({ roundId: ROUND_ID }) },
  );
}

async function storedRound() {
  const round = await roundRepo.findById(ROUND_ID);
  assert.ok(round);
  return round;
}

test('renaming on the setup screen renames the questionnaire with it', async () => {
  assert.strictEqual((await renameOnSetupScreen('רבעון ב׳')).status, 200);

  const round = await storedRound();
  assert.strictEqual(round.title, 'רבעון ב׳');
  // The half that used to be left behind. The builder reads this copy, so a
  // stale one is what the manager saw after renaming the round.
  assert.strictEqual(round.surveyDefinition?.title, 'רבעון ב׳');
});

test('a questionnaire saved after a rename does not undo the rename', async () => {
  await renameOnSetupScreen('רבעון ב׳');

  // The builder posts back the questionnaire it is holding. Before the fix it
  // was holding the pre-rename copy, and this save reverted the round's name.
  const loaded = (await storedRound()).surveyDefinition;
  assert.strictEqual((await saveQuestionnaire(loaded)).status, 200);

  const round = await storedRound();
  assert.strictEqual(round.title, 'רבעון ב׳');
  assert.strictEqual(round.surveyDefinition?.title, 'רבעון ב׳');
});

test('renaming in the builder still renames the round', async () => {
  // The other direction was never broken, and must stay that way: the two
  // screens edit one value, so either of them may set it.
  const renamed = {
    ...(await storedRound()).surveyDefinition,
    title: 'רבעון ג׳',
  };
  assert.strictEqual((await saveQuestionnaire(renamed)).status, 200);

  const round = await storedRound();
  assert.strictEqual(round.title, 'רבעון ג׳');
  assert.strictEqual(round.surveyDefinition?.title, 'רבעון ג׳');
});

test('a setup save that does not touch the name leaves it alone', async () => {
  const renamed = {
    ...(await storedRound()).surveyDefinition,
    title: 'רבעון ג׳',
  };
  await saveQuestionnaire(renamed);

  // The setup screen posts whatever its own field holds, so this is the
  // manager saving background numbers with the name already agreed.
  assert.strictEqual((await renameOnSetupScreen('רבעון ג׳')).status, 200);

  const round = await storedRound();
  assert.strictEqual(round.title, 'רבעון ג׳');
  assert.strictEqual(round.surveyDefinition?.title, 'רבעון ג׳');
});
