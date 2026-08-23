/**
 * A threshold nobody can watch is a threshold that does not exist.
 *
 * The second half of the 2026-08-21 audit finding. A durable store answers
 * "did this happen"; only something that shouts answers "and does anyone
 * know". These hold the shape the queue's detector already established: an
 * anonymous verdict a free uptime monitor can read as a `503`, and the numbers
 * behind it in a separate place, behind the shared secret.
 */
import assert from 'node:assert/strict';
import test, { after, before, beforeEach } from 'node:test';

import { GET as observabilityHealth } from '../health/observability/route';
import { GET as observabilityDetail } from '../observability/route';
import { InMemoryOperationalEventRepository } from '@/lib/repositories';
import {
  overrideCoreRepositories,
  resetCoreRepositories,
  resolveCoreRepositories,
} from '@/lib/composition-root';
import { uninstallObservabilitySinks } from '@/lib/server/observability-sinks';

let operationalEventRepo: InMemoryOperationalEventRepository;
let previousDatabaseUrl: string | undefined;
let previousCallbackSecret: string | undefined;

function install() {
  operationalEventRepo = new InMemoryOperationalEventRepository();
  overrideCoreRepositories({ operationalEventRepo });
}

before(() => {
  previousDatabaseUrl = process.env.DATABASE_URL;
  previousCallbackSecret = process.env.AI_CALLBACK_SECRET;
  delete process.env.DATABASE_URL;
  delete process.env.AI_CALLBACK_SECRET;
});

after(() => {
  resetCoreRepositories();
  uninstallObservabilitySinks();
  if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = previousDatabaseUrl;
  if (previousCallbackSecret === undefined) delete process.env.AI_CALLBACK_SECRET;
  else process.env.AI_CALLBACK_SECRET = previousCallbackSecret;
});

beforeEach(() => install());

test('a quiet deployment answers 200 and names nothing', async () => {
  const response = await observabilityHealth();
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.status, 'ok');
  assert.deepEqual(body.alerting, []);
});

test('a lost submission puts the monitor into 503, and says which', async () => {
  resolveCoreRepositories();
  await operationalEventRepo.record({
    kind: 'metric',
    name: 'survey_submission_lost_after_retries',
    value: 1,
    unit: 'count',
  });

  const response = await observabilityHealth();
  const body = await response.json();

  assert.equal(response.status, 503);
  assert.equal(body.status, 'alerting');
  assert.deepEqual(body.alerting, ['submission_lost']);
  // The public verdict carries no number: how often it happened says something
  // about how much measuring is going on, and that is behind the secret.
  assert.equal(body.readings, undefined);
});

test('a store that cannot be read is 503 unknown, not a quiet 200', async () => {
  operationalEventRepo.tally = async () => {
    throw new Error('the events table is unreachable');
  };

  const response = await observabilityHealth();
  const body = await response.json();

  assert.equal(response.status, 503);
  assert.equal(body.status, 'unknown');
  assert.equal(body.reason, 'events_unreadable');
  // Never echoed to an anonymous caller.
  assert.ok(!JSON.stringify(body).includes('unreachable'));
});

test('the numbers behind the verdict need the shared secret', async () => {
  process.env.AI_CALLBACK_SECRET = 'a-secret';
  try {
    const refused = await observabilityDetail(
      new Request('http://localhost/api/observability'),
    );
    assert.equal(refused.status, 401);

    const allowed = await observabilityDetail(
      new Request('http://localhost/api/observability', {
        headers: { authorization: 'Bearer a-secret' },
      }),
    );
    const body = await allowed.json();

    assert.equal(allowed.status, 200);
    assert.equal(body.status, 'ok');
    const lost = body.readings.find(
      (reading: { id: string }) => reading.id === 'submission_lost',
    );
    // Its own window and limit travel with it, so the verdict can be checked
    // rather than trusted.
    assert.equal(lost.observed, 0);
    assert.equal(lost.limit, 1);
    assert.equal(lost.windowMinutes, 360);
  } finally {
    delete process.env.AI_CALLBACK_SECRET;
  }
});
