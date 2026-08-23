/**
 * What a reset does first, and what it does as one unit.
 *
 * The 2026-08-21 audit found six sequential writes with nothing holding them
 * together and the status write last, which meant two things at once. A crash
 * in the middle left a round whose saved analysis described responses that no
 * longer existed. And the round advertised itself as `active` for the whole
 * duration of its own erasure, so a respondent submitting in that window wrote
 * answers into a round that had just declared it measured nothing.
 *
 * The transaction is proved against real PostgreSQL in
 * `__dbtests__/postgres-round-reset.test.ts` — an in-memory `Map` has nothing
 * to roll back. What is proved here is the ordering, the sweep behind it, and
 * the answer the manager gets.
 */
import assert from 'node:assert/strict';
import test, { after, before, beforeEach } from 'node:test';

import { POST as resetRound } from '../rounds/[roundId]/reset/route';
import {
  InMemoryAiAnalysisRunRepository,
  InMemoryAiInsightsRepository,
  InMemoryOrganizationRepository,
  InMemoryRoundGoalRepository,
  InMemoryRoundRepository,
  InMemorySurveyAttemptRepository,
  InMemorySurveyRepository,
} from '@/lib/repositories';
import { InMemoryAuditLogRepository } from '@/lib/auth/domain-contract';
import {
  overrideCoreRepositories,
  resetCoreRepositories,
} from '@/lib/composition-root';
import type { RoundStatus, SurveyResponseRecord } from '@/lib/types/backend';
import {
  DEMO_ORGANIZATION,
  DEMO_ROUND,
} from '@/lib/repositories/__fixtures__/demo-records';

const ROUND_ID = DEMO_ROUND.id;

/** Every write the reset makes, in the order it makes them. */
let writes: string[] = [];

function response(index: number): SurveyResponseRecord {
  return {
    id: `response-${index}`,
    roundId: ROUND_ID,
    answers: [],
    submittedAt: new Date('2026-08-22T09:00:00.000Z'),
  };
}

class RecordingRoundRepository extends InMemoryRoundRepository {
  async updateStatus(id: string, status: RoundStatus, expected: RoundStatus) {
    writes.push(`round.status=${status}`);
    return super.updateStatus(id, status, expected);
  }

  async clearPublishedAnalytics(id: string) {
    writes.push('round.clearPublishedAnalytics');
    return super.clearPublishedAnalytics(id);
  }
}

class RecordingSurveyRepository extends InMemorySurveyRepository {
  /** A submission that lands after the first erasure, or none. */
  public straggler: SurveyResponseRecord | null = null;

  async deleteByRoundId(roundId: string) {
    writes.push('responses.delete');
    await super.deleteByRoundId(roundId);

    // The in-flight request committing just after our delete. One only: it read
    // `active` before the status write, and nothing after it can.
    if (this.straggler) {
      const late = this.straggler;
      this.straggler = null;
      await super.saveResponse(late);
    }
  }
}

class RecordingAttemptRepository extends InMemorySurveyAttemptRepository {
  async deleteByRoundId(roundId: string) {
    writes.push('attempts.delete');
    return super.deleteByRoundId(roundId);
  }
}

class RecordingInsightsRepository extends InMemoryAiInsightsRepository {
  async deleteByRoundId(roundId: string) {
    writes.push('insights.delete');
    return super.deleteByRoundId(roundId);
  }
}

class RecordingRunRepository extends InMemoryAiAnalysisRunRepository {
  async deleteByRoundId(roundId: string) {
    writes.push('runs.delete');
    return super.deleteByRoundId(roundId);
  }
}

class RecordingGoalRepository extends InMemoryRoundGoalRepository {
  async deleteByRoundId(roundId: string) {
    writes.push('goals.delete');
    return super.deleteByRoundId(roundId);
  }
}

let auditLogRepo: InMemoryAuditLogRepository;
let roundRepo: RecordingRoundRepository;
let surveyRepo: RecordingSurveyRepository;
let previousDatabaseUrl: string | undefined;

function install(responseCount: number) {
  writes = [];
  auditLogRepo = new InMemoryAuditLogRepository();
  roundRepo = new RecordingRoundRepository([{ ...DEMO_ROUND, status: 'active' }]);
  surveyRepo = new RecordingSurveyRepository(
    Array.from({ length: responseCount }, (_unused, index) => response(index)),
  );

  overrideCoreRepositories({
    aiAnalysisRunRepo: new RecordingRunRepository(),
    aiInsightsRepo: new RecordingInsightsRepository(),
    auditLogRepo,
    orgRepo: new InMemoryOrganizationRepository([DEMO_ORGANIZATION]),
    roundGoalRepo: new RecordingGoalRepository(),
    roundRepo,
    surveyRepo,
    surveyAttemptRepo: new RecordingAttemptRepository(),
  });
}

function reset() {
  return resetRound(
    new Request(`http://localhost/api/rounds/${ROUND_ID}/reset`, {
      method: 'POST',
    }),
    { params: Promise.resolve({ roundId: ROUND_ID }) },
  );
}

before(() => {
  previousDatabaseUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
});

after(() => {
  resetCoreRepositories();
  if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = previousDatabaseUrl;
});

beforeEach(() => install(3));

test('the round leaves active before anything is erased', async () => {
  const response = await reset();

  assert.equal(response.status, 200);

  // The whole finding in one assertion: the status write is not merely present,
  // it is first. Everything after it happens to a round the share code already
  // refuses.
  assert.equal(writes[0], 'round.status=draft');
  assert.deepEqual(writes.slice(1), [
    'responses.delete',
    'attempts.delete',
    'insights.delete',
    'round.clearPublishedAnalytics',
    'runs.delete',
    'goals.delete',
  ]);
});

test('the answer carries the round as it is after the erasure', async () => {
  const body = await (await reset()).json();

  assert.equal(body.success, true);
  assert.equal(body.round.status, 'draft');
  // Answering with the row the status write returned would describe a round
  // that still had its published analytics, because that read happens before
  // the erasure clears them.
  assert.equal(body.round.publishedAnalytics ?? null, null);
});

test('a submission that raced the status write is swept up', async () => {
  // The one request the ordering cannot reach: it read `active` before the
  // status write and commits its answer just after the first erasure. The count
  // is read again once that erasure has committed, and the same idempotent work
  // runs a second time.
  surveyRepo.straggler = response(99);

  const body = await (await reset()).json();

  assert.equal(body.success, true);
  assert.equal(await surveyRepo.getResponseCount(ROUND_ID), 0);

  assert.equal(
    writes.filter((write) => write === 'responses.delete').length,
    2,
    'the erasure runs a second time when the count says a row arrived',
  );

  // And the straggler is counted in the figure the manager is told about. An
  // audit row saying three would describe a deletion that erased four.
  const events = await auditLogRepo.findByOrganizationId(
    DEMO_ROUND.organizationId,
  );
  const resetEvent = events.find((event) => event.action === 'ROUND_RESET');
  assert.equal(resetEvent?.details?.deletedResponseCount, 4);
});

test('a reset with nothing to sweep makes exactly one pass', async () => {
  await reset();

  assert.equal(
    writes.filter((write) => write === 'responses.delete').length,
    1,
    'the sweep must be conditional, not a second erasure every time',
  );
});
