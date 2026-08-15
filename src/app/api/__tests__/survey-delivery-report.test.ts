import assert from 'node:assert';
import test from 'node:test';
import { POST as reportDelivery } from '../survey/[shareCode]/delivery/route';
import {
  setOperationalMetricSinkForTests,
  type OperationalMetric,
} from '@/lib/server/ai-operational-metrics';
import { RATE_LIMITS, resetRateLimitStore } from '@/lib/server/rate-limit';

/**
 * This route exists to make a failure countable, so the tests are about the
 * count being trustworthy: what it records, what it refuses to record, and what
 * it refuses to become. It is unauthenticated and it writes a log line, which
 * together are the whole risk — a caller who can inflate this number can make
 * the deployment's own evidence say whatever they like.
 */

const SHARE_CODE = 'SHALOM-DELIVERY';
const ADDRESS = '203.0.113.77';

function captureMetrics() {
  const metrics: OperationalMetric[] = [];
  setOperationalMetricSinkForTests((metric) => metrics.push(metric));
  return metrics;
}

function post(body: unknown, address = ADDRESS) {
  return reportDelivery(
    new Request(`http://localhost/api/survey/${SHARE_CODE}/delivery`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': address,
      },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
  );
}

test('a submission that took two attempts is counted as recovered', async () => {
  resetRateLimitStore(null);
  const metrics = captureMetrics();

  const res = await post({ outcome: 'recovered', attempts: 2 });

  assert.strictEqual(res.status, 204);
  assert.deepStrictEqual(metrics, [
    {
      name: 'survey_submission_recovered_by_retry',
      value: 1,
      unit: 'count',
      labels: { attempts: '2' },
    },
  ]);

  setOperationalMetricSinkForTests(null);
});

test('a submission no attempt delivered is counted separately', async () => {
  resetRateLimitStore(null);
  const metrics = captureMetrics();

  await post({ outcome: 'lost', attempts: 3 });

  assert.strictEqual(metrics.length, 1);
  assert.strictEqual(metrics[0].name, 'survey_submission_lost_after_retries');
  assert.deepStrictEqual(metrics[0].labels, { attempts: '3' });

  setOperationalMetricSinkForTests(null);
});

test('the metric carries no round, so the route needs no repository', async () => {
  // Not a stylistic preference: correlating a round would mean a database
  // lookup on the path of a report about the database being unreachable. If a
  // `roundId` ever appears here, that lookup came with it.
  resetRateLimitStore(null);
  const metrics = captureMetrics();

  await post({ outcome: 'recovered', attempts: 2 });

  assert.strictEqual(metrics[0].roundId, undefined);
  assert.strictEqual(metrics[0].runId, undefined);

  setOperationalMetricSinkForTests(null);
});

test('a first-attempt delivery cannot be reported', async () => {
  // The happy path is already counted, one stored response each. Accepting it
  // here would let a caller add recoveries that never happened to the one
  // number this endpoint produces.
  resetRateLimitStore(null);
  const metrics = captureMetrics();

  const res = await post({ outcome: 'recovered', attempts: 1 });

  assert.strictEqual(res.status, 204);
  assert.deepStrictEqual(metrics, []);

  setOperationalMetricSinkForTests(null);
});

test('nonsense is answered exactly like a good report', async () => {
  resetRateLimitStore(null);
  const metrics = captureMetrics();

  const bodies: unknown[] = [
    { outcome: 'delivered-ish', attempts: 2 },
    { outcome: 'lost' },
    { outcome: 'lost', attempts: '3' },
    { outcome: 'lost', attempts: 2.5 },
    { outcome: 'lost', attempts: 9000 },
    { outcome: 'lost', attempts: -1 },
    'not json at all',
    {},
  ];

  for (const body of bodies) {
    const res = await post(body);
    assert.strictEqual(res.status, 204, `refused visibly: ${String(body)}`);
  }

  assert.deepStrictEqual(metrics, [], 'a malformed report reached the counter');

  setOperationalMetricSinkForTests(null);
});

test('a flood is dropped rather than logged, and says nothing about it', async () => {
  resetRateLimitStore(null);
  const metrics = captureMetrics();

  const limit = RATE_LIMITS.surveyDeliveryReport.limit;
  const statuses: number[] = [];
  for (let attempt = 0; attempt < limit + 5; attempt++) {
    statuses.push((await post({ outcome: 'lost', attempts: 3 })).status);
  }

  assert.ok(
    statuses.every((status) => status === 204),
    'the beacon stopped answering 204 under load',
  );
  assert.strictEqual(
    metrics.length,
    limit,
    'the limiter did not stop the log line',
  );

  setOperationalMetricSinkForTests(null);
  resetRateLimitStore(null);
});

test('the delivery beacon does not spend the submission budget', async () => {
  // Sharing a bucket with `surveySubmission` would let reports refuse real
  // answers, which inverts which half of the pair is disposable.
  assert.notStrictEqual(
    RATE_LIMITS.surveyDeliveryReport.name,
    RATE_LIMITS.surveySubmission.name,
  );
});
