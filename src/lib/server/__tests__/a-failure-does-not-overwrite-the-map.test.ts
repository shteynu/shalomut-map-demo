/**
 * The round's rollback copy of its map is a copy of a map.
 *
 * The callback dual-writes `survey_rounds.ai_insights` so that a result stays
 * reachable through the legacy reader. It used to write whatever validated,
 * and a failure payload validates: a re-run that failed therefore overwrote the
 * round's copy of the map it was meant to replace, and the fallback path fell
 * back to a failure. The durable run already keeps failures, with their own row
 * and their own `failureCode`; the column keeps results.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  InMemoryAiAnalysisRunRepository,
  InMemoryAiInsightsRepository,
  InMemoryRoundRepository,
  InMemorySurveyRepository,
} from '@/lib/repositories';
import { applyAiInsightsCallback } from '../ai-insights-service';
import type { SurveyRound } from '@/lib/types/backend';

const ROUND_ID = 'round-overwrite';

const round: SurveyRound = {
  id: ROUND_ID,
  organizationId: 'org-1',
  title: 'סבב בדיקה',
  status: 'closed',
  shareCode: 'SHALOM-OVERWRITE',
  privacyThreshold: 10,
  startDate: new Date('2026-08-01T00:00:00.000Z'),
  createdAt: new Date('2026-08-01T00:00:00.000Z'),
};

/**
 * Contract 1.0 on purpose: it is not a dynamic-questionnaire version, so the
 * payload needs no survey definition hash and no round verification, and what
 * these tests are about — which payloads may replace the column — is reached
 * without building a whole eight-stone map.
 */
const LOCKED_RESULT = {
  contractVersion: '1.0',
  roundId: ROUND_ID,
  isLocked: true,
  status: 'locked_error',
  errorMessage: 'Privacy lock active',
};

const FAILURE = {
  contractVersion: '1.0',
  roundId: ROUND_ID,
  isLocked: false,
  status: 'validation_failed',
  failureReason: 'provider_unavailable',
};

function repositories() {
  const roundRepo = new InMemoryRoundRepository([round]);
  return {
    aiAnalysisRunRepo: new InMemoryAiAnalysisRunRepository(),
    aiInsightsRepo: new InMemoryAiInsightsRepository(roundRepo),
    roundRepo,
    surveyRepo: new InMemorySurveyRepository(),
  };
}

const legacyIdentity = { runId: null, leaseToken: null };

test('a payload carrying a result is written to the column', async () => {
  const repos = repositories();

  const outcome = await applyAiInsightsCallback(
    ROUND_ID,
    legacyIdentity,
    LOCKED_RESULT,
    repos,
  );

  assert.equal(outcome.outcome, 'persisted');
  assert.deepEqual(
    await repos.aiInsightsRepo.findByRoundId(ROUND_ID),
    LOCKED_RESULT,
  );
});

test('a failure payload leaves the stored map where it is', async () => {
  const repos = repositories();
  await repos.aiInsightsRepo.save(ROUND_ID, LOCKED_RESULT);

  const outcome = await applyAiInsightsCallback(
    ROUND_ID,
    legacyIdentity,
    FAILURE,
    repos,
  );

  // Still accepted — the callback did its job, and the run records the failure.
  assert.equal(outcome.outcome, 'persisted');
  // And the map the failure was meant to replace is still the map.
  assert.deepEqual(
    await repos.aiInsightsRepo.findByRoundId(ROUND_ID),
    LOCKED_RESULT,
  );
});

test('a failure for a round with no stored map stores nothing', async () => {
  const repos = repositories();

  const outcome = await applyAiInsightsCallback(
    ROUND_ID,
    legacyIdentity,
    FAILURE,
    repos,
  );

  assert.equal(outcome.outcome, 'persisted');
  assert.equal(await repos.aiInsightsRepo.findByRoundId(ROUND_ID), null);
});
