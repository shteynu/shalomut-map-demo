import assert from 'node:assert';
import test from 'node:test';
import { POST as recordAttempt } from '../survey/[shareCode]/attempt/route';
import { POST as submitSurvey } from '../survey/[shareCode]/submit/route';
import {
  InMemoryAiAnalysisRunRepository,
  InMemoryAiInsightsRepository,
  InMemoryOrganizationRepository,
  InMemoryRoundRepository,
  InMemorySurveyAttemptRepository,
  InMemorySurveyRepository,
} from '@/lib/repositories';
import {
  overrideCoreRepositories,
  resolveCoreRepositories,
} from '@/lib/composition-root';
import { surveyInstrument } from '@/lib/shalomut-source';
import {
  DEMO_ORGANIZATION,
  DEMO_ROUND,
} from '@/lib/repositories/__fixtures__/demo-records';

/**
 * The attempt endpoint is unauthenticated by necessity — it sits beside the
 * questionnaire on the only public route the product has. So the tests that
 * matter are about what it refuses to become: a share-code oracle, a way to
 * claim a completion with no answers behind it, and a table anyone can fill
 * with rows.
 */

const HASH = 'a'.repeat(64);
const SHARE_CODE = 'SHALOM-FUNNELTEST';

function useRepositories(roundStatus: 'active' | 'closed' = 'active') {
  const roundRepo = new InMemoryRoundRepository([
    { ...DEMO_ROUND, shareCode: SHARE_CODE, status: roundStatus },
  ]);
  const surveyAttemptRepo = new InMemorySurveyAttemptRepository();
  const surveyRepo = new InMemorySurveyRepository();

  overrideCoreRepositories({
    aiAnalysisRunRepo: new InMemoryAiAnalysisRunRepository(),
    aiInsightsRepo: new InMemoryAiInsightsRepository(roundRepo),
    orgRepo: new InMemoryOrganizationRepository([DEMO_ORGANIZATION]),
    roundRepo,
    surveyAttemptRepo,
    surveyRepo,
  });

  return { roundRepo, surveyAttemptRepo, surveyRepo };
}

function post(shareCode: string, body: unknown) {
  return recordAttempt(
    new Request(`http://localhost/api/survey/${shareCode}/attempt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ shareCode }) },
  );
}

test('a beacon for an active round is recorded', async () => {
  const { surveyAttemptRepo } = useRepositories();

  const res = await post(SHARE_CODE, { anonymousTokenHash: HASH, stage: 'opened' });
  assert.strictEqual(res.status, 204);

  const attempts = await surveyAttemptRepo.findByRoundId(DEMO_ROUND.id);
  assert.strictEqual(attempts.length, 1);
  assert.strictEqual(attempts[0].anonymousTokenHash, HASH);
  assert.strictEqual(attempts[0].consentAcceptedAt, undefined);
});

test('an unknown share code answers exactly like a known one', async () => {
  const { surveyAttemptRepo } = useRepositories();

  const known = await post(SHARE_CODE, {
    anonymousTokenHash: HASH,
    stage: 'opened',
  });
  const unknown = await post('SHALOM-NOTAROUND', {
    anonymousTokenHash: HASH,
    stage: 'opened',
  });

  // Identical answers, or this endpoint becomes the share-code oracle the
  // questionnaire endpoint stopped being.
  assert.strictEqual(known.status, unknown.status);
  assert.strictEqual(await known.text(), await unknown.text());

  const attempts = await surveyAttemptRepo.findByRoundId(DEMO_ROUND.id);
  assert.strictEqual(attempts.length, 1, 'only the real round was written to');
});

test('a round that is not collecting records nothing', async () => {
  const { surveyAttemptRepo } = useRepositories('closed');

  const res = await post(SHARE_CODE, { anonymousTokenHash: HASH, stage: 'opened' });

  assert.strictEqual(res.status, 204);
  assert.deepStrictEqual(await surveyAttemptRepo.findByRoundId(DEMO_ROUND.id), []);
});

test('a client cannot claim a completion', async () => {
  const { surveyAttemptRepo } = useRepositories();

  await post(SHARE_CODE, { anonymousTokenHash: HASH, stage: 'completed' });

  // Not merely ignored as a stage — no row at all, because a completion with no
  // answers behind it is the one number that would make the funnel a lie.
  assert.deepStrictEqual(await surveyAttemptRepo.findByRoundId(DEMO_ROUND.id), []);
});

test('a malformed token hash writes no row', async () => {
  const { surveyAttemptRepo } = useRepositories();

  for (const anonymousTokenHash of [
    'not-a-hash',
    '',
    HASH.toUpperCase(),
    `${HASH}extra`,
    42,
    null,
  ]) {
    const res = await post(SHARE_CODE, { anonymousTokenHash, stage: 'opened' });
    assert.strictEqual(res.status, 204);
  }

  assert.deepStrictEqual(await surveyAttemptRepo.findByRoundId(DEMO_ROUND.id), []);
});

test('a submitted response closes the funnel row it belongs to', async () => {
  const { surveyAttemptRepo } = useRepositories();

  await post(SHARE_CODE, { anonymousTokenHash: HASH, stage: 'consented' });

  const submission = await submitSurvey(
    new Request(`http://localhost/api/survey/${SHARE_CODE}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        anonymousTokenHash: HASH,
        answers: surveyInstrument.questions.map((question) => ({
          questionId: question.id,
          dimensionId: question.dimensionId,
          value: 'green',
        })),
      }),
    }),
    { params: Promise.resolve({ shareCode: SHARE_CODE }) },
  );

  assert.strictEqual(submission.status, 200);

  const [attempt] = await surveyAttemptRepo.findByRoundId(DEMO_ROUND.id);
  assert.ok(attempt.completedAt, 'the submit route marks the attempt complete');
});

test('the repository the route resolves is the wired one', () => {
  useRepositories();
  const { surveyAttemptRepo } = resolveCoreRepositories();

  assert.ok(surveyAttemptRepo, 'the composition root exposes an attempt repository');
});
