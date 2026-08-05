import assert from 'node:assert';
import test from 'node:test';
import {
  InMemoryAiInsightsRepository,
  InMemoryOrganizationRepository,
  InMemoryRoundRepository,
  InMemorySurveyRepository,
} from '..';
import { encodeRoundAnalytics } from '../../analytics-encoder';
import { AnalyticsService, RoundService, SurveyService } from '../../services';
import { surveyInstrument } from '../../shalomut-source';
import { createCanonicalSurveyDefinition } from '../../survey-definition';
import { QuestionAnswerInput, SurveyResponseInput } from '../../types/backend';
import { DEFAULT_PRODUCED_ANALYTICS_CONTRACT_VERSION } from '../../ai-contract-version';
import { DEMO_ORGANIZATION, DEMO_ROUND } from '../__fixtures__/demo-records';

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

  const updated = await repo.update('org_test_2', { totalStaffCount: 34 });
  assert.strictEqual(updated?.totalStaffCount, 34);
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

  const configured = await repo.update(DEMO_ROUND.id, {
    surveyDefinition: {
      title: 'שאלון שמור',
      audience: 'כלל הצוות',
      estimatedMinutes: 12,
      minimumResponses: 10,
      introText: 'פתיח',
      anonymityText: 'אנונימי',
      questions: [],
    },
  });
  assert.strictEqual(configured?.surveyDefinition?.title, 'שאלון שמור');
});

test('InMemoryRoundRepository isolates the persisted questionnaire snapshot from caller mutations', async () => {
  const definition = createCanonicalSurveyDefinition('Snapshot round', 10);
  const round = {
    ...DEMO_ROUND,
    id: 'round_snapshot_copy',
    shareCode: 'SHALOM-SNAPSHOT',
    surveyDefinition: definition,
  };
  const repo = new InMemoryRoundRepository();
  const created = await repo.create(round);

  definition.questions[0].text = 'caller mutation before read';
  created.surveyDefinition!.questions[0].text = 'caller mutation after create';
  const firstRead = await repo.findById(round.id);
  assert.strictEqual(
    firstRead?.surveyDefinition?.questions[0].text,
    surveyInstrument.questions[0].text,
  );

  firstRead!.surveyDefinition!.questions[0].text = 'caller mutation after read';
  const secondRead = await repo.findById(round.id);
  assert.strictEqual(
    secondRead?.surveyDefinition?.questions[0].text,
    surveyInstrument.questions[0].text,
  );
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
      surveyDefinition: createCanonicalSurveyDefinition('סקר סוף שנה', 10),
    },
    roundRepo
  );

  // A questionnaire covering all eight dimensions activates the round; an empty
  // draft would stay in `draft` and never reach respondents.
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
  assert.deepStrictEqual(analytics?.dimensionScores, {});
  assert.deepStrictEqual(analytics?.questionAggregates, {});

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
  assert.ok(analytics);
  assert.strictEqual(
    encodeRoundAnalytics(analytics).contractVersion,
    DEFAULT_PRODUCED_ANALYTICS_CONTRACT_VERSION,
  );
  assert.strictEqual(Object.keys(analytics?.questionAggregates ?? {}).length, 24);
  assert.strictEqual(analytics?.dimensionScores['self-expression'].isLocked, false);
  assert.strictEqual(typeof analytics?.dimensionScores['self-expression'].averageScore, 'number');
});

test('InMemoryAiInsightsRepository refuses a result for a round nobody created', async () => {
  const roundRepo = new InMemoryRoundRepository([DEMO_ROUND]);
  const aiInsightsRepo = new InMemoryAiInsightsRepository(roundRepo);

  assert.strictEqual(
    await aiInsightsRepo.save('round_never_created', { status: 'success' }),
    false,
  );
  assert.strictEqual(
    await aiInsightsRepo.findByRoundId('round_never_created'),
    null,
  );

  assert.strictEqual(
    await aiInsightsRepo.save(DEMO_ROUND.id, { status: 'success' }),
    true,
  );
  assert.deepStrictEqual(await aiInsightsRepo.findByRoundId(DEMO_ROUND.id), {
    status: 'success',
  });

  await aiInsightsRepo.deleteByRoundId(DEMO_ROUND.id);
  assert.strictEqual(await aiInsightsRepo.findByRoundId(DEMO_ROUND.id), null);
});
