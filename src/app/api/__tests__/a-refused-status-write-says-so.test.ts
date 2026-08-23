/**
 * A status write that did not happen must not be reported as one that did.
 *
 * The 2026-08-21 audit found four findings meeting on one path. The repository
 * caught every database error into `null`; the PATCH route never checked for
 * it, so a refused write still recorded `ROUND_STATUS_UPDATED` and, for
 * `closed`, still queued the closing analysis; the builder closed the school's
 * running round and then reported success when the activation that followed was
 * refused; and every transition was validated against a read and written
 * unconditionally.
 *
 * These hold the three routes to the same rule: audit rows, dispatches and
 * `success: true` are consequences of a confirmed write, and nothing else.
 */
import assert from 'node:assert/strict';
import test, { after, before, beforeEach } from 'node:test';

import { PATCH as patchRound } from '../rounds/[roundId]/route';
import { POST as resetRound } from '../rounds/[roundId]/reset/route';
import { PUT as saveSurveyDefinition } from '../rounds/[roundId]/survey-definition/route';
import {
  InMemoryAiAnalysisRunRepository,
  InMemoryAiInsightsRepository,
  InMemoryOrganizationRepository,
  InMemoryRoundGoalRepository,
  InMemoryRoundRepository,
  InMemorySurveyDefinitionVersionRepository,
  InMemorySurveyRepository,
} from '@/lib/repositories';
import { InMemoryAuditLogRepository } from '@/lib/auth/domain-contract';
import {
  overrideCoreRepositories,
  resetCoreRepositories,
} from '@/lib/composition-root';
import {
  MINIMUM_PRIVACY_THRESHOLD,
  createCanonicalSurveyDefinition,
} from '@/lib/survey-definition';
import type {
  RoundStatus,
  SurveyResponseRecord,
  SurveyRound,
} from '@/lib/types/backend';
import {
  DEMO_ORGANIZATION,
  DEMO_ROUND,
} from '@/lib/repositories/__fixtures__/demo-records';

const ROUND_ID = DEMO_ROUND.id;
const SIBLING_ID = 'round-the-school-is-running';

let aiAnalysisRunRepo: InMemoryAiAnalysisRunRepository;
let auditLogRepo: InMemoryAuditLogRepository;
let roundRepo: InMemoryRoundRepository;
let surveyRepo: InMemorySurveyRepository;
let previousDatabaseUrl: string | undefined;

function responses(count: number): SurveyResponseRecord[] {
  return Array.from({ length: count }, (_unused, index) => ({
    id: `response-${index}`,
    roundId: ROUND_ID,
    answers: [],
    submittedAt: new Date('2026-08-22T09:00:00.000Z'),
  }));
}

function sibling(status: RoundStatus): SurveyRound {
  return {
    ...DEMO_ROUND,
    id: SIBLING_ID,
    title: 'סבב שכבר רץ',
    shareCode: 'SHALOM-RUNNING',
    status,
  };
}

