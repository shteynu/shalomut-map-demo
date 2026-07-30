import assert from 'node:assert';
import test, { afterEach } from 'node:test';
import {
  classifyContractViolation,
  recordAiJobClaimed,
  recordAiJobCompleted,
  recordAiJobQueued,
  recordContractValidation,
  recordDuplicateSubmissionConflict,
  setOperationalMetricSinkForTests,
  type OperationalMetric,
} from '../ai-operational-metrics';
import type { AiAnalysisRun } from '../../types/ai-analysis-run';

const baseRun: AiAnalysisRun = {
  id: 'run-1',
  sequence: 1,
  roundId: 'round-1',
  requestKey: 'automatic',
  trigger: 'automatic',
  state: 'queued',
  attemptCount: 0,
  queuedAt: new Date('2026-07-30T10:00:00.000Z'),
};

afterEach(() => setOperationalMetricSinkForTests(null));

test('job lifecycle emits the complete A3 counter and latency vocabulary', () => {
  const metrics: OperationalMetric[] = [];
  setOperationalMetricSinkForTests((metric) => metrics.push(metric));

  recordAiJobQueued(baseRun);
  const running: AiAnalysisRun = {
    ...baseRun,
    state: 'running',
    attemptCount: 2,
    startedAt: new Date('2026-07-30T10:00:05.000Z'),
    heartbeatAt: new Date('2026-07-30T10:00:06.000Z'),
    leaseExpiresAt: new Date('2026-07-30T10:01:36.000Z'),
  };
  recordAiJobClaimed(running);
  recordAiJobCompleted({
    ...running,
    state: 'succeeded',
    completedAt: new Date('2026-07-30T10:00:25.000Z'),
    callbackReceivedAt: new Date('2026-07-30T10:00:24.000Z'),
  });

  assert.deepStrictEqual(
    metrics.map((metric) => metric.name),
    [
      'ai_jobs_queued',
      'ai_jobs_running',
      'ai_jobs_stalled',
      'ai_jobs_retry_count',
      'ai_job_queue_wait_ms',
      'ai_jobs_succeeded',
      'ai_job_processing_duration_ms',
      'ai_job_callback_delivery_latency_ms',
    ],
  );
  assert.strictEqual(metrics[3]?.value, 1);
  assert.strictEqual(metrics[4]?.value, 5_000);
  assert.strictEqual(metrics[6]?.value, 20_000);
  assert.strictEqual(metrics[7]?.value, 19_000);
  assert.strictEqual(
    metrics.every((metric) => !Object.hasOwn(metric, 'leaseToken')),
    true,
  );
});

test('contract, partial-map, and duplicate-submission metrics use bounded labels', () => {
  const metrics: OperationalMetric[] = [];
  setOperationalMetricSinkForTests((metric) => metrics.push(metric));

  assert.strictEqual(
    classifyContractViolation('Stone Map must contain exactly eight dimensions.'),
    'partial_map',
  );
  recordContractValidation({
    contractVersion: '5.0',
    error: 'Stone Map must contain exactly eight dimensions.',
    roundId: 'round-1',
    runId: 'run-1',
  });
  recordDuplicateSubmissionConflict('round-1');

  assert.deepStrictEqual(metrics.map((metric) => metric.name), [
    'ai_contract_validation_failures',
    'ai_partial_map_ratio_sample',
    'duplicate_submission_conflicts',
  ]);
  assert.deepStrictEqual(metrics[0]?.labels, {
    contractVersion: '5.0',
    violationCode: 'partial_map',
  });
  assert.strictEqual(metrics[1]?.value, 1);
});
