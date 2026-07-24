import assert from 'node:assert';
import test from 'node:test';
import {
  DEMO_ORGANIZATION,
  DEMO_ROUND,
  InMemoryOrganizationRepository,
  InMemoryRoundRepository,
  InMemorySurveyRepository,
  getRepositories,
  resetDefaultRepositories,
} from '..';
import { AnalyticsService, RoundService, SurveyService } from '../../services';
import { surveyInstrument } from '../../shalomut-source';
import { QuestionAnswerInput, SurveyResponseInput } from '../../types/backend';

function buildDummyAnswers(value: 'green' | 'yellow' | 'red' = 'green'): QuestionAnswerInput[] {
  return surveyInstrument.questions.map((q) => ({
    questionId: q.id,
    dimensionId: q.dimensionId,
    value,
  }));
}

test('InMemoryOrganizationRepository manages organizations correctly', async () => {
  const repo = new InMemoryOrganizationRepository([DEMO_ORGANIZATION]);
  const found = await repo.findById(DEMO_ORGANIZATION.id);
  assert.deepStrictEqual(found?.name, DEMO_ORGANIZATION.name);

  const newOrg = await repo.create({
    id: 'org_test_2',
    name: 'בית ספר יוגב',
    city: 'חיפה',
    schoolType: 'יסודי',
    totalStaffCount: 30,
    createdAt: new Date(),
  });

  const all = await repo.findAll();
  assert.strictEqual(all.length, 2);
  assert.strictEqual(newOrg.id, 'org_test_2');
});

test('InMemoryRoundRepository handles lookup by share code and status updates', async () => {
  const repo = new InMemoryRoundRepository([DEMO_ROUND]);

  // Case-insensitive lookup
  const found = await repo.findByShareCode('shalom-demo');
  assert.notStrictEqual(found, null);
  assert.strictEqual(found?.id, DEMO_ROUND.id);

  // Status update
  const updated = await repo.updateStatus(DEMO_ROUND.id, 'closed');
  assert.strictEqual(updated?.status, 'closed');

  const afterUpdate = await repo.findById(DEMO_ROUND.id);
  assert.strictEqual(afterUpdate?.status, 'closed');
});

test('InMemorySurveyRepository prevents duplicate token submissions', async () => {
  const surveyRepo = new InMemorySurveyRepository();
  const tokenHash = 'hash_user_123';
  const roundId = 'round_test_1';

  const answers = buildDummyAnswers('green');
  const submission: SurveyResponseInput = {
    roundId,
    answers,
    anonymousTokenHash: tokenHash,
  };

  // First submission succeeds
  const res1 = await SurveyService.submitAndSaveResponse(submission, surveyRepo);
  assert.strictEqual(res1.success, true);
  assert.strictEqual(await surveyRepo.getResponseCount(roundId), 1);

  // Second submission with same token hash fails
  const res2 = await SurveyService.submitAndSaveResponse(submission, surveyRepo);
  assert.strictEqual(res2.success, false);
  assert.match(res2.error || '', /already submitted/i);
  assert.strictEqual(await surveyRepo.getResponseCount(roundId), 1);
});

test('End-to-End Workflow: Round creation -> 10 submissions -> Analytics Unlocking', async () => {
  const roundRepo = new InMemoryRoundRepository();
  const surveyRepo = new InMemorySurveyRepository();

  // 1. Create a new round
  const round = await RoundService.createAndSaveRound(
    {
      organizationId: 'org_test_100',
      title: 'סקר סוף שנה',
      privacyThreshold: 10,
    },
    roundRepo
  );

  assert.strictEqual(round.status, 'active');

  // 2. Fetch by share code
  const fetchedRound = await RoundService.getRoundByShareCode(
    round.shareCode,
    roundRepo
  );
  assert.notStrictEqual(fetchedRound, null);

  // 3. Before 10 submissions: Analytics is locked
  for (let i = 0; i < 9; i++) {
    await SurveyService.submitAndSaveResponse(
      {
        roundId: round.id,
        answers: buildDummyAnswers(i % 2 === 0 ? 'green' : 'yellow'),
        anonymousTokenHash: `token_${i}`,
      },
      surveyRepo
    );
  }

  let analytics = await AnalyticsService.getAnalyticsForRound(
    round.id,
    roundRepo,
    surveyRepo
  );
  assert.notStrictEqual(analytics, null);
  assert.strictEqual(analytics?.totalResponses, 9);
  assert.strictEqual(analytics?.isLocked, true);
  assert.strictEqual(analytics?.dimensionScores['self-expression'].isLocked, true);

  // 4. Submit 10th response -> Analytics unlocks with score calculations
  await SurveyService.submitAndSaveResponse(
    {
      roundId: round.id,
      answers: buildDummyAnswers('green'),
      anonymousTokenHash: 'token_9',
    },
    surveyRepo
  );

  analytics = await AnalyticsService.getAnalyticsForRound(
    round.id,
    roundRepo,
    surveyRepo
  );
  assert.strictEqual(analytics?.totalResponses, 10);
  assert.strictEqual(analytics?.isLocked, false);
  assert.strictEqual(analytics?.dimensionScores['self-expression'].isLocked, false);
  assert.strictEqual(typeof analytics?.dimensionScores['self-expression'].averageScore, 'number');
});

test('getRepositories returns default repository singletons', () => {
  const { orgRepo, roundRepo, surveyRepo } = getRepositories();
  assert.notStrictEqual(orgRepo, undefined);
  assert.notStrictEqual(roundRepo, undefined);
  assert.notStrictEqual(surveyRepo, undefined);
});

test('default repositories do not invent demo records when no database is configured', async () => {
  const previousDatabaseUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  resetDefaultRepositories();

  try {
    const { orgRepo, roundRepo, surveyRepo } = getRepositories();

    assert.deepStrictEqual(await orgRepo.findAll(), []);
    assert.strictEqual(await roundRepo.findById(DEMO_ROUND.id), null);
    assert.strictEqual(await surveyRepo.getResponseCount(DEMO_ROUND.id), 0);
  } finally {
    if (previousDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = previousDatabaseUrl;
    }
  }
});