function install({
  status = 'active' as RoundStatus,
  siblings = [] as SurveyRound[],
  responseCount = MINIMUM_PRIVACY_THRESHOLD,
  definition = undefined as SurveyRound['surveyDefinition'],
} = {}) {
  aiAnalysisRunRepo = new InMemoryAiAnalysisRunRepository();
  auditLogRepo = new InMemoryAuditLogRepository();
  roundRepo = new InMemoryRoundRepository([
    { ...DEMO_ROUND, status, surveyDefinition: definition },
    ...siblings,
  ]);
  surveyRepo = new InMemorySurveyRepository(responses(responseCount));

  overrideCoreRepositories({
    aiAnalysisRunRepo,
    aiInsightsRepo: new InMemoryAiInsightsRepository(),
    auditLogRepo,
    orgRepo: new InMemoryOrganizationRepository([DEMO_ORGANIZATION]),
    roundRepo,
    roundGoalRepo: new InMemoryRoundGoalRepository(),
    surveyRepo,
    surveyDefinitionVersionRepo: new InMemorySurveyDefinitionVersionRepository(),
  });
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

beforeEach(() => install());

function patch(status: RoundStatus) {
  return patchRound(
    new Request(`http://localhost/api/rounds/${ROUND_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    }),
    { params: Promise.resolve({ roundId: ROUND_ID }) } as any,
  );
}

async function statusEvents() {
  const events = await auditLogRepo.findByOrganizationId(
    DEMO_ROUND.organizationId,
  );
  return events.filter((event) => event.action === 'ROUND_STATUS_UPDATED');
}

/** The database's refusal, without needing two requests to race for real. */
function refuseTheWrite(
  outcome: 'status_changed' | 'write_failed',
  current: RoundStatus = 'archived',
) {
  roundRepo.updateStatus = async () =>
    outcome === 'status_changed'
      ? { outcome: 'status_changed', current }
      : { outcome: 'write_failed', reason: 'the connection dropped' };
}

test('reopening a round the school already replaced is refused, and named', async () => {
  // The audit's scenario, end to end and without a stub: the manager reopens a
  // closed round while the school has started another one. The index refuses
  // the second active round; before 2026-08-22 the API answered
  // `success: true, round: null` and wrote the audit row anyway.
  install({ status: 'closed', siblings: [sibling('active')] });

  const response = await patch('active');
  const body = await response.json();

  assert.equal(response.status, 409);
  assert.equal(body.success, undefined);
  assert.match(body.error, /סבב שכבר רץ/);
  assert.equal((await roundRepo.findById(ROUND_ID))?.status, 'closed');
  assert.deepEqual(await statusEvents(), []);
});

test('a refused transition writes no audit row', async () => {
  refuseTheWrite('status_changed');

  const response = await patch('closed');
  const body = await response.json();

  assert.equal(response.status, 409);
  assert.match(body.error, /'archived' now/);
  assert.deepEqual(await statusEvents(), []);
});

test('a close that failed dispatches no analysis', async () => {
  // The sharper half of the defect. A transient failure on `active → closed`
  // used to queue the closing analysis regardless, producing a map for a round
  // that was still collecting — which is what the 2026-08-17 decision removed.
  refuseTheWrite('write_failed');

  const response = await patch('closed');

  assert.equal(response.status, 500);
  assert.deepEqual(await aiAnalysisRunRepo.findByRoundId(ROUND_ID), []);
  assert.deepEqual(await statusEvents(), []);
});

test('a write that happened still audits and still dispatches', async () => {
  // The other direction, so the guard cannot pass by refusing everything.
  const response = await patch('closed');
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.round.status, 'closed');
  assert.equal(body.analysis, 'enqueued');
  assert.equal((await statusEvents()).length, 1);
});

test('a builder that could not start the round says so, and names what it closed', async () => {
  // The round is a draft with a complete questionnaire, so saving it activates
  // it — and the school is already running another round, so the activation is
  // refused after that other round has been closed. The questionnaire is saved
  // either way; what changed is that the response no longer calls that a
  // successful start, and `closedRoundTitles` names the round that stopped.
  install({
    status: 'draft',
    siblings: [sibling('active')],
    definition: createCanonicalSurveyDefinition('רבעון א׳', 10),
  });
  roundRepo.updateStatus = async (id, status, expectedCurrent) =>
    status === 'active'
      ? { outcome: 'write_failed', reason: 'the connection dropped' }
      : InMemoryRoundRepository.prototype.updateStatus.call(
          roundRepo,
          id,
          status,
          expectedCurrent,
        );

  const response = await saveSurveyDefinition(
    new Request(`http://localhost/api/rounds/${ROUND_ID}/survey-definition`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(createCanonicalSurveyDefinition('רבעון א׳', 10)),
    }),
    { params: Promise.resolve({ roundId: ROUND_ID }) },
  );
  const body = await response.json();

  assert.equal(response.status, 500);
  assert.equal(body.success, undefined);
  assert.match(body.error, /could not be started/);
  assert.deepEqual(body.closedRoundTitles, ['סבב שכבר רץ']);
  assert.equal((await roundRepo.findById(ROUND_ID))?.status, 'draft');
});

test('a reset that could not stop the round erases nothing', async () => {
  // Until 2026-08-23 the status write was the *last* of six, so a refusal here
  // arrived after the responses were already gone and the answer had to carry
  // the count of what it had destroyed. The write is first now, which turns the
  // worst case into the ordinary one: the round is untouched and a retry is a
  // retry rather than a second deletion.
  install({ status: 'active', responseCount: 3 });
  refuseTheWrite('write_failed');

  const response = await resetRound(
    new Request(`http://localhost/api/rounds/${ROUND_ID}/reset`, {
      method: 'POST',
    }),
    { params: Promise.resolve({ roundId: ROUND_ID }) },
  );
  const body = await response.json();

  assert.equal(response.status, 500);
  assert.equal(body.error, 'The round status could not be saved.');
  assert.equal(body.deletedResponseCount, undefined);

  // The three that would have been destroyed by the old ordering.
  assert.equal(await surveyRepo.getResponseCount(ROUND_ID), 3);
  assert.equal((await roundRepo.findById(ROUND_ID))?.status, 'active');
  const events = await auditLogRepo.findByOrganizationId(
    DEMO_ROUND.organizationId,
  );
  assert.equal(
    events.some((event) => event.action === 'ROUND_RESET'),
    false,
    'a reset that erased nothing must not be audited as one that did',
  );
});
